/**
 * Pure CLI for fixture sources (no SessionLog decrypt).
 */
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { VideoProjectSourceSchema } from '@toolsweb/shared';
import { loadVideoRendererConfig } from './config.js';
import {
  assembleClipchampPackage,
  buildVideoProjectArtifacts,
} from './pipeline.js';
import { renderTutorialMp4 } from './remotion/render.js';
import { toPublicError } from './errors.js';

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  return argv[i + 1];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const cmd = argv[0] ?? 'help';
  const sourceFile = argValue(argv, '--source');
  const output = argValue(argv, '--output');
  const config = loadVideoRendererConfig();
  const silent = argv.includes('--silent') || config.ttsProvider === 'silent';

  try {
    if (!sourceFile) {
      console.log(`Fixture CLI — use --source <VideoProjectSource.json>
For real sessions: npm run video:build -- --session <id> (backend CLI)`);
      return;
    }
    const source = VideoProjectSourceSchema.parse(
      JSON.parse(await readFile(sourceFile, 'utf8'))
    );
    const out = output ?? path.resolve(`exports/video/${source.sessionId}`);
    await mkdir(out, { recursive: true });

    if (cmd === 'validate' || cmd === 'build') {
      const built = await buildVideoProjectArtifacts({
        source,
        outputDir: out,
        config: { ...config, ttsProvider: silent ? 'silent' : config.ttsProvider },
        forceSilent: true,
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
        } catch (e) {
          renderError = e instanceof Error ? e.message : String(e);
        }
        await assembleClipchampPackage(out);
      }
      await writeFile(
        path.join(out, '06-metadata', 'cli-result.json'),
        JSON.stringify({ ok: true, videoPath, renderError, warnings: built.warnings }, null, 2)
      );
      console.log(
        JSON.stringify(
          {
            ok: true,
            scenes: built.storyboard.scenes.length,
            output: out,
            videoPath,
            renderError,
            warnings: built.warnings,
          },
          null,
          2
        )
      );
      return;
    }
    console.log('Usage: cli.ts validate|build --source file.json [--output dir]');
  } catch (e) {
    console.error(JSON.stringify({ ok: false, error: toPublicError(e) }, null, 2));
    process.exitCode = 1;
  }
}

void main();
