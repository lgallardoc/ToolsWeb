/**
 * Soften macOS `say` delivery with punctuation + Apple speech silences (`[[slnc ms]]`).
 * Keeps providers local (ADR-0007); cloud TTS remains out of scope for UC-0009.
 */
export function prepareMacOsSpeechText(raw: string): string {
  let t = raw
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return t;

  t = t.replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'");
  t = t.replace(/\.{3,}/g, '…');
  t = t.replace(/([.!?]){2,}/g, '$1');
  // Strip accidental command-like brackets that could confuse `say`
  t = t.replace(/\[\[/g, '(').replace(/\]\]/g, ')');

  if (!/[.!?…]$/.test(t)) t += '.';

  t = t.replace(/([.!?…])\s+(?=\S)/g, '$1 [[slnc 340]] ');
  t = t.replace(/([:;])\s+(?=\S)/g, '$1 [[slnc 170]] ');
  t = t.replace(/,\s+(?=\S)/g, ', [[slnc 95]] ');
  t = t.replace(/\s[—–]\s/g, ' [[slnc 200]] ');

  return t.replace(/\s+/g, ' ').trim();
}
