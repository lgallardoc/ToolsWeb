/**
 * Backend CLI: sessionId → VideoProjectSource → @toolsweb/video-renderer (UC-0009).
 */
import '../config/loadEnv.js';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  assembleClipchampPackage,
  buildVideoProjectArtifacts,
  loadVideoRendererConfig,
  renderTutorialMp4,
  toPublicError,
} from '@toolsweb/video-renderer';
import { VideoProjectSourceService } from '../services/VideoProjectSourceService.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  return argv[i + 1];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0] ?? 'help';
  const sessionId = argValue(argv, '--session');
  const silent = argv.includes('--silent');
  const config = loadVideoRendererConfig();
  if (silent) config.ttsProvider = 'silent';

  if (!sessionId) {
    console.error('Required: --session <uuid>');
    process.exitCode = 1;
    return;
  }

  try {
    const loaded = await new VideoProjectSourceService().load(sessionId);
    if (!loaded.ok) {
      console.error(JSON.stringify({ ok: false, errors: loaded.errors }, null, 2));
      process.exitCode = 1;
      return;
    }

    const out =
      argValue(argv, '--output') ??
      path.join(repoRoot, 'exports', 'video', sessionId);
    await mkdir(out, { recursive: true });

    if (cmd === 'validate' || cmd === 'build') {
      const built = await buildVideoProjectArtifacts({
        source: loaded.source,
        outputDir: out,
        config,
        forceSilent: cmd === 'validate' || silent || config.ttsProvider === 'silent',
      });

      let videoPath: string | undefined;
      let renderError: string | undefined;
      if (cmd === 'build') {
        try {
          const rendered = await renderTutorialMp4({
            storyboard: built.storyboard,
            projectRoot: out,
            config,
          });
          videoPath = rendered.outputPath;
          built.report.video = {
            generated: true,
            path: rendered.outputPath,
            durationSeconds: rendered.durationSeconds,
            width: config.width,
            height: config.height,
            fps: config.fps,
            audioPresent: true,
          };
          await writeFile(
            path.join(out, '06-metadata', 'validation-report.json'),
            JSON.stringify(built.report, null, 2)
          );
        } catch (e) {
          renderError = e instanceof Error ? e.message : String(e);
        }
        const pkg = await assembleClipchampPackage(out);
        console.log(
          JSON.stringify(
            {
              ok: !renderError,
              output: out,
              clipchampPackage: pkg,
              scenes: built.storyboard.scenes.length,
              videoPath,
              renderError,
              warnings: built.warnings,
            },
            null,
            2
          )
        );
        if (renderError) process.exitCode = 1;
        return;
      }

      console.log(
        JSON.stringify(
          {
            ok: built.report.valid,
            expectedScenes: built.report.expectedScenes,
            generatedScenes: built.report.generatedScenes,
            missingNarrations: built.report.missingNarrations,
            warnings: built.warnings,
            output: out,
          },
          null,
          2
        )
      );
      return;
    }

    console.log('Usage: video.ts validate|build --session <id> [--output dir] [--silent]');
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: toPublicError(e) }, null, 2));
    process.exitCode = 1;
  }
}

void main();
