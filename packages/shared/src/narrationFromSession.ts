import { randomUUID } from 'node:crypto';
import type { CaptureStep, TutorialSession } from './types/tutorial.js';
import { captureStepToTutorialAction } from './types/action.js';
import { generateDeterministicNarration } from './narrative.js';
import type { DeterministicNarration } from './narrative.js';

/**
 * Map a Playwright bridge session to a deterministic Spanish script (no LLM).
 */
export function narrationFromCaptureSession(
  session: TutorialSession,
  options?: { includeNavigate?: boolean; browser?: string }
): DeterministicNarration {
  const includeNavigate = options?.includeNavigate === true;
  const steps: CaptureStep[] = includeNavigate
    ? session.steps
    : session.steps.filter((s) => s.action !== 'navigate');
  const used = steps.length > 0 ? steps : session.steps;

  const actions = used.map((step) =>
    captureStepToTutorialAction(step, session.id, {
      ...(options?.browser ? { browser: options.browser } : {}),
    })
  );

  return generateDeterministicNarration(actions, { title: session.title });
}

/** Stable id helper for tests/fixtures. */
export function newSessionFixtureId(): string {
  return randomUUID();
}
