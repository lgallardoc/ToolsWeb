/**
 * Same formula as AvatarPromptService stepContext (UC-0004 / UC-0009).
 * Caps between 2s and 12s based on timeline gaps to the next step.
 */
export function computeSuggestedDurationSec(input: {
  elapsedMs: number;
  nextElapsedMs: number | null;
  gapMs: number;
}): number {
  const startSec = input.elapsedMs / 1000;
  const endSec =
    input.nextElapsedMs !== null
      ? Math.max(startSec + 2, input.nextElapsedMs / 1000)
      : startSec + Math.max(3, input.gapMs > 0 ? input.gapMs / 1000 : 4);
  return Math.max(2, Math.min(12, Math.round((endSec - startSec) * 10) / 10));
}

export function transitionOverlapSeconds(transition: string): number {
  switch (transition) {
    case 'cut-soft':
      return 0.45;
    case 'crossfade-short':
      return 0.7;
    case 'section-pause':
      return 0.95;
    default:
      return 0.55;
  }
}
