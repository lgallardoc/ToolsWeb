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
    /** When true: enriched metadata on capture + avatar prompt on stop (no LLM APIs). */
    ENABLE_AVATAR_SCRIPT: boolFromEnv.optional().default(true),
    CORS_ORIGIN: z.string().optional(),
  })
  .transform((raw) => {
    const port = raw.BACKEND_PORT ?? raw.PORT ?? 4410;
    const host = raw.BACKEND_HOST ?? raw.HOST ?? '127.0.0.1';
    const enableAvatarScript = raw.ENABLE_AVATAR_SCRIPT ?? true;
    return {
      port,
      host,
      enableAvatarScript,
      corsOrigin: raw.CORS_ORIGIN,
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
