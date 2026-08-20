import { spawn } from 'node:child_process';
import { access, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import ffmpegStatic from 'ffmpeg-static';
import { VideoRenderError } from '../errors.js';
import { prepareMacOsSpeechText } from './prepareMacOsSpeechText.js';
import type { NarrationAudioProvider, NarrationSynthInput, NarrationSynthResult } from './types.js';

const require = createRequire(import.meta.url);

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`));
    });
  });
}

function resolveFfprobe(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('ffprobe-static') as { path?: string };
    if (mod.path) return mod.path;
  } catch {
    /* */
  }
  return null;
}

async function probeDurationSeconds(wavPath: string): Promise<number | null> {
  const ffprobe = resolveFfprobe();
  if (!ffprobe) return null;
  try {
    const out = await run(ffprobe, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nw=1:nk=1',
      wavPath,
    ]);
    const n = Number(out.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export async function isMacOsSayAvailable(): Promise<boolean> {
  if (process.platform !== 'darwin') return false;
  try {
    await run('say', ['-v', '?']);
    return true;
  } catch {
    return false;
  }
}

export class MacOsSayNarrationProvider implements NarrationAudioProvider {
  readonly id = 'macos';

  constructor(
    private readonly opts: { voice: string; rate: number } = {
      voice: 'Paulina (Enhanced)',
      rate: 160,
    }
  ) {}

  async synthesize(input: NarrationSynthInput): Promise<NarrationSynthResult> {
    if (process.platform !== 'darwin') {
      throw new VideoRenderError({
        code: 'VIDEO_NARRATION_PROVIDER_UNAVAILABLE',
        stage: 'audio',
        message: 'MacOsSayNarrationProvider solo está disponible en macOS.',
        recommendation: 'Usa VIDEO_TTS_PROVIDER=silent o existing.',
      });
    }
    if (!(await isMacOsSayAvailable())) {
      throw new VideoRenderError({
        code: 'VIDEO_NARRATION_PROVIDER_UNAVAILABLE',
        stage: 'audio',
        message: 'El comando `say` no está disponible.',
        recommendation: 'Instala las voces del sistema o cambia el provider TTS.',
      });
    }

    const text = input.text.trim();
    if (!text) {
      const { SilentNarrationProvider } = await import('./SilentNarrationProvider.js');
      return new SilentNarrationProvider().synthesize(input);
    }

    const spoken = prepareMacOsSpeechText(text);
    const aiff = input.outputPath.replace(/\.wav$/i, '') + '.aiff';
    const ffmpeg =
      typeof ffmpegStatic === 'string'
        ? ffmpegStatic
        : (ffmpegStatic as { path?: string } | null)?.path;
    if (!ffmpeg) {
      throw new VideoRenderError({
        code: 'VIDEO_AUDIO_GENERATION_FAILED',
        stage: 'audio',
        stepNumber: input.sceneNumber,
        message: 'ffmpeg-static no disponible.',
        recommendation: 'npm install en @toolsweb/video-renderer.',
      });
    }

    try {
      await run('say', [
        '-v',
        this.opts.voice,
        '-r',
        String(this.opts.rate),
        '-o',
        aiff,
        spoken,
      ]);
      const aiffDur = (await probeDurationSeconds(aiff)) ?? 0;
      const fadeIn = Math.min(0.09, Math.max(0.02, aiffDur * 0.04));
      const fadeOut = Math.min(0.14, Math.max(0.04, aiffDur * 0.06));
      const fadeOutStart = aiffDur > fadeIn + fadeOut ? aiffDur - fadeOut : Math.max(0, aiffDur * 0.7);
      const af =
        aiffDur > 0.25
          ? `afade=t=in:st=0:d=${fadeIn.toFixed(3)},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeOut.toFixed(3)}`
          : null;
      await run(ffmpeg, [
        '-y',
        '-i',
        aiff,
        ...(af ? ['-af', af] : []),
        '-ar',
        '48000',
        '-ac',
        '1',
        '-c:a',
        'pcm_s16le',
        input.outputPath,
      ]);
    } catch (e) {
      throw new VideoRenderError({
        code: 'VIDEO_AUDIO_GENERATION_FAILED',
        stage: 'audio',
        stepNumber: input.sceneNumber,
        message: e instanceof Error ? e.message : String(e),
        recommendation:
          'Prueba VIDEO_TTS_VOICE="Paulina (Enhanced)" (o Paulina) o modo silent.',
      });
    } finally {
      await unlink(aiff).catch(() => undefined);
    }

    await access(input.outputPath);
    const probed = await probeDurationSeconds(input.outputPath);
    const words = text.split(/\s+/).filter(Boolean).length;
    const durationSeconds = probed ?? Math.max(1.2, words / 2.5);
    return { outputPath: path.resolve(input.outputPath), durationSeconds };
  }
}
