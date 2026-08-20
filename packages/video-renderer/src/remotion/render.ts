import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VideoStoryboard } from '@toolsweb/shared';
import type { VideoRendererConfig } from '../config.js';
import { VideoRenderError } from '../errors.js';
import { FRAME_PAD_X, FRAME_PAD_Y } from './renderConstants.js';
import { cameraForFocus, readPngSize, type CameraTransform } from './camera.js';
import type { RemotionSceneProps, TutorialVideoProps } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Always the package root whether this file runs from src/ or dist/. */
const PACKAGE_ROOT = path.resolve(__dirname, '../..');

async function fileToDataUrl(absPath: string, mime: string): Promise<string> {
  const buf = await readFile(absPath);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function buildCamera(
  sc: VideoStoryboard['scenes'][number],
  config: VideoRendererConfig,
  pngSize: { width: number; height: number }
): CameraTransform {
  const contentWidth = sc.sourceWidth ?? pngSize.width;
  const contentHeight = sc.sourceHeight ?? pngSize.height;
  const viewWidth = config.width * (1 - FRAME_PAD_X * 2);
  const viewHeight = config.height * (1 - FRAME_PAD_Y * 2);
  const maxZoom = Math.min(1.18, Math.max(1.05, config.maxZoom || 1.15));
  return cameraForFocus({
    contentWidth,
    contentHeight,
    viewWidth,
    viewHeight,
    ...(sc.highlight ? { highlight: sc.highlight } : {}),
    minZoom: 1.05,
    maxZoom,
    focusPaddingPx: 120,
  });
}

export async function renderTutorialMp4(input: {
  storyboard: VideoStoryboard;
  projectRoot: string;
  config: VideoRendererConfig;
  showSubtitles?: boolean;
}): Promise<{ outputPath: string; durationSeconds: number }> {
  const outDir = path.join(input.projectRoot, '05-video');
  await mkdir(outDir, { recursive: true });
  const outputPath = path.join(outDir, 'tutorial-final.mp4');

  const prepared = await Promise.all(
    input.storyboard.scenes.map(async (sc) => {
      const imageAbs = path.resolve(input.projectRoot, sc.imageFile);
      const imageBuf = await readFile(imageAbs);
      const pngSize = readPngSize(imageBuf) ?? { width: 1920, height: 1080 };
      const imageSrc = `data:image/png;base64,${imageBuf.toString('base64')}`;
      let audioSrc: string | undefined;
      if (sc.audioFile) {
        const audioAbs = path.resolve(input.projectRoot, sc.audioFile);
        audioSrc = await fileToDataUrl(audioAbs, 'audio/wav');
      }
      let bumperAudioSrc: string | undefined;
      if (sc.bumperAudioFile) {
        const bumperAbs = path.resolve(input.projectRoot, sc.bumperAudioFile);
        bumperAudioSrc = await fileToDataUrl(bumperAbs, 'audio/wav');
      }
      const camera = buildCamera(sc, input.config, pngSize);
      return {
        sceneNumber: sc.sceneNumber,
        stepNumber: sc.stepNumber,
        imageSrc,
        ...(audioSrc ? { audioSrc } : {}),
        narration: sc.narration,
        durationInFrames: Math.max(
          1,
          Math.round(sc.durationSeconds * input.config.fps)
        ),
        audioDurationInFrames: Math.max(
          0,
          Math.round((sc.audioDurationSeconds ?? 0) * input.config.fps)
        ),
        bumperEnabled: Boolean(sc.bumperEnabled),
        ...(sc.bumperText ? { bumperText: sc.bumperText } : {}),
        ...(sc.menuModuleIndex ? { bumperGroupIndex: sc.menuModuleIndex } : {}),
        ...(sc.menuModule ? { bumperModuleTitle: sc.menuModule } : {}),
        ...(bumperAudioSrc ? { bumperAudioSrc } : {}),
        bumperAudioDurationInFrames: Math.max(
          0,
          Math.round((sc.bumperAudioDurationSeconds ?? 0) * input.config.fps)
        ),
        bumperPauseInFrames: Math.max(
          0,
          Math.round((sc.bumperPauseSeconds ?? 0) * input.config.fps)
        ),
        backgroundColor: input.config.backgroundColor,
        showSubtitles: input.showSubtitles !== false,
        transitionOverlapFrames: Math.max(
          0,
          Math.round((sc.transitionOverlapSeconds ?? 0.35) * input.config.fps)
        ),
        sourceWidth: sc.sourceWidth ?? pngSize.width,
        sourceHeight: sc.sourceHeight ?? pngSize.height,
        ...(sc.highlight ? { highlight: sc.highlight } : {}),
        camera,
      };
    })
  );

  const scenes: RemotionSceneProps[] = prepared.map((sc, i) => ({
    ...sc,
    ...(i > 0 ? { prevCamera: prepared[i - 1]!.camera } : {}),
    ...(i < prepared.length - 1 ? { nextCamera: prepared[i + 1]!.camera } : {}),
  }));

  const props: TutorialVideoProps = {
    scenes,
    backgroundColor: input.config.backgroundColor,
    showSubtitles: input.showSubtitles !== false,
  };

  try {
    const { bundle } = await import('@remotion/bundler');
    const { renderMedia, selectComposition } = await import('@remotion/renderer');

    const entryPoint = path.join(PACKAGE_ROOT, 'src/remotion/entry.ts');
    if (!existsSync(entryPoint)) {
      throw new Error(`Remotion entry not found: ${entryPoint}`);
    }

    const serveUrl = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    const composition = await selectComposition({
      serveUrl,
      id: 'ToolswebTutorialVideo',
      inputProps: props,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: props,
      audioCodec: 'aac',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await writeFile(path.join(outDir, 'render-error.txt'), msg, 'utf8');
    throw new VideoRenderError({
      code: 'VIDEO_RENDER_FAILED',
      stage: 'render',
      sessionId: input.storyboard.sessionId,
      message: msg,
      recommendation:
        'Verifica Chromium Remotion y ffmpeg-static. El paquete de imágenes/audio/SRT sigue disponible.',
    });
  }

  const durationSeconds = input.storyboard.scenes.reduce(
    (a, s) => a + s.durationSeconds,
    0
  );
  return { outputPath, durationSeconds };
}
