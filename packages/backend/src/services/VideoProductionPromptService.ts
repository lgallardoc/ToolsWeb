import type { CaptureStep, TutorialSession } from '@toolsweb/shared';

const VIDEO_PROMPT_INSTRUCTIONS = `Eres un director de video tutoriales cortos para avatar (HeyGen, Synthesia, CapCut IA, ElevenLabs + editor).

TU OBJETIVO:
Producir un PLAN DE VIDEO CORTO sincronizado: locución + secuencia de pantallas + tiempos exactos de permanencia.

ENTRADAS QUE RECIBES:
1) GUIÓN DE LOCUNIÓN (texto fijo — no lo reescribas salvo cortes técnicos de pacing).
2) SECUENCIA DE PANTALLAS con timestamps, gapMs y holdSec sugeridos.
3) DURACIÓN TOTAL OBJETIVO en segundos.

REGLAS:
1. NO inventes pantallas que no estén en la secuencia.
2. Asigna cada frase o bloque del guión a una o varias pantallas consecutivas según el sentido.
3. Respeta holdSec como duración mínima on-screen; si la locución de ese bloque dura más, alarga el hold (no aceleres la voz de forma antinatural).
4. Inserta transiciones cortas (0.2–0.4s) entre cambios de pantalla cuando gapMs > 800.
5. Devuelve:
   A) Tabla: # | pantalla | inicio_s | fin_s | hold_s | fragmento_de_guión
   B) Duración total final en segundos
   C) Notas de edición (zoom/highlight si el paso es click/select)
   D) SSML o markers de pausa opcionales alineados a la tabla
6. Idioma: español.
7. No menciones DOM, CSS, Playwright ni selectores técnicos.`;

function estimateSpeechSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, Math.round((words / 2.5) * 10) / 10);
}

function screenLabel(step: CaptureStep): string {
  return (
    step.ariaLabel ||
    step.closestHeader ||
    step.formContext ||
    step.target.text ||
    step.description
  ).slice(0, 120);
}

export type VideoTimelineRow = {
  stepNumber: number;
  action: string;
  screenLabel: string;
  timestamp: string;
  elapsedMs: number;
  gapMs: number;
  holdSec: number;
  hasScreenshot: boolean;
};

export function buildVideoTimeline(steps: CaptureStep[]): {
  rows: VideoTimelineRow[];
  durationSec: number;
} {
  if (steps.length === 0) return { rows: [], durationSec: 0 };

  const firstAt = Date.parse(steps[0]?.timestamp ?? '');
  const originMs = Number.isFinite(firstAt) ? firstAt : Date.now();
  let previousMs: number | null = null;
  const rows: VideoTimelineRow[] = [];

  for (const step of steps) {
    const at = Date.parse(step.timestamp);
    const elapsedMs = Number.isFinite(at) ? Math.max(0, Math.round(at - originMs)) : 0;
    const gapMs =
      previousMs !== null && Number.isFinite(at)
        ? Math.max(0, Math.round(at - previousMs))
        : 0;
    const holdSec = Math.min(
      12,
      Math.max(1.2, Math.round((Math.max(gapMs, 1200) / 1000) * 10) / 10)
    );
    rows.push({
      stepNumber: step.stepNumber,
      action: step.action,
      screenLabel: screenLabel(step),
      timestamp: step.timestamp,
      elapsedMs,
      gapMs,
      holdSec,
      hasScreenshot: Boolean(step.imageBase64 || step.screenshotPath),
    });
    previousMs = Number.isFinite(at) ? at : previousMs;
  }

  const sumHold = rows.reduce((acc, r) => acc + r.holdSec, 0);
  return { rows, durationSec: Math.round(sumHold * 10) / 10 };
}

/**
 * Builds a copy-paste prompt for an external video AI (UC-0008).
 */
export function buildVideoProductionPrompt(
  session: TutorialSession,
  spokenScript: string
): string | undefined {
  const script = spokenScript.trim();
  if (!script || !session.steps.length) return undefined;

  const interactive = session.steps.filter((s) => s.action !== 'navigate');
  const used = interactive.length > 0 ? interactive : session.steps;
  const { rows, durationSec } = buildVideoTimeline(used);
  const speechSec = estimateSpeechSec(script);
  const targetSec = Math.max(durationSec, speechSec);

  const payload = {
    title: session.title,
    targetDurationSec: targetSec,
    speechEstimateSec: speechSec,
    screenHoldSumSec: durationSec,
    screens: rows.map((r) => ({
      stepNumber: r.stepNumber,
      action: r.action,
      screen: r.screenLabel,
      elapsedMs: r.elapsedMs,
      gapMs: r.gapMs,
      holdSec: r.holdSec,
      hasScreenshot: r.hasScreenshot,
    })),
  };

  return [
    VIDEO_PROMPT_INSTRUCTIONS,
    '',
    `Título: ${session.title}`,
    `Duración objetivo sugerida: ~${targetSec}s (locución ~${speechSec}s; holds de pantalla ~${durationSec}s).`,
    '',
    'GUIÓN DE LOCUNCIÓN (usar verbatim):',
    '---',
    script,
    '---',
    '',
    'SECUENCIA DE PANTALLAS + TIEMPOS (JSON):',
    JSON.stringify(payload, null, 2),
    '',
    'Entrega el plan A–D descrito arriba.',
  ].join('\n');
}

export function attachVideoPrompt(session: TutorialSession): TutorialSession {
  const spoken = session.fullScript?.spokenText;
  if (!spoken) return session;
  const videoPrompt = buildVideoProductionPrompt(session, spoken);
  if (!videoPrompt) return session;
  return { ...session, videoPrompt };
}
