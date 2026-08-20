import { useEffect, useState } from 'react';
import type { CaptureBrowser, TutorialSession, TutorialSessionSummary } from '@toolsweb/shared';
import { StepPreview } from './StepPreview';

const API = '';

type ApiSession = {
  ok: boolean;
  session?: TutorialSession;
  summary?: TutorialSessionSummary;
  error?: string;
  warning?: string;
};

type ApiLogList = {
  ok: boolean;
  sessions?: TutorialSessionSummary[];
  activeSessionId?: string | null;
  recording?: boolean;
  error?: string;
};

export function App() {
  const [url, setUrl] = useState('https://example.com');
  const [title, setTitle] = useState('');
  const [browser, setBrowser] = useState<CaptureBrowser>('chrome');
  const [persistentProfile, setPersistentProfile] = useState(true);
  const [freshLogin, setFreshLogin] = useState(false);
  const [enableAvatarScript, setEnableAvatarScript] = useState(true);
  const [session, setSession] = useState<TutorialSession | null>(null);
  const [log, setLog] = useState<TutorialSessionSummary[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pastedScript, setPastedScript] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedVideoPrompt, setCopiedVideoPrompt] = useState(false);
  const [videoInfo, setVideoInfo] = useState<{
    stepCount: number;
    withNarration: number;
    privacyWarning: string;
  } | null>(null);
  const [videoJob, setVideoJob] = useState<{
    jobId: string;
    status: string;
    progress: number;
    error?: string;
    outputPath?: string;
  } | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [stepBumper, setStepBumper] = useState(true);
  const [stepBumperSeconds, setStepBumperSeconds] = useState(1.2);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  async function refreshLog() {
    try {
      const res = await fetch(`${API}/api/sessions`);
      const data = (await res.json()) as ApiLogList;
      if (res.ok && data.sessions) setLog(data.sessions);
      if (res.ok) {
        const active = data.activeSessionId ?? null;
        setActiveSessionId(active);
        // Re-sync UI if backend still has (or no longer has) a live recording.
        setRecording(Boolean(active));
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void refreshLog();
    void (async () => {
      try {
        const res = await fetch(`${API}/api/config`);
        const data = (await res.json()) as {
          ok?: boolean;
          enableAvatarScript?: boolean;
        };
        if (res.ok && data.ok && typeof data.enableAvatarScript === 'boolean') {
          setEnableAvatarScript(data.enableAvatarScript);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!recording || !session?.id) return;
    const id = session.id;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const statusRes = await fetch(`${API}/api/sessions`);
          const status = (await statusRes.json()) as ApiLogList;
          if (statusRes.ok) {
            const stillActive = Boolean(status.activeSessionId) && status.recording;
            if (!stillActive) {
              setRecording(false);
              setActiveSessionId(null);
              if (status.sessions) setLog(status.sessions);
              // Hydrate finished session for preview.
              const hydrated = await fetch(`${API}/api/sessions/${id}?withImages=1`);
              const data = (await hydrated.json()) as ApiSession;
              if (hydrated.ok && data.session) setSession(data.session);
              return;
            }
          }

          const res = await fetch(`${API}/api/sessions/${id}`);
          const data = (await res.json()) as ApiSession;
          if (res.ok && data.session) setSession(data.session);
        } catch {
          /* ignore transient poll errors */
        }
      })();
    }, 1200);
    return () => window.clearInterval(timer);
  }, [recording, session?.id]);

  async function startRecording() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ...(title.trim() ? { title: title.trim() } : {}),
          headless: false,
          browser,
          persistentProfile,
          freshLogin,
          enableAvatarScript,
        }),
      });
      const data = (await res.json()) as ApiSession;
      if (!res.ok || !data.session) {
        throw new Error(data.error ?? `Start failed (${res.status})`);
      }
      setSession(data.session);
      setRecording(true);
      setActiveSessionId(data.session.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function stopRecording() {
    const id = activeSessionId ?? session?.id;
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sessions/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id }),
      });
      const data = (await res.json()) as ApiSession;
      if (!res.ok || !data.session) {
        throw new Error(data.error ?? `Stop failed (${res.status})`);
      }
      setSession(data.session);
      setPastedScript('');
      setRecording(false);
      setActiveSessionId(null);
      if (data.warning) setError(data.warning);
      try {
        const hydrated = await fetch(`${API}/api/sessions/${data.session.id}?withImages=1`);
        const body = (await hydrated.json()) as ApiSession;
        if (hydrated.ok && body.session) {
          setSession({
            ...body.session,
            ...(data.session.avatarPrompt && !body.session.avatarPrompt
              ? { avatarPrompt: data.session.avatarPrompt }
              : {}),
            ...(data.session.fullScript && !body.session.fullScript
              ? { fullScript: data.session.fullScript }
              : {}),
            ...(data.session.videoPrompt && !body.session.videoPrompt
              ? { videoPrompt: data.session.videoPrompt }
              : {}),
          });
        }
      } catch {
        /* keep in-memory session */
      }
      await refreshLog();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await refreshLog();
    } finally {
      setBusy(false);
    }
  }

  async function savePastedScript() {
    if (!session?.id) return;
    if (!pastedScript.trim()) {
      setError('Pega el guión en el cuadro de texto antes de guardar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sessions/${session.id}/avatar-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText: pastedScript }),
      });
      const data = (await res.json()) as ApiSession;
      if (!res.ok || !data.session) {
        throw new Error(data.error ?? `No se pudo guardar el guión (${res.status})`);
      }
      setSession(data.session);
      setPastedScript(
        data.session.productionScript?.trim() ||
          data.session.fullScript?.spokenText?.trim() ||
          pastedScript
      );
      await refreshLog();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function forceStopRecording() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sessions/force-stop`, { method: 'POST' });
      const data = (await res.json()) as ApiSession & { recording?: boolean };
      if (!res.ok) throw new Error(data.error ?? `Force stop failed (${res.status})`);
      if (data.session) setSession(data.session);
      setRecording(false);
      setActiveSessionId(null);
      await refreshLog();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportFile(kind: 'html' | 'pdf', sessionId?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = sessionId
        ? await fetch(`${API}/api/export/${kind}/${sessionId}`, { method: 'POST' })
        : await fetch(`${API}/api/export/${kind}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session }),
          });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      const base =
        (sessionId
          ? log.find((x) => x.id === sessionId)?.title
          : session?.title)?.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'tutorial';
      a.download = `${base}.${kind}`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function openFromLog(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sessions/${id}?withImages=1`);
      const data = (await res.json()) as ApiSession;
      if (!res.ok || !data.session) {
        throw new Error(data.error ?? `Load failed (${res.status})`);
      }
      setSession(data.session);
      setPastedScript(
        data.session.productionScript?.trim() ||
          data.session.fullScript?.spokenText?.trim() ||
          ''
      );
      setRecording(false);
      setActiveSessionId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteFromLog(id: string) {
    if (!window.confirm('¿Eliminar esta captura de la bitácora? No se puede deshacer.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sessions/${id}`, { method: 'DELETE' });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok) {
        if (res.status === 409) {
          await forceStopRecording();
          const retry = await fetch(`${API}/api/sessions/${id}`, { method: 'DELETE' });
          const retryData = (await retry.json()) as { ok: boolean; error?: string };
          if (!retry.ok) throw new Error(retryData.error ?? `Delete failed (${retry.status})`);
        } else {
          throw new Error(data.error ?? `Delete failed (${res.status})`);
        }
      }
      if (session?.id === id) setSession(null);
      await refreshLog();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await refreshLog();
    } finally {
      setBusy(false);
    }
  }

  async function loadVideoProject() {
    if (!session?.id) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/sessions/${session.id}/video-project`, {
        method: 'POST',
      });
      const data = (await res.json()) as {
        ok: boolean;
        stepCount?: number;
        withNarration?: number;
        privacyWarning?: string;
        error?: string;
        errors?: Array<{ message: string }>;
      };
      if (!res.ok || !data.ok) {
        throw new Error(
          data.errors?.[0]?.message ?? data.error ?? `video-project failed (${res.status})`
        );
      }
      setVideoInfo({
        stepCount: data.stepCount ?? 0,
        withNarration: data.withNarration ?? 0,
        privacyWarning:
          data.privacyWarning ??
          'El video puede contener información visible en las capturas originales.',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function startVideoRender(silent: boolean) {
    if (!session?.id) return;
    setBusy(true);
    setError(null);
    setVideoPreviewUrl(null);
    try {
      const res = await fetch(`${API}/api/sessions/${session.id}/video-render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          silent,
          stepBumper,
          stepBumperSeconds,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        job?: {
          jobId: string;
          status: string;
          progress: number;
          error?: string;
          outputPath?: string;
        };
        error?: string;
      };
      if (!res.ok || !data.job) {
        throw new Error(data.error ?? `video-render failed (${res.status})`);
      }
      setVideoJob(data.job);
      const jobId = data.job.jobId;
      const sessionId = session.id;
      const poll = window.setInterval(() => {
        void (async () => {
          const r = await fetch(
            `${API}/api/sessions/${sessionId}/video-render/${jobId}`
          );
          const j = (await r.json()) as { ok: boolean; job?: typeof data.job };
          if (j.job) {
            setVideoJob(j.job);
            if (j.job.status === 'completed' || j.job.status === 'failed') {
              window.clearInterval(poll);
              setBusy(false);
              if (j.job.status === 'completed') {
                setVideoPreviewUrl(
                  `${API}/api/sessions/${sessionId}/video-preview?t=${Date.now()}`
                );
              }
            }
          }
        })();
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function openVideoPreview() {
    if (!session?.id) return;
    setError(null);
    const url = `${API}/api/sessions/${session.id}/video-preview`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
      });
      if (!res.ok) {
        let message = 'MP4 no generado. Usa «Generar MP4» primero.';
        const contentType = res.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        }
        throw new Error(message);
      }
      setVideoPreviewUrl(`${url}?t=${Date.now()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setVideoPreviewUrl(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-400">Toolsweb</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Tutorial Capture</h1>
        <p className="mt-3 max-w-xl text-slate-400">
          A browser window opens for the session. Click and type there — each action is captured with a
          highlight and screenshot. Al detener, la captura queda en la bitácora.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
        <label className="block text-sm text-slate-300">
          Target URL
          <input
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500 focus:ring-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={recording}
            placeholder="https://..."
          />
        </label>
        <label className="mt-4 block text-sm text-slate-300">
          Title (optional)
          <input
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500 focus:ring-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={recording}
            placeholder="How to reset a password"
          />
        </label>
        <label className="mt-4 block text-sm text-slate-300">
          Browser
          <select
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-emerald-500 focus:ring-2"
            value={browser}
            disabled={recording}
            onChange={(e) => setBrowser(e.target.value as CaptureBrowser)}
          >
            <option value="chrome">Google Chrome (instalado) — mejor para login Google</option>
            <option value="chromium">Chromium (Playwright)</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit (motor Safari)</option>
          </select>
        </label>
        <label className="mt-4 flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={persistentProfile}
            disabled={recording || freshLogin}
            onChange={(e) => setPersistentProfile(e.target.checked)}
          />
          <span>
            Perfil persistente (cookies / cuentas)
            {freshLogin ? (
              <span className="mt-1 block text-xs text-amber-300/90">
                Desactivado mientras “Iniciar sin sesión” está activo.
              </span>
            ) : null}
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={freshLogin}
            disabled={recording}
            onChange={(e) => setFreshLogin(e.target.checked)}
          />
          <span>
            Iniciar sin sesión (nuevo usuario)
            <span className="mt-1 block text-xs text-slate-500">
              Abre el navegador sin cookies guardadas para pedir login u otra cuenta. El perfil
              persistente no se borra.
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            className="mt-1"
            checked={enableAvatarScript}
            disabled={recording}
            onChange={(e) => setEnableAvatarScript(e.target.checked)}
          />
          <span>
            Prompt de avatar + metadata enriquecida
            <span className="mt-1 block text-xs text-slate-500">
              Al detener genera un prompt copiable (con metadatos aria/headers/form) para ejecutarlo
              en cualquier AI y luego pegar el guión aquí. Sin APIs embebidas.
            </span>
          </span>
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy || recording}
            onClick={() => void startRecording()}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            Start session
          </button>
          <button
            type="button"
            disabled={busy || !recording}
            onClick={() => void stopRecording()}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            Stop session
          </button>
          {activeSessionId && !recording && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void forceStopRecording()}
              className="rounded-lg border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-950 disabled:opacity-50"
            >
              Forzar detener (huérfana)
            </button>
          )}
          <button
            type="button"
            disabled={busy || !session || recording || session.steps.length === 0}
            onClick={() => void exportFile('html')}
            className="rounded-lg border border-emerald-700/60 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
          >
            Export HTML
          </button>
          <button
            type="button"
            disabled={busy || !session || recording || session.steps.length === 0}
            onClick={() => void exportFile('pdf')}
            className="rounded-lg border border-emerald-700/60 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
          >
            Export PDF
          </button>
        </div>

        {recording && (
          <p className="mt-4 text-sm text-emerald-300">
            Recording… interact in the Playwright browser window.
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-rose-800 bg-rose-950/50 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">Bitácora de capturas</h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refreshLog()}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
        {log.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aún no hay capturas guardadas. Detén una sesión para añadirla.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {log.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.stepCount} steps · {new Date(item.stoppedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || recording}
                    onClick={() => void openFromLog(item.id)}
                    className="rounded-md border border-slate-600 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    disabled={busy || recording}
                    onClick={() => void exportFile('html', item.id)}
                    className="rounded-md border border-emerald-800 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
                  >
                    HTML
                  </button>
                  <button
                    type="button"
                    disabled={busy || recording}
                    onClick={() => void exportFile('pdf', item.id)}
                    className="rounded-md border border-emerald-800 px-2 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
                  >
                    PDF
                  </button>
                  <button
                    type="button"
                    disabled={busy || recording}
                    onClick={() => void deleteFromLog(item.id)}
                    className="rounded-md border border-rose-800 px-2 py-1 text-xs font-semibold text-rose-300 hover:bg-rose-950 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {session && !recording && <StepPreview session={session} />}

      {session && !recording && !session.avatarPrompt && session.steps.length > 0 ? (
        <section className="rounded-2xl border border-amber-900/40 bg-slate-900/50 p-4 text-sm text-amber-100/90">
          Esta sesión no tiene prompt de avatar. Ábrela de nuevo desde la bitácora (se regenera) o graba otra
          con el checkbox <span className="font-semibold">Prompt de avatar + metadata</span> activo.
        </section>
      ) : null}

      {session && !recording && session.avatarPrompt ? (
        <section className="rounded-2xl border border-emerald-900/50 bg-slate-900/70 p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">
                Avatar · prompt para cualquier AI
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">1. Copia y ejecuta el prompt</h2>
              <p className="mt-1 text-xs text-slate-500">
                Pégalo en ChatGPT, Gemini, Claude, etc. La respuesta debe ser la tabla TSV de
                producción (Paso / Tiempo / Duración / Acción visual / Narración), una fila por
                captura.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              onClick={() => {
                void navigator.clipboard.writeText(session.avatarPrompt ?? '').then(() => {
                  setCopiedPrompt(true);
                  window.setTimeout(() => setCopiedPrompt(false), 2000);
                });
              }}
            >
              {copiedPrompt ? 'Copiado' : 'Copiar prompt'}
            </button>
          </div>
          <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-300">
            {session.avatarPrompt}
          </pre>

          <h3 className="mt-6 text-sm font-semibold text-white">2. Pega aquí el guión que devolvió la AI</h3>
          <p className="mt-1 text-xs text-slate-500">
            Se guarda en esta sesión de la bitácora. Al Abrir de nuevo, el texto vuelve a aparecer aquí.
            {session.fullScript?.spokenText || session.productionScript
              ? ' Hay un guión guardado: edítalo y pulsa Guardar para actualizar.'
              : ''}
          </p>
          <textarea
            className="mt-2 min-h-[140px] w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500 focus:ring-2"
            value={pastedScript}
            onChange={(e) => setPastedScript(e.target.value)}
            placeholder="Tabla TSV o guión narrativo…"
            disabled={busy}
          />
          <button
            type="button"
            disabled={busy || !pastedScript.trim()}
            className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            onClick={() => void savePastedScript()}
          >
            Guardar guión en la sesión
          </button>
        </section>
      ) : null}

      {session && !recording && session.fullScript?.spokenText ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/90">Guión guardado</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Locución para video</h2>
              <p className="mt-1 text-xs text-slate-500">
                ~{Math.round(session.fullScript.estimatedDurationSec)}s estimados
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              onClick={() => {
                void navigator.clipboard.writeText(session.fullScript?.spokenText ?? '');
              }}
            >
              Copiar guión
            </button>
          </div>
          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm leading-relaxed text-slate-200">
            {session.fullScript.spokenText}
          </pre>
          {session.fullScript.ssmlText ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-200">
                Ver SSML
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/80 p-3 font-mono text-[11px] text-slate-400">
                {session.fullScript.ssmlText}
              </pre>
            </details>
          ) : null}
        </section>
      ) : null}

      {session && !recording && session.videoPrompt ? (
        <section className="rounded-2xl border border-violet-900/50 bg-slate-900/70 p-6 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-violet-400/90">
                Video · prompt para AI de producción
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                3. Copia el prompt de video (guión + pantallas + tiempos)
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Pégalo en HeyGen, Synthesia, CapCut IA, Claude, etc. Incluye locución y timeline de
                pantallas.
              </p>
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
              onClick={() => {
                void navigator.clipboard.writeText(session.videoPrompt ?? '').then(() => {
                  setCopiedVideoPrompt(true);
                  window.setTimeout(() => setCopiedVideoPrompt(false), 2000);
                });
              }}
            >
              {copiedVideoPrompt ? 'Copiado' : 'Copiar prompt de video'}
            </button>
          </div>
          <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs leading-relaxed text-slate-300">
            {session.videoPrompt}
          </pre>
        </section>
      ) : null}

      {session && !recording ? (
        <section className="rounded-2xl border border-sky-900/50 bg-slate-900/70 p-6 shadow-xl">
          <p className="text-xs uppercase tracking-[0.18em] text-sky-400/90">Video tutorial</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Generación local (UC-0009)</h2>
          <p className="mt-2 text-xs text-amber-200/90">
            El video puede contener información visible en las capturas originales. Revísalo antes
            de compartirlo.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={stepBumper}
                onChange={(e) => setStepBumper(e.target.checked)}
                className="rounded border-slate-600"
              />
              Aviso «Paso N» entre escenas
            </label>
            <label className="inline-flex items-center gap-2">
              Pausa tras aviso (s)
              <input
                type="number"
                min={0}
                max={8}
                step={0.1}
                disabled={!stepBumper}
                value={stepBumperSeconds}
                onChange={(e) => setStepBumperSeconds(Number(e.target.value) || 0)}
                className="w-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 disabled:opacity-40"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
              onClick={() => void loadVideoProject()}
            >
              Validar fuente
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
              onClick={() => void startVideoRender(false)}
              title="Usa VIDEO_TTS_VOICE (Paulina / es_MX) si está en macOS"
            >
              Generar MP4 (voz)
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
              onClick={() => void startVideoRender(true)}
              title="Sin locución (WAV silenciosos)"
            >
              Generar MP4 (sin voz)
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-100 hover:bg-sky-950 disabled:opacity-50"
              onClick={() => void openVideoPreview()}
              title="Reproduce tutorial-final.mp4 si ya existe en disco"
            >
              Preview
            </button>
          </div>
          {videoInfo ? (
            <p className="mt-3 text-sm text-slate-300">
              {videoInfo.stepCount} pasos · {videoInfo.withNarration} con narración
            </p>
          ) : null}
          {videoJob ? (
            <p className="mt-2 font-mono text-xs text-slate-400">
              Job {videoJob.jobId.slice(0, 8)}… · {videoJob.status} · {videoJob.progress}%
              {videoJob.error ? ` · ${videoJob.error}` : ''}
              {videoJob.outputPath ? ` · ${videoJob.outputPath}` : ''}
            </p>
          ) : null}
          {videoPreviewUrl ? (
            <video
              key={videoPreviewUrl}
              className="mt-4 w-full rounded-xl border border-slate-800 bg-black"
              controls
              playsInline
              src={videoPreviewUrl}
            />
          ) : null}
        </section>
      ) : null}

      {session && recording && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold text-white">{session.title}</h2>
          <p className="mt-1 text-sm text-slate-400">
            Grabando… {session.steps.length} steps (el preview paso a paso queda disponible al detener).
          </p>
          <ol className="mt-4 max-h-60 space-y-2 overflow-auto">
            {session.steps.map((step) => (
              <li key={step.id} className="text-sm text-slate-300">
                <span className="mr-2 text-emerald-400">{step.stepNumber}.</span>
                {step.description}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
