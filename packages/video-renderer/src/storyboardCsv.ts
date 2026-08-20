import type { VideoStoryboardScene } from '@toolsweb/shared';

function csvEscape(value: string | number | boolean | undefined | null): string {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function storyboardToCsv(scenes: VideoStoryboardScene[]): string {
  const header = [
    'sceneNumber',
    'stepNumber',
    'action',
    'startTime',
    'endTime',
    'durationSeconds',
    'originalElapsedMs',
    'originalGapMs',
    'narration',
    'visualInstruction',
    'imageFile',
    'audioFile',
    'hasImage',
    'hasAudio',
    'validationStatus',
  ].join(',');

  const rows = scenes.map((sc) =>
    [
      sc.sceneNumber,
      sc.stepNumber,
      sc.action,
      sc.startTimeSeconds.toFixed(3),
      sc.endTimeSeconds.toFixed(3),
      sc.durationSeconds.toFixed(3),
      sc.originalElapsedMs ?? '',
      sc.originalGapMs ?? '',
      sc.narration,
      sc.visualInstruction,
      sc.imageFile,
      sc.audioFile ?? '',
      'true',
      Boolean(sc.audioFile),
      'ok',
    ]
      .map(csvEscape)
      .join(',')
  );

  return [header, ...rows].join('\n') + '\n';
}
