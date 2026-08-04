import type { CaptureStep, TutorialSession } from '@toolsweb/shared';
import { narrationFromCaptureSession } from '@toolsweb/shared';

const PROMPT_INSTRUCTIONS = `Eres un experto en guiones de video tutoriales para avatares (Synthesia / HeyGen) y locución en español.

TU OBJETIVO:
A partir del REGISTRO JSON (un paso = una captura/página), entregar un GUION DE PRODUCCIÓN listo para editar en Synthesia, con la misma estructura y rigor que un plan de rodaje profesional.

FORMATO DE SALIDA (obligatorio — texto plano con tabuladores, NO Markdown, NO JSON, NO fences):

1) Agrupa en secciones temáticas con encabezado:
   Sección N — Título corto de la fase

2) Bajo cada sección, una fila de cabecera TSV exactamente así (separada por TAB):
   Paso	Tiempo	Duración	Acción visual en Synthesia	Narración

3) Una fila TSV por CADA paso del JSON (mismo stepNumber / "página"). Columnas:
   - Paso: número entero = stepNumber del JSON (1:1, sin saltar ni inventar).
   - Tiempo: rango mm:ss–mm:ss (o hh:mm:ss–hh:mm:ss) continuo desde 00:00; el fin de un paso = inicio del siguiente.
   - Duración: "N s" coherente con el rango (usa suggestedDurationSec del JSON como base; puedes ajustar ±1–2 s por claridad de locución).
   - Acción visual en Synthesia: instrucciones de edición para ESA captura (página = stepNumber). Incluye encuadre/recorte, zoom, resaltado del control, cursor/clic simulado, continuidad si gapMs es muy corto, y qué NO mostrar (p. ej. headers técnicos). No inventes pantallas ni resultados posteriores ausentes del registro.
   - Narración: frase(s) en español, 2.ª persona ("haz clic", "selecciona"), listas para locutor. Una idea clara por paso; conectores temporales entre pasos ("Primero", "Luego", "A continuación", "Finalmente").

4) Entre secciones, si el registro NO respalda una acción que el usuario podría asumir (p. ej. no hay clic en Guardar), añade un párrafo "Precisión importante: …" advirtiendo qué no afirmar en el video.

REGLAS:
1. IGNORA selectores CSS, XPath, tagName, Playwright y jerga DOM.
2. PRIORIZA closestHeader, formContext, ariaLabel, placeholder, targetText, description.
3. USA la línea de tiempo (elapsedMs, gapMs, suggestedDurationSec, suggestedTimeRange). Gaps cortos (<800ms) → continuidad visual sin “nueva operación”; gaps largos → cambio de escena o sección.
4. NO inventes pasos. exactitud 1:1 con steps[].stepNumber del JSON.
5. Toma el BORRADOR DETERMINISTA solo como base de la columna Narración; la Acción visual la redactas tú a partir de metadatos + tipo de action.
6. Devuelve ÚNICAMENTE el documento de producción (secciones + tablas TSV + notas de precisión). Sin preámbulos ni epílogos.`;

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function stepContext(
  step: CaptureStep,
  originMs: number,
  previousMs: number | null,
  nextElapsedMs: number | null
): Record<string, unknown> {
  const at = Date.parse(step.timestamp);
  const elapsedMs = Number.isFinite(at) ? Math.max(0, Math.round(at - originMs)) : 0;
  const gapMs =
    previousMs !== null && Number.isFinite(at)
      ? Math.max(0, Math.round(at - previousMs))
      : 0;

  const startSec = elapsedMs / 1000;
  const endSec =
    nextElapsedMs !== null
      ? Math.max(startSec + 2, nextElapsedMs / 1000)
      : startSec + Math.max(3, gapMs > 0 ? gapMs / 1000 : 4);
  const suggestedDurationSec = Math.max(
    2,
    Math.min(12, Math.round((endSec - startSec) * 10) / 10)
  );

  return {
    stepNumber: step.stepNumber,
    page: step.stepNumber,
    timestamp: step.timestamp,
    elapsedMs,
    gapMs,
    suggestedDurationSec,
    suggestedTimeRange: `${formatMmSs(startSec)}–${formatMmSs(startSec + suggestedDurationSec)}`,
    action: step.action,
    description: step.description,
    hasScreenshot: Boolean(step.imageBase64 || step.screenshotPath),
    ...(step.ariaLabel ? { ariaLabel: step.ariaLabel } : {}),
    ...(step.closestHeader ? { closestHeader: step.closestHeader } : {}),
    ...(step.formContext ? { formContext: step.formContext } : {}),
    ...(step.placeholder ? { placeholder: step.placeholder } : {}),
    ...(step.target.text ? { targetText: step.target.text } : {}),
  };
}

/**
 * Builds a copy-paste prompt from captured steps (UC-0004).
 * Asks the external AI for a Synthesia-style TSV production script.
 */
export class AvatarPromptService {
  buildPrompt(session: TutorialSession): string | undefined {
    if (!session.steps.length) return undefined;

    // One row per capture (including navigate) so the production table matches pages 1:1.
    const used = session.steps;

    const firstAt = Date.parse(used[0]?.timestamp ?? '');
    const originMs = Number.isFinite(firstAt) ? firstAt : Date.now();

    const elapsedList = used.map((step) => {
      const at = Date.parse(step.timestamp);
      return Number.isFinite(at) ? Math.max(0, Math.round(at - originMs)) : 0;
    });

    let previousMs: number | null = null;
    const steps = used.map((step, i) => {
      const nextElapsed = i + 1 < elapsedList.length ? elapsedList[i + 1]! : null;
      const ctx = stepContext(step, originMs, previousMs, nextElapsed);
      const at = Date.parse(step.timestamp);
      previousMs = Number.isFinite(at) ? at : previousMs;
      return ctx;
    });

    const lastAt = Date.parse(used[used.length - 1]?.timestamp ?? '');
    const durationMs =
      Number.isFinite(lastAt) && Number.isFinite(originMs)
        ? Math.max(0, Math.round(lastAt - originMs))
        : 0;

    const draft = narrationFromCaptureSession(session, {
      includeNavigate: true,
    });

    const payload = {
      title: session.title,
      outputFormat: {
        type: 'synthesia_tsv_production_script',
        columns: [
          'Paso',
          'Tiempo',
          'Duración',
          'Acción visual en Synthesia',
          'Narración',
        ],
        separator: 'TAB',
        oneRowPerStepNumber: true,
      },
      timeline: {
        originTimestamp: used[0]?.timestamp,
        durationMs,
        stepCount: used.length,
      },
      steps,
    };

    return [
      PROMPT_INSTRUCTIONS,
      '',
      `Título del tutorial: ${session.title}`,
      '',
      'EJEMPLO DE FORMA (ilustrativo — sustituye con los pasos reales del JSON; usa TAB entre columnas):',
      'Sección 1 — Acceso y edición',
      'Paso	Tiempo	Duración	Acción visual en Synthesia	Narración',
      '1	00:00–00:07	7 s	Página 1. Zoom suave al panel principal; resalta el control indicado.	En este tutorial aprenderás a…',
      '2	00:07–00:11	4 s	Página 2. Acerca el menú lateral y simula el clic.	Primero, haz clic en…',
      '',
      'BORRADOR DETERMINISTA (base para la columna Narración; mejóralo sin inventar pasos):',
      draft.fullSpokenText,
      '',
      'REGISTRO DE CAPTURAS CON LÍNEA DE TIEMPO (JSON — una fila de salida por cada stepNumber):',
      JSON.stringify(payload, null, 2),
    ].join('\n');
  }

  attachPrompt(
    session: TutorialSession,
    options?: { enableAvatarScript?: boolean; force?: boolean }
  ): TutorialSession {
    if (options?.enableAvatarScript === false) {
      return session;
    }
    if (session.avatarPrompt && !options?.force) {
      return session;
    }
    const avatarPrompt = this.buildPrompt(session);
    if (!avatarPrompt) return session;
    return { ...session, avatarPrompt };
  }
}
