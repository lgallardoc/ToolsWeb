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
  VideoProjectSourceService,
} from '../services/index.js';
import { applyImportedAvatarScript } from '../services/importAvatarScript.js';
import {
  createVideoJob,
  getVideoJob,
  updateVideoJob,
  deleteVideoJobsForSession,
} from '../services/videoRenderJobs.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { assertSafeSessionId } from '../services/SessionLogService.js';

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
      try {
        assertSafeSessionId(sessionId);
      } catch {
        res.status(400).json({ ok: false, error: 'sessionId inválido' });
        return;
      }
      if (recorder.isRecording(sessionId)) {
        res.status(409).json({
          ok: false,
          error: 'No se puede eliminar una sesión en grabación. Detén la captura primero.',
        });
        return;
      }
      const result = await sessionLog.delete(sessionId);
      const jobRemoved = await deleteVideoJobsForSession(sessionId);
      const removed = [...result.removed, ...jobRemoved];
      if (!result.deleted && removed.length === 0) {
        res.status(404).json({ ok: false, error: `Session not found: ${sessionId}` });
        return;
      }
      res.json({ ok: true, deleted: sessionId, removed });
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

  const videoSource = new VideoProjectSourceService(sessionLog);
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

  /** Normalized audiovisual project (no render). */
  router.post(
    '/sessions/:sessionId/video-project',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      const loaded = await videoSource.load(sessionId);
      if (!loaded.ok) {
        res.status(404).json({ ok: false, errors: loaded.errors });
        return;
      }
      // Strip bulky dataUrls from JSON response — UI uses counts + narration flags.
      const light = {
        ...loaded.source,
        steps: loaded.source.steps.map((s) => ({
          ...s,
          screenshot: {
            mediaType: 'image/png' as const,
            hasImage: Boolean(s.screenshot.dataUrl),
          },
        })),
      };
      res.json({
        ok: true,
        source: light,
        stepCount: loaded.source.steps.length,
        withNarration: loaded.source.steps.filter((s) => s.narration.trim()).length,
        privacyWarning:
          'El video puede contener información visible en las capturas originales. Revísalo antes de compartirlo.',
      });
    })
  );

  /** Queue local MP4 + Clipchamp package job (non-blocking). */
  router.post(
    '/sessions/:sessionId/video-render',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      const body = (req.body ?? {}) as {
        silent?: boolean;
        stepBumper?: boolean;
        stepBumperSeconds?: number;
      };
      const silent = Boolean(body.silent);
      const job = await createVideoJob(sessionId);
      res.status(202).json({ ok: true, job });

      void (async () => {
        await updateVideoJob(job.jobId, { status: 'running', progress: 5 });
        try {
          const {
            buildVideoProjectArtifacts,
            assembleClipchampPackage,
            loadVideoRendererConfig,
            renderTutorialMp4,
          } = await import('@toolsweb/video-renderer');
          const loaded = await videoSource.load(sessionId);
          if (!loaded.ok) {
            await updateVideoJob(job.jobId, {
              status: 'failed',
              progress: 100,
              error: loaded.errors[0]?.message ?? 'source failed',
            });
            return;
          }
          await updateVideoJob(job.jobId, { progress: 20 });
          const config = loadVideoRendererConfig();
          if (silent) config.ttsProvider = 'silent';
          if (typeof body.stepBumper === 'boolean') {
            config.stepBumperEnabled = body.stepBumper;
          }
          if (
            typeof body.stepBumperSeconds === 'number' &&
            Number.isFinite(body.stepBumperSeconds) &&
            body.stepBumperSeconds >= 0
          ) {
            config.stepBumperSeconds = body.stepBumperSeconds;
          }
          const out = path.join(repoRoot, 'exports', 'video', sessionId);
          const built = await buildVideoProjectArtifacts({
            source: loaded.source,
            outputDir: out,
            config,
            forceSilent: silent || config.ttsProvider === 'silent',
          });
          await updateVideoJob(job.jobId, { progress: 55 });
          try {
            const rendered = await renderTutorialMp4({
              storyboard: built.storyboard,
              projectRoot: out,
              config,
            });
            await updateVideoJob(job.jobId, { progress: 85 });
            const pkg = await assembleClipchampPackage(out);
            await updateVideoJob(job.jobId, {
              status: 'completed',
              progress: 100,
              outputPath: pkg,
            });
            void rendered;
          } catch (e) {
            const pkg = await assembleClipchampPackage(out);
            await updateVideoJob(job.jobId, {
              status: 'failed',
              progress: 100,
              outputPath: pkg,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        } catch (e) {
          await updateVideoJob(job.jobId, {
            status: 'failed',
            progress: 100,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      })();
    })
  );

  router.get(
    '/sessions/:sessionId/video-render/:jobId',
    asyncHandler(async (req, res) => {
      const jobId = String(req.params.jobId ?? '');
      const job = await getVideoJob(jobId);
      if (!job || job.sessionId !== String(req.params.sessionId ?? '')) {
        res.status(404).json({ ok: false, error: 'Job not found' });
        return;
      }
      res.json({ ok: true, job });
    })
  );

  router.get(
    '/sessions/:sessionId/video-package',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      const zipOrDir = path.join(
        repoRoot,
        'exports',
        'video',
        sessionId,
        'clipchamp-package',
        'README-CLIPCHAMP.md'
      );
      try {
        await access(zipOrDir);
      } catch {
        res.status(404).json({
          ok: false,
          error: 'Paquete no generado. Ejecuta video-render primero.',
        });
        return;
      }
      res.json({
        ok: true,
        packagePath: path.join(repoRoot, 'exports', 'video', sessionId, 'clipchamp-package'),
        hint: 'Los exports viven en disco local (gitignored). Usa la CLI o abre la carpeta.',
      });
    })
  );

  /** Stream local MP4 for in-UI preview (UC-0009). */
  router.get(
    '/sessions/:sessionId/video-preview',
    asyncHandler(async (req, res) => {
      const sessionId = String(req.params.sessionId ?? '');
      const mp4Path = path.join(
        repoRoot,
        'exports',
        'video',
        sessionId,
        '05-video',
        'tutorial-final.mp4'
      );
      let fileStat: Awaited<ReturnType<typeof stat>>;
      try {
        fileStat = await stat(mp4Path);
      } catch {
        res.status(404).json({
          ok: false,
          error: 'MP4 no generado. Usa «Generar MP4» primero.',
        });
        return;
      }

      const size = fileStat.size;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'no-store');

      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
        if (!match) {
          res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
          return;
        }
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Number(match[2]) : size - 1;
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          start < 0 ||
          end < start ||
          start >= size
        ) {
          res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
          return;
        }
        const safeEnd = Math.min(end, size - 1);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${safeEnd}/${size}`);
        res.setHeader('Content-Length', safeEnd - start + 1);
        createReadStream(mp4Path, { start, end: safeEnd }).pipe(res);
        return;
      }

      res.setHeader('Content-Length', size);
      createReadStream(mp4Path).pipe(res);
    })
  );

  return router;
}
