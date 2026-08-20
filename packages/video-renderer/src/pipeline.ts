import { mkdir, writeFile, copyFile, access } from 'node:fs/promises';
import path from 'node:path';
import {
  VideoStoryboardSchema,
  VideoValidationReportSchema,
  type VideoProjectSource,
  type VideoStoryboard,
  type VideoStoryboardScene,
  type VideoValidationReport,
} from '@toolsweb/shared';
import { formatStepBumperText } from './config.js';
import type { VideoRendererConfig } from './config.js';
import {
  computeSceneDurationSeconds,
  cursorActionFor,
  transitionForGapMs,
  transitionOverlapSeconds,
} from './duration.js';
import type { NarrationAudioProvider } from './audio/types.js';
import { SilentNarrationProvider } from './audio/SilentNarrationProvider.js';
import { MacOsSayNarrationProvider, isMacOsSayAvailable } from './audio/MacOsSayNarrationProvider.js';
import { buildSrt, buildVtt } from './subtitles.js';
import { storyboardToCsv } from './storyboardCsv.js';
import { VideoRenderError } from './errors.js';
import { readPngSize } from './remotion/camera.js';

export type BuildProjectOptions = {
  source: VideoProjectSource;
  outputDir: string;
  config: VideoRendererConfig;
  /** Skip heavy TTS; force silent WAVs. */
  forceSilent?: boolean;
};

function padScene(n: number): string {
  return String(n).padStart(3, '0');
}

async function writePngFromDataUrl(
  dataUrl: string,
  dest: string
): Promise<{ width: number; height: number }> {
  const m = /^data:image\/png;base64,(.+)$/s.exec(dataUrl);
  if (!m) {
    throw new VideoRenderError({
      code: 'VIDEO_IMAGE_NOT_FOUND',
      stage: 'package',
      message: 'screenshot.dataUrl no es PNG base64.',
      recommendation: 'Hidrata la sesión con withImages=1.',
    });
  }
  const buf = Buffer.from(m[1]!, 'base64');
  await writeFile(dest, buf);
  const size = readPngSize(buf);
  return {
    width: size?.width ?? 1920,
    height: size?.height ?? 1080,
  };
}

export async function createNarrationProvider(
  config: VideoRendererConfig,
  forceSilent?: boolean
): Promise<NarrationAudioProvider> {
  if (forceSilent || config.ttsProvider === 'silent') {
    return new SilentNarrationProvider();
  }
  if (config.ttsProvider === 'macos') {
    if (!(await isMacOsSayAvailable())) {
      throw new VideoRenderError({
        code: 'VIDEO_NARRATION_PROVIDER_UNAVAILABLE',
        stage: 'audio',
        message: '`say` no disponible; no se puede usar VIDEO_TTS_PROVIDER=macos.',
        recommendation: 'Exporta con VIDEO_TTS_PROVIDER=silent o instala voces macOS.',
      });
    }
    return new MacOsSayNarrationProvider({
      voice: config.ttsVoice,
      rate: config.ttsRate,
    });
  }
  return new SilentNarrationProvider();
}

/**
 * Materialize images/audio + storyboard + subtitles under outputDir (UC-0009).
 * Does not render MP4 (see remotion/render).
 */
export async function buildVideoProjectArtifacts(
  options: BuildProjectOptions
): Promise<{
  storyboard: VideoStoryboard;
  report: VideoValidationReport;
  warnings: string[];
  paths: {
    projectJson: string;
    storyboardJson: string;
    storyboardCsv: string;
    srt: string;
    vtt: string;
    imagesDir: string;
    audioDir: string;
  };
}> {
  const { source, config } = options;
  const root = path.resolve(options.outputDir);
  const imagesDir = path.join(root, '01-images');
  const audioDir = path.join(root, '02-audio');
  const subDir = path.join(root, '03-subtitles');
  const boardDir = path.join(root, '04-storyboard');
  const metaDir = path.join(root, '06-metadata');
  await mkdir(imagesDir, { recursive: true });
  await mkdir(audioDir, { recursive: true });
  await mkdir(subDir, { recursive: true });
  await mkdir(boardDir, { recursive: true });
  await mkdir(metaDir, { recursive: true });
  await mkdir(path.join(root, '05-video'), { recursive: true });

  const warnings: string[] = [];
  const missingNarrations: number[] = [];
  const provider = await createNarrationProvider(config, options.forceSilent);

  const scenes: VideoStoryboardScene[] = [];
  let cursor = 0;
  let previousMenuModule: string | undefined;

  for (const step of source.steps) {
    const imageFile = `step-${padScene(step.sceneNumber)}.png`;
    const imagePath = path.join(imagesDir, imageFile);
    if (!step.screenshot.dataUrl) {
      throw new VideoRenderError({
        code: 'VIDEO_IMAGE_NOT_FOUND',
        stage: 'source-loading',
        sessionId: source.sessionId,
        stepNumber: step.stepNumber,
        message: `Sin dataUrl para escena ${step.sceneNumber}.`,
        recommendation: 'Carga la sesión hidratada desde SessionLogService.',
      });
    }
    const imageSize = await writePngFromDataUrl(step.screenshot.dataUrl, imagePath);

    const audioFile = `step-${padScene(step.sceneNumber)}.wav`;
    const audioPath = path.join(audioDir, audioFile);
    let audioDuration = 0;
    if (!step.narration.trim()) {
      missingNarrations.push(step.stepNumber);
      warnings.push(`Escena ${step.sceneNumber}: sin narración (silenciosa).`);
    }
    const synth = await provider.synthesize({
      sceneNumber: step.sceneNumber,
      text: step.narration,
      language: source.language,
      outputPath: audioPath,
    });
    audioDuration = synth.durationSeconds;

    const moduleLabel = step.menuModule?.trim() || undefined;
    const groupIndex = step.menuModuleIndex;
    const moduleChanged =
      Boolean(moduleLabel) && moduleLabel !== previousMenuModule;
    const bumperOn =
      config.stepBumperEnabled &&
      (config.stepBumperMode === 'step' || moduleChanged);
    const bumperPause = bumperOn ? Math.max(0, config.stepBumperSeconds) : 0;
    let bumperAudioDuration = 0;
    let bumperText: string | undefined;
    let bumperAudioRel: string | undefined;
    if (bumperOn) {
      bumperText = formatStepBumperText(config.stepBumperText, {
        stepNumber: step.stepNumber,
        ...(groupIndex ? { groupIndex } : {}),
        ...(moduleLabel ? { menuModule: moduleLabel } : {}),
      });
      const useVoice =
        !options.forceSilent &&
        config.ttsProvider !== 'silent' &&
        Boolean(bumperText);
      if (useVoice) {
        const bumperFile = `step-${padScene(step.sceneNumber)}-bumper.wav`;
        const bumperPath = path.join(audioDir, bumperFile);
        const b = await provider.synthesize({
          sceneNumber: step.sceneNumber,
          text: bumperText,
          language: source.language,
          outputPath: bumperPath,
        });
        bumperAudioDuration = b.durationSeconds;
        bumperAudioRel = `02-audio/${bumperFile}`;
      }
    }
    const bumperHold = bumperOn ? bumperAudioDuration + bumperPause : 0;
    if (moduleLabel) previousMenuModule = moduleLabel;

    const { transition } = transitionForGapMs(
      step.gapMs ?? 0,
      config.maxGapSeconds
    );
    const overlap = transitionOverlapSeconds(transition);
    const durationSeconds = computeSceneDurationSeconds({
      step,
      audioDurationSeconds: audioDuration,
      config,
      bumperHoldSeconds: bumperHold,
    });
    const startTimeSeconds = cursor;
    const endTimeSeconds = cursor + durationSeconds;
    // Next scene after bumper + narration audio + pad (visual crossfade only after that).
    const contentHoldEnd =
      startTimeSeconds +
      bumperHold +
      (audioDuration > 0 ? audioDuration + config.scenePaddingSeconds : config.scenePaddingSeconds);
    cursor = Math.max(contentHoldEnd, endTimeSeconds - overlap);

    if (!step.highlight) {
      warnings.push(`Escena ${step.sceneNumber}: sin bounding box.`);
    }

    scenes.push({
      sceneNumber: step.sceneNumber,
      stepNumber: step.stepNumber,
      action: step.action,
      narration: step.narration,
      startTimeSeconds,
      endTimeSeconds,
      durationSeconds,
      originalElapsedMs: step.elapsedMs,
      originalGapMs: step.gapMs,
      imageFile: `01-images/${imageFile}`,
      audioFile: `02-audio/${audioFile}`,
      audioDurationSeconds: audioDuration,
      bumperEnabled: bumperOn,
      ...(bumperText ? { bumperText } : {}),
      ...(bumperAudioRel ? { bumperAudioFile: bumperAudioRel } : {}),
      bumperAudioDurationSeconds: bumperOn ? bumperAudioDuration : 0,
      bumperPauseSeconds: bumperOn ? bumperPause : 0,
      ...(moduleLabel ? { menuModule: moduleLabel } : {}),
      ...(groupIndex ? { menuModuleIndex: groupIndex } : {}),
      ...(step.highlight ? { highlight: step.highlight } : {}),
      ...(step.clickPoint ? { clickPoint: step.clickPoint } : {}),
      sourceWidth: step.screenshot.width ?? imageSize.width,
      sourceHeight: step.screenshot.height ?? imageSize.height,
      cursorAction: cursorActionFor(step.action),
      transition,
      transitionOverlapSeconds: overlap,
      visualInstruction:
        step.description ??
        step.closestHeader ??
        `${step.action} · paso ${step.stepNumber}`,
    });
  }

  const storyboard = VideoStoryboardSchema.parse({
    version: 1,
    sessionId: source.sessionId,
    title: source.title,
    language: source.language,
    fps: config.fps,
    width: config.width,
    height: config.height,
    scenes,
  });

  const storyboardJson = path.join(boardDir, 'storyboard-final.json');
  const storyboardCsv = path.join(boardDir, 'storyboard-final.csv');
  const srt = path.join(subDir, 'tutorial.srt');
  const vtt = path.join(subDir, 'tutorial.vtt');
  const projectJson = path.join(metaDir, 'project.json');

  await writeFile(storyboardJson, JSON.stringify(storyboard, null, 2));
  await writeFile(storyboardCsv, storyboardToCsv(scenes));
  await writeFile(srt, buildSrt(scenes));
  await writeFile(vtt, buildVtt(scenes));
  await writeFile(
    projectJson,
    JSON.stringify(
      {
        version: 1,
        sessionId: source.sessionId,
        title: source.title,
        language: source.language,
        outputDir: root,
        config,
        storyboardPath: storyboardJson,
        sourceStepCount: source.steps.length,
      },
      null,
      2
    )
  );

  const report = VideoValidationReportSchema.parse({
    valid: true,
    sessionId: source.sessionId,
    expectedScenes: source.steps.length,
    generatedScenes: scenes.length,
    missingImages: [],
    missingNarrations,
    duplicatedStepNumbers: [],
    warnings,
    video: {
      generated: false,
      durationSeconds: cursor,
      width: config.width,
      height: config.height,
      fps: config.fps,
      audioPresent: provider.id !== 'silent' || scenes.some((s) => Boolean(s.audioFile)),
    },
  });
  await writeFile(
    path.join(metaDir, 'validation-report.json'),
    JSON.stringify(report, null, 2)
  );

  return {
    storyboard,
    report,
    warnings,
    paths: {
      projectJson,
      storyboardJson,
      storyboardCsv,
      srt,
      vtt,
      imagesDir,
      audioDir,
    },
  };
}

export async function writeClipchampPackageReadme(dest: string): Promise<void> {
  const md = `# Clipchamp — importar paquete Toolsweb

1. Abrir Microsoft Clipchamp.
2. Crear un proyecto **16:9** (1080p).
3. Importar \`05-video/tutorial-final.mp4\` para edición final (recomendado).
4. Alternativa: importar carpeta \`01-images/\` y \`02-audio/\` escena a escena según \`04-storyboard/storyboard-final.csv\`.
5. Importar \`03-subtitles/tutorial.srt\` como subtítulos.
6. Añadir logotipo, música o textos de marca.
7. Exportar en **1080p**.

> El video puede contener información visible en las capturas originales. Revísalo antes de compartirlo.
`;
  await writeFile(path.join(dest, 'README-CLIPCHAMP.md'), md);
}

export async function assembleClipchampPackage(root: string): Promise<string> {
  const pkg = path.join(root, 'clipchamp-package');
  await mkdir(pkg, { recursive: true });
  for (const name of [
    '01-images',
    '02-audio',
    '03-subtitles',
    '04-storyboard',
    '05-video',
    '06-metadata',
  ]) {
    const from = path.join(root, name);
    const to = path.join(pkg, name);
    await mkdir(to, { recursive: true });
    try {
      await access(from);
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(from);
      for (const f of files) {
        await copyFile(path.join(from, f), path.join(to, f));
      }
    } catch {
      /* optional until render */
    }
  }
  await writeClipchampPackageReadme(pkg);
  return pkg;
}
