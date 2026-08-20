import { mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import {
  VideoRenderJobSchema,
  type VideoRenderJob,
  type VideoRenderJobStatus,
} from '@toolsweb/shared';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../exports/video/_jobs'
);

async function ensure(): Promise<void> {
  await mkdir(ROOT, { recursive: true });
}

function jobPath(jobId: string): string {
  return path.join(ROOT, `${jobId}.json`);
}

export async function createVideoJob(sessionId: string): Promise<VideoRenderJob> {
  await ensure();
  const now = new Date().toISOString();
  const job = VideoRenderJobSchema.parse({
    jobId: randomUUID(),
    sessionId,
    status: 'queued' satisfies VideoRenderJobStatus,
    progress: 0,
    createdAt: now,
    updatedAt: now,
  });
  await writeFile(jobPath(job.jobId), JSON.stringify(job, null, 2));
  return job;
}

export async function updateVideoJob(
  jobId: string,
  patch: Partial<VideoRenderJob>
): Promise<VideoRenderJob | null> {
  await ensure();
  try {
    const prev = VideoRenderJobSchema.parse(
      JSON.parse(await readFile(jobPath(jobId), 'utf8'))
    );
    const next = VideoRenderJobSchema.parse({
      ...prev,
      ...patch,
      jobId: prev.jobId,
      sessionId: prev.sessionId,
      updatedAt: new Date().toISOString(),
    });
    await writeFile(jobPath(jobId), JSON.stringify(next, null, 2));
    return next;
  } catch {
    return null;
  }
}

export async function getVideoJob(jobId: string): Promise<VideoRenderJob | null> {
  try {
    return VideoRenderJobSchema.parse(
      JSON.parse(await readFile(jobPath(jobId), 'utf8'))
    );
  } catch {
    return null;
  }
}

export async function listVideoJobs(sessionId: string): Promise<VideoRenderJob[]> {
  await ensure();
  const files = await readdir(ROOT).catch(() => [] as string[]);
  const jobs: VideoRenderJob[] = [];
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    try {
      const job = VideoRenderJobSchema.parse(
        JSON.parse(await readFile(path.join(ROOT, f), 'utf8'))
      );
      if (job.sessionId === sessionId) jobs.push(job);
    } catch {
      /* skip */
    }
  }
  return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** UC-0010 — remove persisted render jobs for a session. */
export async function deleteVideoJobsForSession(sessionId: string): Promise<string[]> {
  await ensure();
  const removed: string[] = [];
  const files = await readdir(ROOT).catch(() => [] as string[]);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const full = path.join(ROOT, f);
    try {
      const job = VideoRenderJobSchema.parse(JSON.parse(await readFile(full, 'utf8')));
      if (job.sessionId !== sessionId) continue;
      await rm(full, { force: true });
      removed.push(`exports/video/_jobs/${f}`);
    } catch {
      /* skip */
    }
  }
  return removed;
}
