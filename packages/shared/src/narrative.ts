import type { TutorialAction } from './types/action.js';
import { normalizeActions } from './normalizeActions.js';
import { REDACTED } from './privacy.js';


function labelFor(action: TutorialAction): string {
  const t = action.target;
  const raw =
    t?.accessibleName ||
    t?.ariaLabel ||
    t?.label ||
    t?.placeholder ||
    t?.text ||
    t?.name ||
    action.narrative ||
    '';
  const cleaned = String(raw).replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned === REDACTED) {
    if (action.type === 'navigation') {
      try {
        return new URL(action.url).pathname || 'la siguiente página';
      } catch {
        return 'la siguiente página';
      }
    }
    return 'el elemento indicado';
  }
  // Strip bridge descriptions like "Click on button: Foo"
  const m = cleaned.match(
    /^(?:Click on|Type into|Select in|Focus on|Open menu:)\s*[^:]+:\s*(.+)$/i
  );
  if (m?.[1]) return m[1].trim().slice(0, 80);
  return cleaned.slice(0, 80);
}

function quoted(label: string): string {
  return `“${label}”`;
}

/**
 * Deterministic single-step narration (Prompt Maestro §16). No LLM.
 */
export function generateNarrativeStep(action: TutorialAction): string {
  const label = labelFor(action);
  const dest = action.metadata.navigatedTo;

  switch (action.type) {
    case 'click':
    case 'doubleClick': {
      const base = `Haz clic en ${quoted(label)}.`;
      if (dest) {
        try {
          const path = new URL(dest).pathname;
          return `${base} Accederás a la sección ${quoted(path)}.`;
        } catch {
          return base;
        }
      }
      return base;
    }
    case 'input': {
      if (action.sensitive || action.value === REDACTED) {
        return `Ingresa el valor solicitado en ${quoted(label)}.`;
      }
      return `Ingresa la información en ${quoted(label)}.`;
    }
    case 'change':
    case 'select':
      return `Selecciona una opción en ${quoted(label)}.`;
    case 'submit':
      return `Una vez completados los datos, envía el formulario ${quoted(label)}.`;
    case 'navigation':
      return `A continuación, accede a la sección ${quoted(label)}.`;
    case 'scroll':
      return `Desplázate en la página hasta visualizar ${quoted(label)}.`;
    case 'keyboard':
      return `Usa el teclado para continuar con ${quoted(label)}.`;
    case 'interfaceChange':
      return `Observa el cambio en la interfaz: ${quoted(label)}.`;
    default:
      return `Continúa con ${quoted(label)}.`;
  }
}

function connectorFor(index: number, total: number): string {
  if (total <= 1) return 'Primero';
  if (index === 0) return 'Primero';
  if (index === total - 1) return 'Finalmente';
  const midOptions = ['Luego', 'A continuación', 'Después'] as const;
  return midOptions[(index - 1) % midOptions.length] ?? 'Luego';
}

export type DeterministicNarration = {
  steps: Array<{ sequence: number; spokenText: string }>;
  fullSpokenText: string;
};

/**
 * Normalize actions then build a connected Spanish narration suitable for avatar readout.
 */
export function generateDeterministicNarration(
  actions: TutorialAction[],
  options?: { title?: string }
): DeterministicNarration {
  const normalized = normalizeActions(actions);
  const steps = normalized.map((action, index) => {
    const line = generateNarrativeStep(action);
    const prefix = connectorFor(index, normalized.length);
    const spokenText = `${prefix}, ${line.charAt(0).toLowerCase()}${line.slice(1)}`;
    return { sequence: action.sequence, spokenText };
  });

  const body = steps.map((s) => s.spokenText).join(' ');
  const title = options?.title?.trim();
  const fullSpokenText = title
    ? `En este tutorial, “${title}”, te guiaré paso a paso. ${body}`
    : body;

  return { steps, fullSpokenText };
}
