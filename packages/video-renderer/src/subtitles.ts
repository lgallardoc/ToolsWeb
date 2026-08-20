/**
 * Split narration into subtitle cues (max ~84 chars, prefer punctuation).
 */
export function splitSubtitleCues(text: string, maxChars = 84): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const sentences = trimmed.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const cues: string[] = [];
  let buf = '';
  for (const sentence of sentences) {
    if (!buf) {
      buf = sentence;
      continue;
    }
    if ((buf + ' ' + sentence).length <= maxChars) {
      buf = `${buf} ${sentence}`;
    } else {
      cues.push(buf);
      buf = sentence;
    }
  }
  if (buf) cues.push(buf);

  // Hard-wrap leftover long chunks without breaking words.
  const out: string[] = [];
  for (const cue of cues) {
    if (cue.length <= maxChars) {
      out.push(cue);
      continue;
    }
    const words = cue.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (!line) {
        line = w;
        continue;
      }
      if ((line + ' ' + w).length <= maxChars) line = `${line} ${w}`;
      else {
        out.push(line);
        line = w;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

export function formatSrtTimestamp(totalSeconds: number): string {
  const ms = Math.max(0, Math.round(totalSeconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const milli = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(milli).padStart(3, '0')}`;
}

export function formatVttTimestamp(totalSeconds: number): string {
  return formatSrtTimestamp(totalSeconds).replace(',', '.');
}

export type SubtitleScene = {
  startTimeSeconds: number;
  endTimeSeconds: number;
  narration: string;
};

export function buildSrt(scenes: SubtitleScene[]): string {
  const blocks: string[] = [];
  let idx = 1;
  for (const scene of scenes) {
    if (!scene.narration.trim()) continue;
    const cues = splitSubtitleCues(scene.narration);
    const slice =
      cues.length <= 1
        ? [{ text: cues[0] ?? scene.narration, start: scene.startTimeSeconds, end: scene.endTimeSeconds }]
        : cues.map((text, i) => {
            const span = (scene.endTimeSeconds - scene.startTimeSeconds) / cues.length;
            return {
              text,
              start: scene.startTimeSeconds + span * i,
              end: scene.startTimeSeconds + span * (i + 1),
            };
          });
    for (const c of slice) {
      blocks.push(
        `${idx}\n${formatSrtTimestamp(c.start)} --> ${formatSrtTimestamp(c.end)}\n${c.text}\n`
      );
      idx += 1;
    }
  }
  return blocks.join('\n').trim() + (blocks.length ? '\n' : '');
}

export function buildVtt(scenes: SubtitleScene[]): string {
  const body = buildSrt(scenes)
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .replace(/^\d+\n/gm, '');
  // Rebuild properly for VTT
  const blocks: string[] = ['WEBVTT', ''];
  let idx = 1;
  for (const scene of scenes) {
    if (!scene.narration.trim()) continue;
    const cues = splitSubtitleCues(scene.narration);
    const slice =
      cues.length <= 1
        ? [{ text: cues[0] ?? scene.narration, start: scene.startTimeSeconds, end: scene.endTimeSeconds }]
        : cues.map((text, i) => {
            const span = (scene.endTimeSeconds - scene.startTimeSeconds) / cues.length;
            return {
              text,
              start: scene.startTimeSeconds + span * i,
              end: scene.startTimeSeconds + span * (i + 1),
            };
          });
    for (const c of slice) {
      blocks.push(`${idx}`);
      blocks.push(
        `${formatVttTimestamp(c.start)} --> ${formatVttTimestamp(c.end)}`
      );
      blocks.push(c.text);
      blocks.push('');
      idx += 1;
    }
  }
  void body;
  return blocks.join('\n');
}
