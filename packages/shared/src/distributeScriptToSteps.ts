import type { CaptureStep } from './types/tutorial.js';
import type { AvatarScript } from './types/script.js';

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

function toAvatarScript(spokenText: string): AvatarScript {
  const spoken = spokenText.trim();
  return {
    spokenText: spoken,
    ssmlText: plainToSsml(spoken),
    estimatedDurationSec: estimateDurationSec(spoken),
  };
}

function clearAvatarScript(step: CaptureStep): CaptureStep {
  if (!step.avatarScript) return step;
  const { avatarScript: _removed, ...rest } = step;
  return rest;
}

export type ParsedStepNarrationTable = {
  byStepNumber: Map<number, string>;
  /** Locución limpia (columna Narración, ordenada por paso). */
  spokenConcat: string;
  notes: string[];
  visualByStep: Map<number, string>;
};

/**
 * Detects Synthesia / production tables:
 * `Paso \\t Tiempo \\t Duración \\t Acción visual \\t Narración`
 */
export function parseStepNarrationTable(raw: string): ParsedStepNarrationTable | null {
  const byStepNumber = new Map<number, string>();
  const visualByStep = new Map<number, string>();
  const notes: string[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (line.includes('\t')) {
      const cols = line.split('\t').map((c) => c.trim());
      const head = cols[0] ?? '';
      if (/^paso$/i.test(head)) continue;

      if (/^\d+$/.test(head) && cols.length >= 2) {
        const stepNumber = Number(head);
        const narration = (cols[cols.length - 1] ?? '').trim();
        if (!narration || /^narraci[oó]n$/i.test(narration)) continue;
        byStepNumber.set(stepNumber, narration);
        if (cols.length >= 5) {
          const visual = (cols[3] ?? '').trim();
          if (visual) visualByStep.set(stepNumber, visual);
        }
        continue;
      }
    }

    if (/^secci[oó]n\s+\d+/i.test(trimmed) || /^precisi[oó]n\b/i.test(trimmed)) {
      notes.push(trimmed);
    }
  }

  if (byStepNumber.size < 2) return null;

  const spokenConcat = [...byStepNumber.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, text]) => text)
    .join('\n\n');

  return { byStepNumber, spokenConcat, notes, visualByStep };
}

/**
 * Split a full voiceover into subtitle chunks (paragraphs, else sentences).
 */
export function splitSpokenParagraphs(spokenText: string): string[] {
  const trimmed = spokenText.trim();
  if (!trimmed) return [];

  let parts = trimmed
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    parts = trimmed
      .split(/(?<=[.!?…])\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  return parts.length > 0 ? parts : [trimmed];
}

function distributeByParagraphs(
  steps: CaptureStep[],
  spokenText: string
): CaptureStep[] {
  const paragraphs = splitSpokenParagraphs(spokenText);
  if (paragraphs.length === 0) {
    return steps.map(clearAvatarScript);
  }

  const interactiveIndexes = steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.action !== 'navigate')
    .map(({ index }) => index);
  const targets =
    interactiveIndexes.length > 0
      ? interactiveIndexes
      : steps.map((_, index) => index);

  const byIndex = new Map<number, string>();
  if (paragraphs.length <= targets.length) {
    for (let j = 0; j < paragraphs.length; j++) {
      byIndex.set(targets[j]!, paragraphs[j]!);
    }
  } else {
    for (let j = 0; j < targets.length; j++) {
      if (j < targets.length - 1) {
        byIndex.set(targets[j]!, paragraphs[j]!);
      } else {
        byIndex.set(targets[j]!, paragraphs.slice(j).join('\n\n'));
      }
    }
  }

  return steps.map((step, index) => {
    const spoken = byIndex.get(index);
    if (!spoken) return clearAvatarScript(step);
    return { ...step, avatarScript: toAvatarScript(spoken) };
  });
}

/**
 * Maps spoken/script text onto steps for preview subtitles (UC-0004).
 * Prefer per-step Narración tables; else paragraphs → interactive steps.
 */
export function distributeSpokenToSteps(
  steps: CaptureStep[],
  spokenText: string
): CaptureStep[] {
  const table = parseStepNarrationTable(spokenText);
  if (table) {
    return steps.map((step) => {
      const spoken = table.byStepNumber.get(step.stepNumber);
      if (!spoken) return clearAvatarScript(step);
      return { ...step, avatarScript: toAvatarScript(spoken) };
    });
  }
  return distributeByParagraphs(steps, spokenText);
}

/**
 * Voiceover text for `fullScript` (clean narrations if table detected).
 */
export function resolveSpokenForFullScript(raw: string): {
  spokenText: string;
  table: ParsedStepNarrationTable | null;
} {
  const table = parseStepNarrationTable(raw);
  if (table) return { spokenText: table.spokenConcat, table };
  return { spokenText: raw.trim(), table: null };
}
