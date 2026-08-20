import { z } from 'zod';

const boolFromEnv = z.preprocess((raw) => {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}, z.boolean());

const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().optional(),
    BACKEND_PORT: z.coerce.number().int().positive().optional(),
    BACKEND_HOST: z.string().min(1).optional(),
    HOST: z.string().min(1).optional(),
    FRONTEND_HOST: z.string().min(1).optional(),
    FRONTEND_PORT: z.coerce.number().int().positive().optional(),
    STUDIO_HOST: z.string().min(1).optional(),
    STUDIO_PORT: z.coerce.number().int().positive().optional(),
    /** When true: enriched metadata on capture + avatar prompt on stop (no LLM APIs). */
    ENABLE_AVATAR_SCRIPT: boolFromEnv.optional().default(true),
    CORS_ORIGIN: z.string().optional(),
    /** Poll interval for in-page capture queue (ms). Not video FPS — event density. */
    CAPTURE_QUEUE_DRAIN_MS: z.coerce.number().int().positive().optional(),
    /** Hold highlight ring before screenshot on interactions (ms). */
    CAPTURE_HIGHLIGHT_HOLD_MS: z.coerce.number().int().positive().optional(),
    /** Max settle wait for OAuth / sign-in navigations (ms). */
    CAPTURE_AUTH_NAVIGATE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  })
  .transform((raw) => {
    const port = raw.BACKEND_PORT ?? raw.PORT ?? 4410;
    const host = raw.BACKEND_HOST ?? raw.HOST ?? '127.0.0.1';
    const frontendHost = raw.FRONTEND_HOST ?? '127.0.0.1';
    const frontendPort = raw.FRONTEND_PORT ?? 5173;
    const studioHost = raw.STUDIO_HOST ?? '127.0.0.1';
    const studioPort = raw.STUDIO_PORT ?? 5174;
    const enableAvatarScript = raw.ENABLE_AVATAR_SCRIPT ?? true;
    const corsOrigin =
      raw.CORS_ORIGIN ?? `http://${frontendHost}:${frontendPort}`;
    return {
      port,
      host,
      frontendHost,
      frontendPort,
      studioHost,
      studioPort,
      enableAvatarScript,
      corsOrigin,
      captureQueueDrainMs: raw.CAPTURE_QUEUE_DRAIN_MS ?? 80,
      captureHighlightHoldMs: raw.CAPTURE_HIGHLIGHT_HOLD_MS ?? 90,
      captureAuthNavigateTimeoutMs: raw.CAPTURE_AUTH_NAVIGATE_TIMEOUT_MS ?? 8000,
    };
  });

export type AppEnv = z.infer<typeof EnvSchema>;

let cached: AppEnv | null = null;

export function getEnv(env: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached) return cached;
  cached = EnvSchema.parse(env);
  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}
