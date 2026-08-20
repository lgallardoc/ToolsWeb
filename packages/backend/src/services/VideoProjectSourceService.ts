import {
  buildVideoProjectSource,
  sanitizeTutorialSession,
  type TutorialSession,
  type VideoProjectSource,
  type VideoTypedError,
} from '@toolsweb/shared';
import { SessionLogService } from './SessionLogService.js';

/**
 * Loads a bitácora session (decrypted + hydrated images) into VideoProjectSource.
 * Does not render video (UC-0009 / ADR-0007).
 */
export class VideoProjectSourceService {
  constructor(private readonly sessionLog = new SessionLogService()) {}

  async load(
    sessionId: string
  ): Promise<
    | { ok: true; source: VideoProjectSource; session: TutorialSession }
    | { ok: false; errors: VideoTypedError[] }
  > {
    const session = await this.sessionLog.get(sessionId, { withImages: true });
    if (!session) {
      return {
        ok: false,
        errors: [
          {
            code: 'VIDEO_SESSION_NOT_FOUND',
            stage: 'source-loading',
            sessionId,
            message: `Sesión no encontrada: ${sessionId}`,
            recommendation: 'Verifica el id en la bitácora (GET /api/sessions).',
          },
        ],
      };
    }
    const safe = sanitizeTutorialSession(session);
    const built = buildVideoProjectSource(safe, { language: 'es' });
    if (!built.ok) return built;
    return { ok: true, source: built.source, session: safe };
  }
}
