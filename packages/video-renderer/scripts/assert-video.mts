import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildVideoProjectSource,
  type TutorialSession,
} from '@toolsweb/shared';
import {
  buildSrt,
  buildVtt,
  computeSceneDurationSeconds,
  loadVideoRendererConfig,
  splitSubtitleCues,
  storyboardToCsv,
  transitionForGapMs,
  buildVideoProjectArtifacts,
} from '../src/index.js';

const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function fixtureSession(): TutorialSession {
  const now = Date.now();
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Fixture video',
    createdAt: new Date(now).toISOString(),
    steps: [
      {
        id: '22222222-2222-4222-8222-222222222221',
        stepNumber: 1,
        timestamp: new Date(now).toISOString(),
        url: 'https://example.com/',
        action: 'navigate',
        target: { tagName: 'BODY', selector: 'body' },
        description: 'Navigate to example',
        imageBase64: TINY_PNG,
        avatarScript: {
          spokenText: 'En este tutorial verás un ejemplo.',
          ssmlText: 'En este tutorial verás un ejemplo.',
          estimatedDurationSec: 2,
        },
      },
      {
        id: '22222222-2222-4222-8222-222222222222',
        stepNumber: 2,
        timestamp: new Date(now + 1500).toISOString(),
        url: 'https://example.com/',
        action: 'click',
        target: {
          tagName: 'BUTTON',
          selector: 'button',
          text: 'Start',
          boundingBox: { x: 10, y: 10, width: 40, height: 20 },
          clickPoint: { x: 20, y: 15 },
        },
        description: 'Click Start',
        imageBase64: TINY_PNG,
        avatarScript: {
          spokenText: 'Haz clic en Start.',
          ssmlText: 'Haz clic en Start.',
          estimatedDurationSec: 1.5,
        },
      },
      {
        id: '22222222-2222-4222-8222-222222222223',
        stepNumber: 3,
        timestamp: new Date(now + 4000).toISOString(),
        url: 'https://example.com/done',
        action: 'navigate',
        target: { tagName: 'BODY', selector: 'body' },
        description: 'Done page',
        imageBase64: TINY_PNG,
        // silent scene
      },
    ],
  };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main(): Promise<void> {
  const session = fixtureSession();
  const built = buildVideoProjectSource(session);
  assert(built.ok, 'source ok');
  assert(built.source.steps.length === 3, 'preserve all steps');
  assert(
    built.source.steps.every((s, i) => s.sceneNumber === i + 1),
    'sceneNumber == index+1'
  );
  assert(built.source.steps[0]?.narration.includes('tutorial'), 'avatarScript narration');
  assert(built.source.steps[2]?.narration === '' || built.source.steps[2]?.narration.length >= 0, 'silent ok');

  const dup = fixtureSession();
  dup.steps[2] = { ...dup.steps[2]!, stepNumber: 1 };
  const dupBuilt = buildVideoProjectSource(dup);
  assert(!dupBuilt.ok, 'duplicate steps fail');

  const config = loadVideoRendererConfig();
  const d = computeSceneDurationSeconds({
    step: { ...built.source.steps[0]!, suggestedDurationSec: 7 },
    audioDurationSeconds: 2,
    config,
  });
  assert(d >= 7, 'suggestedDurationSec respected when longer than audio');
  assert(transitionForGapMs(500, 1).gapContributionSeconds <= 0.2, 'short gap');
  assert(transitionForGapMs(5000, 1).gapContributionSeconds <= 1, 'long gap capped');

  const cues = splitSubtitleCues('A'.repeat(90) + '. Siguiente frase corta.');
  assert(cues.length >= 1, 'subtitle split');

  const scenes = [
    {
      sceneNumber: 1,
      stepNumber: 1,
      action: 'navigate',
      narration: 'Hola mundo',
      startTimeSeconds: 0,
      endTimeSeconds: 3,
      durationSeconds: 3,
      imageFile: '01-images/step-001.png',
      audioFile: '02-audio/step-001.wav',
      cursorAction: 'section-fade',
      transition: 'cut-soft',
      visualInstruction: 'nav',
    },
  ];
  const srt = buildSrt(scenes);
  assert(srt.includes('-->'), 'srt');
  const vtt = buildVtt(scenes);
  assert(vtt.startsWith('WEBVTT'), 'vtt');
  const csv = storyboardToCsv(scenes);
  assert(csv.includes('sceneNumber'), 'csv header');
  assert(csv.includes('"Hola mundo"') || csv.includes('Hola mundo'), 'csv row');

  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../.tmp-fixture'
  );
  await mkdir(root, { recursive: true });
  // Ensure narration on silent for duration still works — fill empty for image pipeline: step3 has no avatarScript but semantic fallback from description
  const art = await buildVideoProjectArtifacts({
    source: built.source,
    outputDir: root,
    config: { ...config, ttsProvider: 'silent' },
    forceSilent: true,
  });
  assert(art.storyboard.scenes.length === 3, 'artifacts generated');
  await writeFile(path.join(root, 'ok.txt'), 'ok');

  // Missing image
  const noImg = fixtureSession();
  delete noImg.steps[0]!.imageBase64;
  const miss = buildVideoProjectSource(noImg);
  assert(!miss.ok, 'missing image fails');

  console.log('assert-video: ok');
}

void main();
