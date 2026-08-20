import type { VideoTypedError } from '@toolsweb/shared';

export class VideoRenderError extends Error {
  readonly typed: VideoTypedError;

  constructor(typed: VideoTypedError) {
    super(typed.message);
    this.name = 'VideoRenderError';
    this.typed = typed;
  }
}

export function toPublicError(err: unknown): VideoTypedError {
  if (err instanceof VideoRenderError) return err.typed;
  return {
    code: 'VIDEO_RENDER_FAILED',
    stage: 'unknown',
    message: err instanceof Error ? err.message : String(err),
    recommendation: 'Revisa logs de desarrollo y validation-report.json.',
  };
}
