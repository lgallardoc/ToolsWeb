import { z } from 'zod';

/** Per-step AI avatar voiceover (UC-0004). */
export const AvatarScriptSchema = z.object({
  spokenText: z.string().min(1),
  /** SSML with breaks suitable for HeyGen / Synthesia / ElevenLabs-style pipelines. */
  ssmlText: z.string().min(1),
  estimatedDurationSec: z.number().positive(),
});
export type AvatarScript = z.infer<typeof AvatarScriptSchema>;

/** Aggregated session voiceover. */
export const FullAvatarScriptSchema = z.object({
  spokenText: z.string().min(1),
  ssmlText: z.string().min(1),
  estimatedDurationSec: z.number().nonnegative(),
});
export type FullAvatarScript = z.infer<typeof FullAvatarScriptSchema>;

/**
 * Optional structured reply from an external AI when the user pastes JSON.
 * Plain narrative text is also accepted by the import endpoint.
 */
export const AvatarScriptLlmResponseSchema = z.object({
  steps: z
    .array(
      z.object({
        stepNumber: z.number().int().positive(),
        spokenText: z.string().min(1),
        ssmlText: z.string().min(1).optional(),
        estimatedDurationSec: z.number().positive().optional(),
      })
    )
    .optional(),
  fullSpokenText: z.string().min(1).optional(),
  fullSsmlText: z.string().min(1).optional(),
  spokenText: z.string().min(1).optional(),
});
export type AvatarScriptLlmResponse = z.infer<typeof AvatarScriptLlmResponseSchema>;

/** Body: paste AI response to attach as session script. */
export const ImportAvatarScriptRequestSchema = z.object({
  /** Raw paste from any AI (plain script or JSON). */
  scriptText: z.string().min(1),
});
export type ImportAvatarScriptRequest = z.infer<typeof ImportAvatarScriptRequestSchema>;
