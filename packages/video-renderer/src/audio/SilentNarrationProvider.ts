import { access, writeFile } from 'node:fs/promises';
import type { NarrationAudioProvider, NarrationSynthInput, NarrationSynthResult } from './types.js';

/** Minimal silent WAV (0.5s) — used when no voice. */
function silentWavBuffer(durationSeconds: number, sampleRate = 48000): Buffer {
  const samples = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const dataSize = samples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

export class SilentNarrationProvider implements NarrationAudioProvider {
  readonly id = 'silent';

  async synthesize(input: NarrationSynthInput): Promise<NarrationSynthResult> {
    const durationSeconds = input.text.trim() ? 2 : 2;
    await writeFile(input.outputPath, silentWavBuffer(durationSeconds));
    return { outputPath: input.outputPath, durationSeconds };
  }
}

export class ExistingAudioNarrationProvider implements NarrationAudioProvider {
  readonly id = 'existing';

  constructor(private readonly resolvePath: (sceneNumber: number) => string | undefined) {}

  async synthesize(input: NarrationSynthInput): Promise<NarrationSynthResult> {
    const existing = this.resolvePath(input.sceneNumber);
    if (!existing) {
      throw new Error(`No existing audio for scene ${input.sceneNumber}`);
    }
    await access(existing);
    // Duration probe is best-effort; caller may re-probe with ffprobe.
    return { outputPath: existing, durationSeconds: 2 };
  }
}
