import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TutorialSessionSchema,
  type TutorialSession,
  type TutorialSessionSummary,
  sanitizeTutorialSession,
} from '@toolsweb/shared';
import {
  decryptAes256Gcm,
  encryptAes256Gcm,
  isEncryptedBlob,
  resolveEncryptionKey,
} from '../lib/cryptoAtRest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSIONS_ROOT = path.resolve(__dirname, '../../data/sessions');
const CAPTURES_ROOT = path.resolve(__dirname, '../../captures');
/** Monorepo root (Toolsweb/) — video exports live here. */
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const VIDEO_EXPORTS_ROOT = path.join(REPO_ROOT, 'exports', 'video');

type StoredSession = TutorialSession & { stoppedAt: string };

export type SessionDeleteResult = {
  /** True if bitácora JSON existed (primary delete target). */
  deleted: boolean;
  /** Logical paths removed (best-effort). */
  removed: string[];
};

/** Reject path-traversal style session ids (UC-0010). */
export function assertSafeSessionId(sessionId: string): void {
  if (!sessionId || sessionId.includes('..') || sessionId.includes('/') || sessionId.includes('\\')) {
    throw new Error('sessionId inválido');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(sessionId)) {
    throw new Error('sessionId inválido');
  }
}

/** Recover raw TSV paste previously appended into videoPrompt (legacy sessions). */
function extractProductionGuideFromVideoPrompt(videoPrompt?: string): string | undefined {
  if (!videoPrompt) return undefined;
  const startMark = 'GUÍA DE PRODUCCIÓN';
  const start = videoPrompt.indexOf(startMark);
  if (start < 0) return undefined;
  const after = videoPrompt.slice(start);
  const firstFence = after.indexOf('---');
  if (firstFence < 0) return undefined;
  const rest = after.slice(firstFence + 3);
  const endFence = rest.indexOf('---');
  if (endFence < 0) return undefined;
  const body = rest.slice(0, endFence).trim();
  return body.length > 0 ? body : undefined;
}

/**
 * Persist finished capture sessions (bitácora) encrypted at rest (AES-256-GCM).
 * Screenshots live under captures/<id>/ as .png.enc (or legacy .png).
 */
export class SessionLogService {
  private async ensureRoot(): Promise<void> {
    await mkdir(SESSIONS_ROOT, { recursive: true });
  }

  private encPath(sessionId: string): string {
    return path.join(SESSIONS_ROOT, `${sessionId}.json.enc`);
  }

  private legacyPath(sessionId: string): string {
    return path.join(SESSIONS_ROOT, `${sessionId}.json`);
  }

  /** Save (or overwrite) a finished session into the bitácora (encrypted). */
  async save(session: TutorialSession): Promise<TutorialSessionSummary> {
    await this.ensureRoot();
    const key = resolveEncryptionKey();
    const safe = sanitizeTutorialSession(session);
    const stoppedAt = new Date().toISOString();
    const stored: StoredSession = {
      ...safe,
      stoppedAt,
      steps: safe.steps.map((step) => {
        const { imageBase64: _drop, ...rest } = step;
        // Prefer encrypted screenshot path if present
        return rest;
      }),
    };
    const plain = Buffer.from(JSON.stringify(stored), 'utf8');
    const blob = encryptAes256Gcm(plain, key);
    await writeFile(this.encPath(safe.id), blob);
    // Remove legacy plaintext if any
    await rm(this.legacyPath(safe.id), { force: true });
    return {
      id: safe.id,
      title: safe.title,
      createdAt: safe.createdAt,
      stepCount: safe.steps.length,
      stoppedAt,
    };
  }

  async list(): Promise<TutorialSessionSummary[]> {
    await this.ensureRoot();
    const files = await readdir(SESSIONS_ROOT);
    const ids = new Set<string>();
    for (const file of files) {
      if (file.endsWith('.json.enc')) ids.add(file.replace(/\.json\.enc$/, ''));
      else if (file.endsWith('.json')) ids.add(file.replace(/\.json$/, ''));
    }

    const items: TutorialSessionSummary[] = [];
    for (const id of ids) {
      try {
        const raw = await this.readStored(id);
        if (!raw) continue;
        items.push({
          id: raw.id,
          title: raw.title,
          createdAt: raw.createdAt,
          stepCount: raw.steps?.length ?? 0,
          stoppedAt: raw.stoppedAt ?? raw.createdAt,
        });
      } catch {
        /* skip corrupt / wrong key */
      }
    }

    items.sort((a, b) => b.stoppedAt.localeCompare(a.stoppedAt));
    return items;
  }

  async get(sessionId: string, opts?: { withImages?: boolean }): Promise<TutorialSession | null> {
    try {
      const raw = await this.readStored(sessionId);
      if (!raw) return null;
      const parsed = TutorialSessionSchema.parse({
        id: raw.id,
        title: raw.title,
        createdAt: raw.createdAt,
        steps: raw.steps ?? [],
        ...(raw.avatarPrompt ? { avatarPrompt: raw.avatarPrompt } : {}),
        ...(raw.fullScript ? { fullScript: raw.fullScript } : {}),
        ...(raw.productionScript
          ? { productionScript: raw.productionScript }
          : (() => {
              const recovered = extractProductionGuideFromVideoPrompt(raw.videoPrompt);
              return recovered ? { productionScript: recovered } : {};
            })()),
        ...(raw.videoPrompt ? { videoPrompt: raw.videoPrompt } : {}),
      });
      if (!opts?.withImages) return sanitizeTutorialSession(parsed);
      return sanitizeTutorialSession(await this.hydrateImages(parsed));
    } catch {
      return null;
    }
  }

  /**
   * UC-0010 — purge bitácora + captures + video exports for this session.
   * Video render jobs are cleaned by the caller via deleteVideoJobsForSession.
   */
  async delete(sessionId: string): Promise<SessionDeleteResult> {
    assertSafeSessionId(sessionId);
    const removed: string[] = [];
    let deleted = false;

    for (const [label, p] of [
      [`data/sessions/${sessionId}.json.enc`, this.encPath(sessionId)],
      [`data/sessions/${sessionId}.json`, this.legacyPath(sessionId)],
    ] as const) {
      try {
        await access(p);
        deleted = true;
        await rm(p, { force: true });
        removed.push(label);
      } catch {
        await rm(p, { force: true }).catch(() => undefined);
      }
    }

    const capturesDir = path.join(CAPTURES_ROOT, sessionId);
    try {
      await access(capturesDir);
      await rm(capturesDir, { recursive: true, force: true });
      removed.push(`captures/${sessionId}`);
    } catch {
      await rm(capturesDir, { recursive: true, force: true }).catch(() => undefined);
    }

    const videoDir = path.join(VIDEO_EXPORTS_ROOT, sessionId);
    // Never delete the shared _jobs directory even if misnamed.
    if (sessionId !== '_jobs') {
      try {
        await access(videoDir);
        await rm(videoDir, { recursive: true, force: true });
        removed.push(`exports/video/${sessionId}`);
      } catch {
        await rm(videoDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    return { deleted: deleted || removed.length > 0, removed };
  }

  private async readStored(sessionId: string): Promise<StoredSession | null> {
    const enc = this.encPath(sessionId);
    try {
      const blob = await readFile(enc);
      const plain = decryptAes256Gcm(blob);
      return JSON.parse(plain.toString('utf8')) as StoredSession;
    } catch {
      /* try legacy plaintext once */
    }
    try {
      const text = await readFile(this.legacyPath(sessionId), 'utf8');
      return JSON.parse(text) as StoredSession;
    } catch {
      return null;
    }
  }

  private async hydrateImages(session: TutorialSession): Promise<TutorialSession> {
    const steps = await Promise.all(
      session.steps.map(async (step) => {
        if (step.imageBase64) return step;
        const buf = await this.readScreenshotBuffer(step.screenshotPath);
        if (!buf) return step;
        return { ...step, imageBase64: buf.toString('base64') };
      })
    );
    return { ...session, steps };
  }

  private async readScreenshotBuffer(screenshotPath?: string): Promise<Buffer | null> {
    if (!screenshotPath) return null;
    const candidates = [
      screenshotPath.endsWith('.enc') ? screenshotPath : `${screenshotPath}.enc`,
      screenshotPath.replace(/\.enc$/, ''),
      screenshotPath,
    ];
    for (const candidate of candidates) {
      try {
        const blob = await readFile(candidate);
        if (isEncryptedBlob(blob)) return decryptAes256Gcm(blob);
        return blob;
      } catch {
        /* next */
      }
    }
    return null;
  }
}
