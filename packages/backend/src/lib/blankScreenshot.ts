import { PNG } from 'pngjs';

/**
 * True when ≥ `threshold` of sampled pixels share one near-uniform color bucket
 * (typical of white/blank loaders or empty transition frames).
 */
export function isMostlyBlankPng(png: Buffer, threshold = 0.9): boolean {
  let decoded: PNG;
  try {
    decoded = PNG.sync.read(png);
  } catch {
    return false;
  }

  const { width, height, data } = decoded;
  if (width < 2 || height < 2) return true;

  const pixelCount = width * height;
  // Cap samples ~6k for speed on retina 1440×900×2 buffers.
  const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / 6000)));
  const buckets = new Map<number, number>();
  let samples = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (width * y + x) << 2;
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      // 32 levels/channel → stable dominant-color bucket
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
      samples += 1;
    }
  }

  if (samples === 0) return true;

  let mode = 0;
  for (const count of buckets.values()) {
    if (count > mode) mode = count;
  }

  return mode / samples >= threshold;
}
