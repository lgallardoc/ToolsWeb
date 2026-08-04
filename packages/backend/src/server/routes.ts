import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  ExportRequestSchema,
  ImportAvatarScriptRequestSchema,
  StartSessionRequestSchema,
  StopSessionRequestSchema,
  sanitizeTutorialSession,
} from '@toolsweb/shared';
import { getEnv } from '../config/env.js';
import {
  HtmlExporterService,
  PdfExporterService,
  RecorderService,
  SessionLogService,
  AvatarPromptService,
} from '../services/index.js';
import { applyImportedAvatarScript } from '../services/importAvatarScript.js';

const recorder = new RecorderService();
const sessionLog = new SessionLogService();
const htmlExporter = new HtmlExporterService();
const pdfExporter = new PdfExporterService();
const avatarPrompt = new AvatarPromptService();

async function finalizeSession(session: Awaited<ReturnType<RecorderService['stop']>>) {
  const enriched = avatarPrompt.attachPrompt(session, {
    enableAvatarScript: recorder.isAvatarScriptEnabled(session.id),
  });
  const mem = recorder.get(enriched.id);
  if (mem) {
    mem.steps = enriched.steps;
    if (enriched.avatarPrompt) mem.avatarPrompt = enriched.avatarPrompt;
    if (enriched.fullScript) mem.fullScript = enriched.fullScript;
  }
  const summary = await sessionLog.save(enriched);
  return { session: enriched, summary };
}

recorder.setOnStoppedFromBrowser(async (session) => {
  await finalizeSession(session);
});

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export function createApiRouter(): Router {
  const router = Router();

  router.get(
    '/config',
    asyncHandler(async (_req, res) => {
      const env = getEnv();
      res.json({
        ok: true,
        enableAvatarScript: env.enableAvatarScript,
      });
    })
  );

  router.post(
    '/sessions/start',
    asyncHandler(async (req, res) => {
      const body = StartSessionRequestSchema.parse(req.body);
      const session = await recorder.start(body);
      res.status(201).json({ ok: true, session: sanitizeTutorialSession(session) });
    })
  );

  router.post(
    '/sessions/stop',
    asyncHandler(async (req, res) => {
      const body = StopSessionRequestSchema.parse(req.body);
      const stopped = await recorder.stop(body.sessionId);
      const { session, summary } = await finalizeSession(stopped);
      res.json({
        ok: true,
        session: sanitizeTutorialSession(session),
        summary,
      });
    })
  );

  router.get(
    '/sessions',
    asyncHandler(async (_req, res) => {
      const sessions = await sessionLog.list();
      const activeSessionId = recorder.getActiveSessionId();
      res.json({
        ok: true,
        sessions,
        activeSessionId,
        recording: Boolean(activeSessionId),
      });
    })
  );

  router.post(
    '/sessions/force-stop',
    asyncHandler(async (_req, res) => {
      const session = await recorder.forceStop();
      if (!session) {
        res.json({ ok: true, session: null, recording: false });
        return;
      }
      const { session: enriched, summary } = await finalizeSession(session);
      res.json({
        ok: true,
        session: sanitizeTutorialSession(enriched),
        summary,
        recording: false,
      });
    })
  );

  /** POST /api/sessions/:sessionId/avatar-script — paste AI reply as guión. */
  router.post(
    '/sessions/:sessionId/avatar-script',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      const body = ImportAvatarScriptRequestSchema.parse(req.body);
      let base =
        recorder.get(sessionId) ??
        (await sessionLog.get(sessionId, { withImages: false }));
      if (!base) {
        res.status(404).json({ ok: false, error: `Session not found: ${sessionId}` });
        return;
      }
      const updated = applyImportedAvatarScript(base, body.scriptText);
      const mem = recorder.get(sessionId);
      if (mem) {
        mem.fullScript = updated.fullScript;
        mem.steps = updated.steps;
        if (updated.productionScript) mem.productionScript = updated.productionScript;
        if (updated.videoPrompt) mem.videoPrompt = updated.videoPrompt;
      }
      await sessionLog.save(updated);
      const hydrated = await sessionLog.get(sessionId, { withImages: true });
      res.json({
        ok: true,
        session: sanitizeTutorialSession(hydrated ?? updated),
      });
    })
  );

  router.get(
    '/sessions/:sessionId',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      const withImages = String(req.query.withImages ?? '') === '1';
      const live = recorder.isRecording(sessionId) ? recorder.get(sessionId) : undefined;
      if (live) {
        res.json({ ok: true, session: sanitizeTutorialSession(live), source: 'live' });
        return;
      }
      let stored = await sessionLog.get(sessionId, { withImages });
      if (!stored) {
        const mem = recorder.get(sessionId);
        if (mem) {
          const withPrompt = avatarPrompt.attachPrompt(mem, {
            enableAvatarScript: recorder.isAvatarScriptEnabled(sessionId),
          });
          res.json({ ok: true, session: sanitizeTutorialSession(withPrompt), source: 'memory' });
          return;
        }
        res.status(404).json({ ok: false, error: `Session not found: ${sessionId}` });
        return;
      }
      // Refresh avatar prompt when missing or still on legacy narrative-only format.
      const needsPromptRefresh =
        getEnv().enableAvatarScript &&
        (!stored.avatarPrompt ||
          !stored.avatarPrompt.includes('synthesia_tsv_production_script'));
      if (needsPromptRefresh) {
        const withPrompt = avatarPrompt.attachPrompt(stored, {
          enableAvatarScript: true,
          force: true,
        });
        if (withPrompt.avatarPrompt) {
          await sessionLog.save(withPrompt);
          stored = withImages
            ? ((await sessionLog.get(sessionId, { withImages: true })) ?? withPrompt)
            : withPrompt;
        }
      }
      res.json({ ok: true, session: sanitizeTutorialSession(stored), source: 'log' });
    })
  );

  router.delete(
    '/sessions/:sessionId',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      if (recorder.isRecording(sessionId)) {
        res.status(409).json({
          ok: false,
          error: 'No se puede eliminar una sesión en grabación. Detén la captura primero.',
        });
        return;
      }
      const deleted = await sessionLog.delete(sessionId);
      if (!deleted) {
        res.status(404).json({ ok: false, error: `Session not found: ${sessionId}` });
        return;
      }
      res.json({ ok: true, deleted: sessionId });
    })
  );

  router.post(
    '/export/html',
    asyncHandler(async (req, res) => {
      const { session } = ExportRequestSchema.parse(req.body);
      const html = htmlExporter.export(sanitizeTutorialSession(session));
      const safeName = session.title.replace(/[^\w.-]+/g, '_').slice(0, 80);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName || 'tutorial'}.html"`
      );
      res.send(html);
    })
  );

  router.post(
    '/export/pdf',
    asyncHandler(async (req, res) => {
      const { session } = ExportRequestSchema.parse(req.body);
      const pdf = await pdfExporter.export(sanitizeTutorialSession(session));
      const safeName = session.title.replace(/[^\w.-]+/g, '_').slice(0, 80);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName || 'tutorial'}.pdf"`
      );
      res.send(pdf);
    })
  );

  router.post(
    '/export/html/:sessionId',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      const session = await sessionLog.get(sessionId, { withImages: true });
      if (!session) {
        res.status(404).json({ ok: false, error: `Session not found: ${sessionId}` });
        return;
      }
      const html = htmlExporter.export(session);
      const safeName = session.title.replace(/[^\w.-]+/g, '_').slice(0, 80);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName || 'tutorial'}.html"`
      );
      res.send(html);
    })
  );

  router.post(
    '/export/pdf/:sessionId',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      const session = await sessionLog.get(sessionId, { withImages: true });
      if (!session) {
        res.status(404).json({ ok: false, error: `Session not found: ${sessionId}` });
        return;
      }
      const pdf = await pdfExporter.export(session);
      const safeName = session.title.replace(/[^\w.-]+/g, '_').slice(0, 80);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${safeName || 'tutorial'}.pdf"`
      );
      res.send(pdf);
    })
  );

  return router;
}
