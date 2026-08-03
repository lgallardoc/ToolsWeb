import type { CaptureStep, TutorialSession } from './types/tutorial.js';
import { sanitizeTutorialText, sanitizeTutorialUrl } from './privacy.js';

/**
 * Scrub sensitive URL query/tokens from a session for UI + export.
 * Does **not** drop steps — OAuth screens may still be part of the tutorial visually.
 */
export function sanitizeTutorialSession(session: TutorialSession): TutorialSession {
  const steps: CaptureStep[] = session.steps.map((step, index) => ({
    ...step,
    stepNumber: index + 1,
    url: sanitizeTutorialUrl(step.url),
    description: sanitizeTutorialText(step.description),
    ...(step.ariaLabel !== undefined
      ? { ariaLabel: sanitizeTutorialText(step.ariaLabel) }
      : {}),
    ...(step.closestHeader !== undefined
      ? { closestHeader: sanitizeTutorialText(step.closestHeader) }
      : {}),
    ...(step.formContext !== undefined
      ? { formContext: sanitizeTutorialText(step.formContext) }
      : {}),
    ...(step.placeholder !== undefined
      ? { placeholder: sanitizeTutorialText(step.placeholder) }
      : {}),
    ...(step.avatarScript
      ? {
          avatarScript: {
            spokenText: sanitizeTutorialText(step.avatarScript.spokenText),
            ssmlText: sanitizeTutorialText(step.avatarScript.ssmlText),
            estimatedDurationSec: step.avatarScript.estimatedDurationSec,
          },
        }
      : {}),
    target: {
      ...step.target,
      ...(step.target.text !== undefined
        ? { text: sanitizeTutorialText(step.target.text) }
        : {}),
    },
  }));

  return {
    ...session,
    steps,
    ...(session.avatarPrompt !== undefined
      ? { avatarPrompt: sanitizeTutorialText(session.avatarPrompt) }
      : {}),
    ...(session.fullScript
      ? {
          fullScript: {
            spokenText: sanitizeTutorialText(session.fullScript.spokenText),
            ssmlText: sanitizeTutorialText(session.fullScript.ssmlText),
            estimatedDurationSec: session.fullScript.estimatedDurationSec,
          },
        }
      : {}),
  };
}
