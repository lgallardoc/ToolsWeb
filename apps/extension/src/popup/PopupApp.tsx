import { useCallback, useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import type {
  ActionSession,
  ActionSessionStatus,
  ExtensionMessage,
  ExtensionResponse,
} from '@toolsweb/shared';

async function send(msg: ExtensionMessage): Promise<ExtensionResponse> {
  const res = (await browser.runtime.sendMessage(msg)) as ExtensionResponse;
  return res ?? { ok: false, error: 'Sin respuesta del background' };
}

async function activeTabUrl(): Promise<string | undefined> {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tabs[0]?.url;
  if (!url || url.startsWith('chrome://') || url.startsWith('about:')) return undefined;
  return url;
}

export function PopupApp() {
  const [status, setStatus] = useState<ActionSessionStatus>('idle');
  const [session, setSession] = useState<ActionSession | null>(null);
  const [tabUrl, setTabUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [url, res] = await Promise.all([
        activeTabUrl(),
        send({ type: 'GET_SESSION' }),
      ]);
      if (url) setTabUrl(url);
      if (!res.ok) {
        setError(res.error ?? 'No se pudo leer la sesión');
        return;
      }
      setStatus(res.state?.status ?? 'idle');
      setSession(res.session ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = async (msg: ExtensionMessage) => {
    setBusy(true);
    setError(null);
    try {
      const res = await send(msg);
      if (!res.ok) {
        setError(res.error ?? 'Operación fallida');
      }
      setStatus(res.state?.status ?? 'idle');
      setSession(res.session ?? null);
      if (msg.type === 'EXPORT_SESSION' && res.exportJson) {
        const blob = new Blob([res.exportJson], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = `toolsweb-session-${res.session?.id ?? 'export'}.json`;
        a.click();
        URL.revokeObjectURL(href);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const recording = status === 'recording';
  const paused = status === 'paused';
  const idle = status === 'idle' || status === 'completed';
  const actionCount = session?.actions.length ?? 0;

  return (
    <div className="popup">
      <h1>Toolsweb</h1>
      <p className="meta">
        <span>
          Estado:{' '}
          <strong className={recording ? 'status-recording' : undefined}>
            {status === 'recording'
              ? 'Grabando'
              : status === 'paused'
                ? 'Pausado'
                : status === 'completed'
                  ? 'Finalizado'
                  : 'Inactivo'}
          </strong>
        </span>
        <span className="url" title={tabUrl || undefined}>
          Página: <strong>{tabUrl || '—'}</strong>
        </span>
        <span>
          Pasos: <strong>{actionCount}</strong>
        </span>
      </p>

      <div className="actions" role="group" aria-label="Controles de grabación">
        <button
          type="button"
          className="primary"
          disabled={busy || !idle}
          onClick={() =>
            void run({
              type: 'START_RECORDING',
              payload: {
                name: `Tutorial — ${tabUrl ? new URL(tabUrl).hostname : 'web'}`,
                ...(tabUrl ? { initialUrl: tabUrl } : {}),
              },
            })
          }
        >
          Iniciar
        </button>
        <button
          type="button"
          disabled={busy || !recording}
          onClick={() => void run({ type: 'PAUSE_RECORDING' })}
        >
          Pausar
        </button>
        <button
          type="button"
          disabled={busy || !paused}
          onClick={() => void run({ type: 'RESUME_RECORDING' })}
        >
          Reanudar
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy || idle}
          onClick={() => void run({ type: 'STOP_RECORDING' })}
        >
          Finalizar
        </button>
        <button
          type="button"
          disabled={busy || !session || actionCount === 0}
          onClick={() => void run({ type: 'EXPORT_SESSION' })}
          style={{ gridColumn: '1 / -1' }}
        >
          Exportar JSON
        </button>
      </div>

      {error ? <p className="error" role="alert">{error}</p> : null}
      <p className="hint">
        Grabación event-first en la pestaña activa (UC-0006). Bridge Playwright sigue
        disponible en la app web.
      </p>
    </div>
  );
}
