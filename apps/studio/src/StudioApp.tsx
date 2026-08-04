import { useMemo, useState } from 'react';
import {
  ActionSessionSchema,
  REDACTED,
  generateDeterministicNarration,
  type ActionSession,
  type TutorialAction,
} from '@toolsweb/shared';

function bestLocator(action: TutorialAction): string {
  const list = [...(action.target?.locatorCandidates ?? [])].sort(
    (a, b) => b.score - a.score
  );
  const top = list[0];
  return top ? `${top.strategy}: ${top.value}` : '—';
}

function displayValue(action: TutorialAction): string {
  if (action.sensitive) return REDACTED;
  return action.value || action.target?.text || '—';
}

function resequence(actions: TutorialAction[]): TutorialAction[] {
  return actions.map((a, i) => ({ ...a, sequence: i + 1 }));
}

function downloadJson(session: ActionSession): void {
  const blob = new Blob([JSON.stringify(session, null, 2)], {
    type: 'application/json',
  });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = `toolsweb-studio-${session.id}.json`;
  a.click();
  URL.revokeObjectURL(href);
}

export function StudioApp() {
  const [session, setSession] = useState<ActionSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fullNarration = useMemo(() => {
    if (!session) return '';
    return generateDeterministicNarration(session.actions, {
      title: session.name,
    }).fullSpokenText;
  }, [session]);

  const onImport = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      const parsed = ActionSessionSchema.parse(json);
      setSession(parsed);
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const updateActions = (updater: (actions: TutorialAction[]) => TutorialAction[]) => {
    setSession((prev) => {
      if (!prev) return prev;
      return { ...prev, actions: resequence(updater(prev.actions)) };
    });
  };

  const move = (index: number, delta: number) => {
    updateActions((actions) => {
      const next = [...actions];
      const target = index + delta;
      if (target < 0 || target >= next.length) return actions;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  };

  const removeAt = (index: number) => {
    updateActions((actions) => actions.filter((_, i) => i !== index));
  };

  const setNarrative = (index: number, narrative: string) => {
    updateActions((actions) =>
      actions.map((a, i) => (i === index ? { ...a, narrative } : a))
    );
  };

  const regenerateNarratives = () => {
    setSession((prev) => {
      if (!prev) return prev;
      const draft = generateDeterministicNarration(prev.actions, {
        title: prev.name,
      });
      const bySeq = new Map(draft.steps.map((s) => [s.sequence, s.spokenText]));
      return {
        ...prev,
        actions: prev.actions.map((a) => ({
          ...a,
          narrative: bySeq.get(a.sequence) ?? a.narrative,
        })),
      };
    });
  };

  return (
    <div className="studio">
      <header>
        <h1>Toolsweb Studio</h1>
        <p>Importa, edita y exporta sesiones `ActionSession` (UC-0007).</p>
      </header>

      <div className="toolbar">
        <label className="file">
          Importar JSON
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => void onImport(e.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          className="primary"
          disabled={!session}
          onClick={() => session && downloadJson(session)}
        >
          Exportar JSON
        </button>
        <button
          type="button"
          disabled={!session || session.actions.length === 0}
          onClick={regenerateNarratives}
        >
          Regenerar narración
        </button>
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {!session ? (
        <div className="empty">Selecciona un JSON exportado por la extensión.</div>
      ) : (
        <>
          <section className="summary" aria-label="Resumen de sesión">
            <span>
              Nombre: <strong>{session.name}</strong>
            </span>
            <span>
              Estado: <strong>{session.status}</strong>
            </span>
            <span>
              URL inicial: <strong>{session.initialUrl}</strong>
            </span>
            <span>
              Inicio:{' '}
              <strong>{new Date(session.startedAt).toLocaleString()}</strong>
            </span>
            <span>
              Pasos: <strong>{session.actions.length}</strong>
            </span>
          </section>

          <section aria-label="Narración completa">
            <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>Narración determinista</h2>
            <div className="narrative-preview">{fullNarration || '—'}</div>
          </section>

          <ol className="steps">
            {session.actions.map((action, index) => (
              <li key={action.id} className="step">
                <div className="step-head">
                  <h2>
                    Paso {action.sequence}{' '}
                    <span className="badge">{action.type}</span>
                  </h2>
                  <div className="step-actions">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Subir paso"
                    >
                      Subir
                    </button>
                    <button
                      type="button"
                      disabled={index === session.actions.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Bajar paso"
                    >
                      Bajar
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAt(index)}
                      aria-label="Eliminar paso"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
                <div className="meta-grid">
                  <span>
                    Descripción / valor: <strong>{displayValue(action)}</strong>
                  </span>
                  <span>
                    Contexto:{' '}
                    <strong>
                      {action.target?.closestHeader ||
                        action.target?.formContext ||
                        action.target?.accessibleName ||
                        '—'}
                    </strong>
                  </span>
                  <span>
                    Localizador: <strong>{bestLocator(action)}</strong>
                  </span>
                  <span>
                    Posición:{' '}
                    <strong>
                      {action.target?.boundingBox
                        ? `${Math.round(action.target.boundingBox.x)}, ${Math.round(action.target.boundingBox.y)} · ${Math.round(action.target.boundingBox.width)}×${Math.round(action.target.boundingBox.height)}`
                        : '—'}
                    </strong>
                  </span>
                  <span>
                    URL: <strong>{action.url}</strong>
                  </span>
                </div>
                <label>
                  Narración
                  <textarea
                    value={action.narrative ?? ''}
                    onChange={(e) => setNarrative(index, e.target.value)}
                    aria-label={`Narración del paso ${action.sequence}`}
                  />
                </label>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
