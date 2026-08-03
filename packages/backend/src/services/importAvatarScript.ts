import {
  AvatarScriptLlmResponseSchema,
  type CaptureStep,
  type FullAvatarScript,
  type TutorialSession,
} from '@toolsweb/shared';

function estimateDurationSec(spokenText: string): number {
  const words = spokenText.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, Math.round((words / 2.5 + 0.6) * 10) / 10);
}

function plainToSsml(spokenText: string): string {
  const parts = spokenText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return spokenText.trim();
  return parts.join('\n<break time="0.8s"/>\n');
}

function buildFull(
  spokenText: string,
  ssmlText?: string
): FullAvatarScript {
  const spoken = spokenText.trim();
  return {
    spokenText: spoken,
    ssmlText: (ssmlText?.trim() || plainToSsml(spoken)).trim(),
    estimatedDurationSec: estimateDurationSec(spoken),
  };
}

/**
 * Applies a pasted AI reply (plain narrative or optional JSON) onto a session.
 */
export function applyImportedAvatarScript(
  session: TutorialSession,
  scriptText: string
): TutorialSession {
  const raw = scriptText.trim();
  if (!raw) return session;

  // Try JSON first (user may follow a structured template).
  if (raw.startsWith('{')) {
    try {
      const parsed = AvatarScriptLlmResponseSchema.parse(JSON.parse(raw));
      let steps: CaptureStep[] = session.steps;
      if (parsed.steps && parsed.steps.length > 0) {
        const byNumber = new Map(parsed.steps.map((s) => [s.stepNumber, s]));
        steps = session.steps.map((step) => {
          const gen = byNumber.get(step.stepNumber);
          if (!gen) return step;
          const spokenText = gen.spokenText.trim();
          const ssmlText = (gen.ssmlText?.trim() || plainToSsml(spokenText)).trim();
          const estimatedDurationSec =
            gen.estimatedDurationSec && gen.estimatedDurationSec > 0
              ? gen.estimatedDurationSec
              : estimateDurationSec(spokenText);
          return {
            ...step,
            avatarScript: { spokenText, ssmlText, estimatedDurationSec },
          };
        });
      }

      const fullSpoken =
        parsed.fullSpokenText?.trim() ||
        parsed.spokenText?.trim() ||
        steps
          .map((s) => s.avatarScript?.spokenText)
          .filter((t): t is string => Boolean(t))
          .join('\n\n');

      if (!fullSpoken) {
        return { ...session, steps };
      }

      const fullScript = buildFull(fullSpoken, parsed.fullSsmlText);
      return { ...session, steps, fullScript };
    } catch {
      /* fall through to plain text */
    }
  }

  const fullScript = buildFull(raw);
  return { ...session, fullScript };
}
