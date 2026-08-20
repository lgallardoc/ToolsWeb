import { z } from 'zod';

/** Screenshot payload for one scene (UC-0009). */
export const VideoScreenshotRefSchema = z.object({
  mediaType: z.literal('image/png'),
  /** Absolute path only when writing under exports/ (never expose .enc internals to UI). */
  path: z.string().optional(),
  dataUrl: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});
export type VideoScreenshotRef = z.infer<typeof VideoScreenshotRefSchema>;

export const VideoHighlightSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type VideoHighlight = z.infer<typeof VideoHighlightSchema>;

export const VideoClickPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type VideoClickPoint = z.infer<typeof VideoClickPointSchema>;

export const VideoSourceStepSchema = z.object({
  sceneNumber: z.number().int().positive(),
  stepNumber: z.number().int().positive(),
  action: z.string().min(1),
  description: z.string().optional(),
  targetText: z.string().optional(),
  closestHeader: z.string().optional(),
  /** Sticky main-menu module (UC-0011); bumper uses changes of this value. */
  menuModule: z.string().optional(),
  /** Interstitial group number (1-based); not CaptureStep.stepNumber. */
  menuModuleIndex: z.number().int().positive().optional(),
  elapsedMs: z.number().nonnegative().optional(),
  gapMs: z.number().nonnegative().optional(),
  /** Same as avatar prompt JSON `suggestedDurationSec` (UC-0004). */
  suggestedDurationSec: z.number().positive().optional(),
  narration: z.string(),
  screenshot: VideoScreenshotRefSchema,
  highlight: VideoHighlightSchema.optional(),
  clickPoint: VideoClickPointSchema.optional(),
});
export type VideoSourceStep = z.infer<typeof VideoSourceStepSchema>;

export const VideoProjectSourceSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().min(1),
  language: z.string().min(2).default('es'),
  originTimestamp: z.string().optional(),
  productionScript: z.string().optional(),
  fullScriptSpokenText: z.string().optional(),
  steps: z.array(VideoSourceStepSchema).min(1),
});
export type VideoProjectSource = z.infer<typeof VideoProjectSourceSchema>;

export const VideoStoryboardSceneSchema = z.object({
  sceneNumber: z.number().int().positive(),
  stepNumber: z.number().int().positive(),
  action: z.string().min(1),
  narration: z.string(),
  startTimeSeconds: z.number().nonnegative(),
  endTimeSeconds: z.number().positive(),
  durationSeconds: z.number().positive(),
  originalElapsedMs: z.number().nonnegative().optional(),
  originalGapMs: z.number().nonnegative().optional(),
  imageFile: z.string().min(1),
  audioFile: z.string().optional(),
  /** Measured narration WAV length; next scene must not start before this ends (+ pad). */
  audioDurationSeconds: z.number().nonnegative().optional(),
  /** Pre-roll “Iniciaremos el paso N” (UC-0009 bumper). */
  bumperEnabled: z.boolean().optional(),
  bumperText: z.string().optional(),
  bumperAudioFile: z.string().optional(),
  bumperAudioDurationSeconds: z.number().nonnegative().optional(),
  bumperPauseSeconds: z.number().nonnegative().optional(),
  /** Sticky module label used for bumper-on-change (UC-0011). */
  menuModule: z.string().optional(),
  /** Interstitial “Paso N” group index (UC-0011). */
  menuModuleIndex: z.number().int().positive().optional(),
  highlight: VideoHighlightSchema.optional(),
  clickPoint: VideoClickPointSchema.optional(),
  sourceWidth: z.number().positive().optional(),
  sourceHeight: z.number().positive().optional(),
  cursorAction: z.string().min(1),
  transition: z.string().min(1),
  /** Visual-only crossfade into the next scene (seconds); applied after audio + pad. */
  transitionOverlapSeconds: z.number().nonnegative().optional(),
  visualInstruction: z.string(),
});
export type VideoStoryboardScene = z.infer<typeof VideoStoryboardSceneSchema>;

export const VideoStoryboardSchema = z.object({
  version: z.literal(1),
  sessionId: z.string().uuid(),
  title: z.string().min(1),
  language: z.string().min(2),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  scenes: z.array(VideoStoryboardSceneSchema).min(1),
});
export type VideoStoryboard = z.infer<typeof VideoStoryboardSchema>;

export const VideoRenderJobStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
]);
export type VideoRenderJobStatus = z.infer<typeof VideoRenderJobStatusSchema>;

export const VideoRenderJobSchema = z.object({
  jobId: z.string().uuid(),
  sessionId: z.string().uuid(),
  status: VideoRenderJobStatusSchema,
  progress: z.number().min(0).max(100),
  outputPath: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type VideoRenderJob = z.infer<typeof VideoRenderJobSchema>;

export const VideoValidationReportSchema = z.object({
  valid: z.boolean(),
  sessionId: z.string().uuid(),
  expectedScenes: z.number().int().nonnegative(),
  generatedScenes: z.number().int().nonnegative(),
  missingImages: z.array(z.number().int().positive()),
  missingNarrations: z.array(z.number().int().positive()),
  duplicatedStepNumbers: z.array(z.number().int().positive()),
  warnings: z.array(z.string()),
  video: z
    .object({
      generated: z.boolean(),
      path: z.string().optional(),
      durationSeconds: z.number().nonnegative().optional(),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      fps: z.number().positive().optional(),
      audioPresent: z.boolean().optional(),
    })
    .optional(),
});
export type VideoValidationReport = z.infer<typeof VideoValidationReportSchema>;

export const VideoErrorCodeSchema = z.enum([
  'VIDEO_SESSION_NOT_FOUND',
  'VIDEO_SESSION_EMPTY',
  'VIDEO_DUPLICATED_STEP',
  'VIDEO_IMAGE_NOT_FOUND',
  'VIDEO_NARRATION_PROVIDER_UNAVAILABLE',
  'VIDEO_AUDIO_GENERATION_FAILED',
  'VIDEO_RENDER_FAILED',
  'VIDEO_VALIDATION_FAILED',
  'VIDEO_PACKAGE_FAILED',
]);
export type VideoErrorCode = z.infer<typeof VideoErrorCodeSchema>;

export const VideoTypedErrorSchema = z.object({
  code: VideoErrorCodeSchema,
  stage: z.string().min(1),
  sessionId: z.string().optional(),
  stepNumber: z.number().int().positive().optional(),
  message: z.string().min(1),
  recommendation: z.string().min(1),
});
export type VideoTypedError = z.infer<typeof VideoTypedErrorSchema>;
