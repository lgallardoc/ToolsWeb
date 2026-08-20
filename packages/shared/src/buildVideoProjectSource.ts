import { parseStepNarrationTable } from './distributeScriptToSteps.js';
import { narrationFromCaptureSession } from './narrationFromSession.js';
import { assignStickyMenuModules } from './assignStickyMenuModules.js';
import { computeSuggestedDurationSec } from './suggestedDuration.js';
import type { CaptureStep, TutorialSession } from './types/tutorial.js';
import {
  VideoProjectSourceSchema,
  type VideoProjectSource,
  type VideoSourceStep,
  type VideoTypedError,
} from './types/video.js';

function elapsedGap(steps: CaptureStep[]): {
  originMs: number;
  byIndex: Array<{ elapsedMs: number; gapMs: number }>;
} {
  const firstAt = Date.parse(steps[0]?.timestamp ?? '');
  const originMs = Number.isFinite(firstAt) ? firstAt : Date.now();
  let previousMs: number | null = null;
  const byIndex = steps.map((step) => {
    const at = Date.parse(step.timestamp);
    const elapsedMs = Number.isFinite(at) ? Math.max(0, Math.round(at - originMs)) : 0;
    const gapMs =
      previousMs !== null && Number.isFinite(at)
        ? Math.max(0, Math.round(at - previousMs))
        : 0;
    previousMs = Number.isFinite(at) ? at : previousMs;
    return { elapsedMs, gapMs };
  });
  return { originMs, byIndex };
}

function semanticFallback(step: CaptureStep): string {
  const bits = [
    step.closestHeader,
    step.formContext,
    step.ariaLabel,
    step.target.text,
    step.description,
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return bits[0] ?? '';
}

/**
 * Resolve per-step narration for video (UC-0009). Does not call LLMs.
 */
export function resolveStepNarrations(session: TutorialSession): Map<number, string> {
  const map = new Map<number, string>();

  for (const step of session.steps) {
    const spoken = step.avatarScript?.spokenText?.trim();
    if (spoken) map.set(step.stepNumber, spoken);
  }

  const raw = (session.productionScript ?? session.fullScript?.spokenText ?? '').trim();
  if (raw) {
    const table = parseStepNarrationTable(raw);
    if (table) {
      for (const [n, text] of table.byStepNumber) {
        if (!map.has(n) && text.trim()) map.set(n, text.trim());
      }
    }
  }

  const draft = narrationFromCaptureSession(session, { includeNavigate: true });
  for (const line of draft.steps) {
    // draft uses sequence; approximate by index → stepNumber when lengths match
  }
  if (draft.steps.length === session.steps.length) {
    session.steps.forEach((step, i) => {
      if (!map.has(step.stepNumber)) {
        const spoken = draft.steps[i]?.spokenText?.trim();
        if (spoken) map.set(step.stepNumber, spoken);
      }
    });
  }

  for (const step of session.steps) {
    if (!map.has(step.stepNumber)) {
      const fb = semanticFallback(step);
      if (fb) map.set(step.stepNumber, fb);
    }
  }

  return map;
}

export type BuildVideoProjectSourceResult =
  | { ok: true; source: VideoProjectSource }
  | { ok: false; errors: VideoTypedError[] };

/**
 * Pure mapper: hydrated TutorialSession → VideoProjectSource (UC-0009).
 */
export function buildVideoProjectSource(
  session: TutorialSession,
  options?: { language?: string }
): BuildVideoProjectSourceResult {
  const errors: VideoTypedError[] = [];
  if (!session.steps.length) {
    return {
      ok: false,
      errors: [
        {
          code: 'VIDEO_SESSION_EMPTY',
          stage: 'source-loading',
          sessionId: session.id,
          message: 'La sesión no tiene pasos.',
          recommendation: 'Graba de nuevo o elige otra sesión de la bitácora.',
        },
      ],
    };
  }

  const seen = new Map<number, number>();
  const duplicated: number[] = [];
  for (const step of session.steps) {
    const count = (seen.get(step.stepNumber) ?? 0) + 1;
    seen.set(step.stepNumber, count);
    if (count === 2) duplicated.push(step.stepNumber);
  }
  if (duplicated.length) {
    return {
      ok: false,
      errors: [
        {
          code: 'VIDEO_DUPLICATED_STEP',
          stage: 'source-loading',
          sessionId: session.id,
          message: `stepNumber duplicados: ${duplicated.join(', ')}`,
          recommendation: 'Corrige la bitácora o regenera la captura.',
        },
      ],
    };
  }

  const narrations = resolveStepNarrations(session);
  const { byIndex } = elapsedGap(session.steps);
  const stepsWithModules = assignStickyMenuModules(session.steps);
  const steps: VideoSourceStep[] = [];

  stepsWithModules.forEach((step, index) => {
    const sceneNumber = index + 1;
    const hasImage = Boolean(step.imageBase64 || step.screenshotPath);
    if (!hasImage) {
      errors.push({
        code: 'VIDEO_IMAGE_NOT_FOUND',
        stage: 'source-loading',
        sessionId: session.id,
        stepNumber: step.stepNumber,
        message: `Falta captura para el paso ${step.stepNumber}.`,
        recommendation: 'Reabre la sesión con withImages o re-graba el paso.',
      });
    }

    const dataUrl = step.imageBase64
      ? `data:image/png;base64,${step.imageBase64}`
      : undefined;

    const timing = byIndex[index]!;
    const nextElapsed = index + 1 < byIndex.length ? byIndex[index + 1]!.elapsedMs : null;
    const suggestedDurationSec = computeSuggestedDurationSec({
      elapsedMs: timing.elapsedMs,
      nextElapsedMs: nextElapsed,
      gapMs: timing.gapMs,
    });
    steps.push({
      sceneNumber,
      stepNumber: step.stepNumber,
      action: step.action,
      description: step.description,
      ...(step.target.text ? { targetText: step.target.text } : {}),
      ...(step.closestHeader ? { closestHeader: step.closestHeader } : {}),
      ...(step.menuModule ? { menuModule: step.menuModule } : {}),
      ...(step.menuModuleIndex ? { menuModuleIndex: step.menuModuleIndex } : {}),
      elapsedMs: timing.elapsedMs,
      gapMs: timing.gapMs,
      suggestedDurationSec,
      narration: narrations.get(step.stepNumber) ?? '',
      screenshot: {
        mediaType: 'image/png',
        ...(dataUrl ? { dataUrl } : {}),
        // path intentionally omitted for API safety; renderer writes under exports/
      },
      ...(step.target.boundingBox
        ? {
            highlight: {
              x: step.target.boundingBox.x,
              y: step.target.boundingBox.y,
              width: step.target.boundingBox.width,
              height: step.target.boundingBox.height,
            },
          }
        : {}),
      ...(step.target.clickPoint ? { clickPoint: step.target.clickPoint } : {}),
    });
  });

  if (errors.some((e) => e.code === 'VIDEO_IMAGE_NOT_FOUND')) {
    return { ok: false, errors };
  }

  const parsed = VideoProjectSourceSchema.safeParse({
    sessionId: session.id,
    title: session.title,
    language: options?.language ?? 'es',
    originTimestamp: session.steps[0]?.timestamp,
    ...(session.productionScript
      ? { productionScript: session.productionScript }
      : {}),
    ...(session.fullScript?.spokenText
      ? { fullScriptSpokenText: session.fullScript.spokenText }
      : {}),
    steps,
  });

  if (!parsed.success) {
    return {
      ok: false,
      errors: [
        {
          code: 'VIDEO_VALIDATION_FAILED',
          stage: 'source-loading',
          sessionId: session.id,
          message: parsed.error.message,
          recommendation: 'Revisa el shape de VideoProjectSource en shared.',
        },
      ],
    };
  }

  return { ok: true, source: parsed.data };
}
