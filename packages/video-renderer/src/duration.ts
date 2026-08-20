import type { VideoSourceStep } from '@toolsweb/shared';
import { transitionOverlapSeconds } from '@toolsweb/shared';
import type { VideoRendererConfig } from './config.js';

const MIN_BY_ACTION: Record<string, number> = {
  navigate: 3,
  click: 2.5,
  select: 3,
  input: 3,
  focus: 2,
  verify: 2,
  interfaceChange: 2.5,
};

export function transitionForGapMs(gapMs: number, maxGapSeconds: number): {
  transition: string;
  gapContributionSeconds: number;
} {
  if (gapMs < 800) {
    return { transition: 'cut-soft', gapContributionSeconds: 0.35 };
  }
  if (gapMs <= 3000) {
    return { transition: 'crossfade-short', gapContributionSeconds: 0.55 };
  }
  return {
    transition: 'section-pause',
    gapContributionSeconds: Math.min(maxGapSeconds, 1.2),
  };
}

export function cursorActionFor(action: string): string {
  switch (action) {
    case 'click':
      return 'click-pulse';
    case 'select':
      return 'select-zoom';
    case 'input':
      return 'input-focus';
    case 'navigate':
      return 'section-fade';
    default:
      return 'hold';
  }
}

/**
 * Scene length = optional step bumper + audio (full) + pad + visual crossfade.
 * Overlap with the next scene is only the visual crossfade tail (after narration ends).
 */
export function computeSceneDurationSeconds(input: {
  step: VideoSourceStep;
  audioDurationSeconds: number;
  config: VideoRendererConfig;
  bumperHoldSeconds?: number;
}): number {
  const { step, audioDurationSeconds, config } = input;
  const bumperHold = Math.max(0, input.bumperHoldSeconds ?? 0);
  const silent = !step.narration.trim();
  const actionMin = silent ? 2 : (MIN_BY_ACTION[step.action] ?? 2.5);
  const { transition, gapContributionSeconds } = transitionForGapMs(
    step.gapMs ?? 0,
    config.maxGapSeconds
  );
  const crossfade = transitionOverlapSeconds(transition);
  const postPad = config.scenePaddingSeconds;
  const audioSynced =
    audioDurationSeconds > 0
      ? audioDurationSeconds + postPad + crossfade
      : postPad + crossfade;
  const suggested = step.suggestedDurationSec ?? 0;
  return (
    bumperHold +
    Math.max(actionMin, audioSynced, suggested, gapContributionSeconds, 2)
  );
}

export { transitionOverlapSeconds };
