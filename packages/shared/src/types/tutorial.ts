import { z } from 'zod';
import {
  AvatarScriptSchema,
  FullAvatarScriptSchema,
} from './script.js';

/** Bounding box of a targeted DOM element (CSS pixels). */
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const CaptureActionSchema = z.enum(['click', 'input', 'select', 'navigate']);
export type CaptureAction = z.infer<typeof CaptureActionSchema>;

export const CaptureTargetSchema = z.object({
  tagName: z.string().min(1),
  selector: z.string().min(1),
  text: z.string().optional(),
  boundingBox: BoundingBoxSchema.optional(),
  /** Viewport coordinates of the pointer for click captures. */
  clickPoint: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});
export type CaptureTarget = z.infer<typeof CaptureTargetSchema>;

/**
 * A single captured interaction step inside a tutorial session.
 * Prefer `screenshotPath` for on-disk artifacts; `imageBase64` for export payloads.
 * Enriched metadata + avatarScript are populated when ENABLE_AVATAR_SCRIPT is on (UC-0003/0004).
 */
export const CaptureStepSchema = z.object({
  id: z.string().uuid(),
  stepNumber: z.number().int().positive(),
  timestamp: z.string().datetime(),
  url: z.string().url(),
  action: CaptureActionSchema,
  target: CaptureTargetSchema,
  screenshotPath: z.string().optional(),
  imageBase64: z.string().optional(),
  description: z.string().min(1),
  /** Accessible name via aria-label on the target (UC-0003). */
  ariaLabel: z.string().optional(),
  /** Nearest heading text providing section context (UC-0003). */
  closestHeader: z.string().optional(),
  /** Nearest form/fieldset label context (UC-0003). */
  formContext: z.string().optional(),
  /** Placeholder text for input/textarea targets (UC-0003). */
  placeholder: z.string().optional(),
  /** AI voiceover for this step (UC-0004). */
  avatarScript: AvatarScriptSchema.optional(),
});
export type CaptureStep = z.infer<typeof CaptureStepSchema>;

export const TutorialSessionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  steps: z.array(CaptureStepSchema),
  /**
   * Prompt listo para pegar en cualquier AI (UC-0004).
   * Se genera al stop cuando ENABLE_AVATAR_SCRIPT está activo — sin llamar providers.
   */
  avatarPrompt: z.string().optional(),
  /** Locución guardada tras pegar la respuesta de la AI (UC-0004). */
  fullScript: FullAvatarScriptSchema.optional(),
});
export type TutorialSession = z.infer<typeof TutorialSessionSchema>;

/** Bitácora entry (listado sin steps/payloads pesados). */
export const TutorialSessionSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  stepCount: z.number().int().nonnegative(),
  stoppedAt: z.string().datetime(),
});
export type TutorialSessionSummary = z.infer<typeof TutorialSessionSummarySchema>;

/** Browser engine used for capture (Playwright). `chrome` = Google Chrome instalado. */
export const CaptureBrowserSchema = z.enum(['chromium', 'chrome', 'firefox', 'webkit']);
export type CaptureBrowser = z.infer<typeof CaptureBrowserSchema>;

/** Request body for starting a recording session. */
export const StartSessionRequestSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1).optional(),
  headless: z.boolean().optional().default(false),
  browser: CaptureBrowserSchema.optional().default('chrome'),
  /** Persist cookies/logins under data/browser-profiles/<browser>. Default true. */
  persistentProfile: z.boolean().optional().default(true),
  /**
   * Start without saved cookies (ephemeral profile) so login is required /
   * another user can be chosen. Overrides persistentProfile for this start.
   */
  freshLogin: z.boolean().optional().default(false),
  /**
   * Per-session override for ENABLE_AVATAR_SCRIPT (UC-0004).
   * When omitted, backend env default applies.
   */
  enableAvatarScript: z.boolean().optional(),
});
export type StartSessionRequest = z.infer<typeof StartSessionRequestSchema>;

/** Request body for stopping a recording session. */
export const StopSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type StopSessionRequest = z.infer<typeof StopSessionRequestSchema>;

/** Request body for export endpoints. */
export const ExportRequestSchema = z.object({
  session: TutorialSessionSchema,
});
export type ExportRequest = z.infer<typeof ExportRequestSchema>;
