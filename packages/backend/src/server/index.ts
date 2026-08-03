import './../config/loadEnv.js';
import cors from 'cors';
import express from 'express';
import { ZodError } from 'zod';
import { getEnv } from '../config/env.js';
import { createApiRouter } from './routes.js';

const env = getEnv();

const PORT = env.port;
const HOST = env.host;

const app = express();

const corsOrigin = env.corsOrigin?.split(',').map((s) => s.trim()).filter(Boolean);
app.use(
  cors(
    corsOrigin && corsOrigin.length > 0
      ? { origin: corsOrigin }
      : undefined
  )
);
app.use(express.json({ limit: '25mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'toolsweb-backend',
    host: HOST,
    port: PORT,
    enableAvatarScript: env.enableAvatarScript,
  });
});

app.use('/api', createApiRouter());

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    if (err instanceof ZodError) {
      res.status(400).json({ ok: false, error: 'validation_error', details: err.flatten() });
      return;
    }
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = /not found/i.test(message)
      ? 404
      : /already active|not the active/i.test(message)
        ? 409
        : /TOOLSWEB_ENCRYPTION_KEY/i.test(message)
          ? 503
          : 500;
    console.error(err);
    res.status(status).json({ ok: false, error: message });
  }
);

app.listen(PORT, HOST, () => {
  console.log(`Toolsweb API listening on http://${HOST}:${PORT}`);
});
