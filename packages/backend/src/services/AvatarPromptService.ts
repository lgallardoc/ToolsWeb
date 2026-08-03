import type { CaptureStep, TutorialSession } from '@toolsweb/shared';

const PROMPT_INSTRUCTIONS = `Eres un experto redactor de guiones instruccionales para avatares y locuciones en video tutoriales (HeyGen, Synthesia, ElevenLabs).

TU OBJETIVO:
Transformar el registro de acciones siguiente (JSON con metadatos semánticos y línea de tiempo) en un guión narrativo fluido, natural y accesible para un avatar.

REGLAS DE PROCESAMIENTO:
1. IGNORA selectores CSS, XPath, posiciones en pantalla o jerga técnica DOM. No menciones tagName, selector, Playwright ni DOM.
2. PRIORIZA metadatos semánticos: closestHeader, formContext, ariaLabel, placeholder, targetText y description.
3. USA la LÍNEA DE TIEMPO: cada paso trae timestamp (ISO), elapsedMs (desde el primer paso) y gapMs (pausa respecto al anterior). Adapta el ritmo del guión: gaps cortos (<800ms) → frases seguidas; gaps medios → transición breve; gaps largos (>3s) → pausa natural o cambio de escena/sección.
4. REDACTA en español, segunda persona del singular ("haz clic", "ingresa", "selecciona"), tono profesional, claro y directo.
5. MANTÉN continuidad narrativa con conectores temporales ("Primero...", "Luego...", "A continuación...", "Una vez completado..."), alineados al orden y a los gaps reales.
6. Si faltan metadatos claros, deduce la intención por el contexto del formulario, encabezado o título del tutorial.
7. Devuelve ÚNICAMENTE el texto final del guión narrativo, listo para ser leído por un locutor o avatar (sin etiquetas de código, sin JSON, sin metadatos).`;

function stepContext(
  step: CaptureStep,
  originMs: number,
  previousMs: number | null
): Record<string, unknown> {
  const at = Date.parse(step.timestamp);
  const elapsedMs = Number.isFinite(at) ? Math.max(0, Math.round(at - originMs)) : 0;
  const gapMs =
    previousMs !== null && Number.isFinite(at)
      ? Math.max(0, Math.round(at - previousMs))
      : 0;

  return {
    stepNumber: step.stepNumber,
    timestamp: step.timestamp,
    elapsedMs,
    gapMs,
    action: step.action,
    description: step.description,
    ...(step.ariaLabel ? { ariaLabel: step.ariaLabel } : {}),
    ...(step.closestHeader ? { closestHeader: step.closestHeader } : {}),
    ...(step.formContext ? { formContext: step.formContext } : {}),
    ...(step.placeholder ? { placeholder: step.placeholder } : {}),
    ...(step.target.text ? { targetText: step.target.text } : {}),
  };
}

/**
 * Builds a copy-paste prompt from captured steps (UC-0004).
 * No network / no LLM SDKs — the author runs this in any external AI.
 */
export class AvatarPromptService {
  buildPrompt(session: TutorialSession): string | undefined {
    if (!session.steps.length) return undefined;

    // Prefer interaction steps; if none (only navigate / blank skip), still use all steps.
    const interactive = session.steps.filter((s) => s.action !== 'navigate');
    const used = interactive.length > 0 ? interactive : session.steps;

    const firstAt = Date.parse(used[0]?.timestamp ?? '');
    const originMs = Number.isFinite(firstAt) ? firstAt : Date.now();

    let previousMs: number | null = null;
    const steps = used.map((step) => {
      const ctx = stepContext(step, originMs, previousMs);
      const at = Date.parse(step.timestamp);
      previousMs = Number.isFinite(at) ? at : previousMs;
      return ctx;
    });

    const lastAt = Date.parse(used[used.length - 1]?.timestamp ?? '');
    const durationMs =
      Number.isFinite(lastAt) && Number.isFinite(originMs)
        ? Math.max(0, Math.round(lastAt - originMs))
        : 0;

    const payload = {
      title: session.title,
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
      'REGISTRO DE INTERACCIONES CON LÍNEA DE TIEMPO (JSON):',
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
