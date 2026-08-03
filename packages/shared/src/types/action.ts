import { z } from 'zod';
import { filterFieldValue } from '../privacy.js';
import type { CaptureStep } from './tutorial.js';

/**
 * Canonical event-first action model (Prompt Maestro / ADR-0004–0005).
 * Coexists with CaptureStep used by the Playwright bridge.
 */

export const TutorialActionTypeSchema = z.enum([
  'click',
  'doubleClick',
  'input',
  'change',
  'submit',
  'navigation',
  'scroll',
  'keyboard',
  'interfaceChange',
  /** Bridge alias: custom list/select interactions. */
  'select',
]);
export type TutorialActionType = z.infer<typeof TutorialActionTypeSchema>;

/** CSS box + edges (Prompt Maestro SemanticTarget.boundingBox). */
export const SemanticBoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  top: z.number(),
  right: z.number(),
  bottom: z.number(),
  left: z.number(),
});
export type SemanticBoundingBox = z.infer<typeof SemanticBoundingBoxSchema>;

export const ViewportStateSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  devicePixelRatio: z.number().positive(),
  scrollX: z.number(),
  scrollY: z.number(),
});
export type ViewportState = z.infer<typeof ViewportStateSchema>;

export const LocatorStrategySchema = z.enum([
  'testId',
  'roleAndName',
  'label',
  'placeholder',
  'text',
  'id',
  'name',
  'css',
]);
export type LocatorStrategy = z.infer<typeof LocatorStrategySchema>;

export const LocatorCandidateSchema = z.object({
  strategy: LocatorStrategySchema,
  value: z.string().min(1),
  score: z.number().min(0).max(100),
});
export type LocatorCandidate = z.infer<typeof LocatorCandidateSchema>;

export const SemanticTargetSchema = z.object({
  tagName: z.string().min(1),
  role: z.string().optional(),
  accessibleName: z.string().optional(),
  text: z.string().optional(),
  ariaLabel: z.string().optional(),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  inputType: z.string().optional(),
  closestHeader: z.string().optional(),
  formContext: z.string().optional(),
  sectionContext: z.string().optional(),
  breadcrumbContext: z.string().optional(),
  testId: z.string().optional(),
  href: z.string().optional(),
  locatorCandidates: z.array(LocatorCandidateSchema).default([]),
  boundingBox: SemanticBoundingBoxSchema.optional(),
});
export type SemanticTarget = z.infer<typeof SemanticTargetSchema>;

export const TutorialActionSourceSchema = z.enum([
  'content-script',
  'background',
  'history-hook',
  /** Playwright bridge (temporary — ADR-0004). */
  'playwright-bridge',
]);
export type TutorialActionSource = z.infer<typeof TutorialActionSourceSchema>;

export const TutorialActionSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  sequence: z.number().int().nonnegative(),
  type: TutorialActionTypeSchema,
  /** Epoch milliseconds (Prompt Maestro). */
  timestamp: z.number().int().nonnegative(),
  url: z.string().url(),
  pageTitle: z.string(),
  target: SemanticTargetSchema.optional(),
  value: z.string().optional(),
  previousValue: z.string().optional(),
  sensitive: z.boolean(),
  viewport: ViewportStateSchema,
  metadata: z.object({
    browser: z.string().optional(),
    frameId: z.string().optional(),
    source: TutorialActionSourceSchema,
  }),
  /** Human narrative line (deterministic or AI). Optional during capture. */
  narrative: z.string().optional(),
});
export type TutorialAction = z.infer<typeof TutorialActionSchema>;

export const ActionSessionStatusSchema = z.enum([
  'idle',
  'recording',
  'paused',
  'completed',
]);
export type ActionSessionStatus = z.infer<typeof ActionSessionStatusSchema>;

/** Event-first session (Prompt Maestro). Distinct from bridge TutorialSession. */
export const ActionSessionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: ActionSessionStatusSchema,
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative().optional(),
  initialUrl: z.string().url(),
  actions: z.array(TutorialActionSchema),
});
export type ActionSession = z.infer<typeof ActionSessionSchema>;

const DEFAULT_VIEWPORT: ViewportState = {
  width: 1440,
  height: 900,
  devicePixelRatio: 2,
  scrollX: 0,
  scrollY: 0,
};

function boxFromCapture(
  box: { x: number; y: number; width: number; height: number } | undefined
): SemanticBoundingBox | undefined {
  if (!box) return undefined;
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    top: box.y,
    left: box.x,
    right: box.x + box.width,
    bottom: box.y + box.height,
  };
}

function mapCaptureAction(
  action: CaptureStep['action']
): TutorialActionType {
  if (action === 'navigate') return 'navigation';
  if (action === 'select') return 'select';
  if (action === 'input') return 'input';
  return 'click';
}

/**
 * Best-effort bridge mapper (ADR-0005) with PrivacyFilter (Prompt Maestro §8).
 */
export function captureStepToTutorialAction(
  step: CaptureStep,
  sessionId: string,
  options?: { viewport?: ViewportState; browser?: string }
): TutorialAction {
  const timestampMs = Date.parse(step.timestamp);
  const boundingBox = boxFromCapture(step.target.boundingBox);
  const locatorCandidates: LocatorCandidate[] = [
    {
      strategy: 'css',
      value: step.target.selector,
      score: 40,
    },
  ];
  if (step.ariaLabel) {
    locatorCandidates.unshift({
      strategy: 'roleAndName',
      value: step.ariaLabel,
      score: 80,
    });
  }
  if (step.placeholder) {
    locatorCandidates.unshift({
      strategy: 'placeholder',
      value: step.placeholder,
      score: 70,
    });
  }

  const rawValue = step.target.text ?? '';
  const hint = {
    selector: step.target.selector,
    description: step.description,
    ...(step.placeholder !== undefined ? { placeholder: step.placeholder } : {}),
    ...(step.ariaLabel !== undefined ? { ariaLabel: step.ariaLabel } : {}),
    ...(step.formContext !== undefined ? { label: step.formContext } : {}),
    ...(/password/i.test(`${step.target.selector} ${step.description}`)
      ? { inputType: 'password' }
      : {}),
  };
  const filtered = filterFieldValue(rawValue, hint);

  return TutorialActionSchema.parse({
    id: step.id,
    sessionId,
    sequence: step.stepNumber,
    type: mapCaptureAction(step.action),
    timestamp: Number.isFinite(timestampMs) ? timestampMs : 0,
    url: step.url,
    pageTitle: '',
    target: {
      tagName: step.target.tagName,
      text: filtered.value || step.target.text,
      ariaLabel: step.ariaLabel,
      placeholder: step.placeholder,
      closestHeader: step.closestHeader,
      formContext: step.formContext,
      locatorCandidates,
      ...(boundingBox ? { boundingBox } : {}),
    },
    value: filtered.value || undefined,
    sensitive: filtered.sensitive,
    viewport: options?.viewport ?? DEFAULT_VIEWPORT,
    metadata: {
      ...(options?.browser ? { browser: options.browser } : {}),
      source: 'playwright-bridge',
    },
    narrative: step.description,
  });
}
