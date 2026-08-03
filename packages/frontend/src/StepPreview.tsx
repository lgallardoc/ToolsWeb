import { useCallback, useEffect, useRef, useState } from 'react';
import type { TutorialSession } from '@toolsweb/shared';

type Props = {
  session: TutorialSession;
};

/**
 * UC-0001 — preview tipo presentación (HTML5):
 * slide, barra de progreso, transiciones, teclado ←/→ y fullscreen.
 */
export function StepPreview({ session }: Props) {
  const [index, setIndex] = useState(0);
  const [enter, setEnter] = useState(true);
  const stageRef = useRef<HTMLElement | null>(null);
  const total = session.steps.length;
  const step = total > 0 ? session.steps[index] : undefined;

  useEffect(() => {
    setIndex(0);
  }, [session.id]);

  useEffect(() => {
    if (total === 0) {
      setIndex(0);
      return;
    }
    if (index > total - 1) setIndex(total - 1);
  }, [total, index]);

  const goTo = useCallback(
    (next: number) => {
      if (total === 0) return;
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === index) return;
      setEnter(false);
      window.setTimeout(() => {
        setIndex(clamped);
        setEnter(true);
      }, 160);
    },
    [index, total]
  );

  const toggleFullscreen = useCallback(async () => {
    const el = stageRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(total - 1);
      } else if (e.key === 'Escape' && document.fullscreenElement) {
        void document.exitFullscreen();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        void toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index, total, toggleFullscreen]);

  if (total === 0 || !step) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-white">{session.title}</h2>
        <p className="mt-2 text-sm text-slate-500">Sin pasos para previsualizar.</p>
      </section>
    );
  }

  const isFirst = index === 0;
  const isLast = index === total - 1;
  const progress = ((index + 1) / total) * 100;

  return (
    <section
      ref={stageRef}
      className="overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-2xl shadow-emerald-950/20"
    >
      <div className="h-1.5 w-full bg-slate-800">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-300 transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-[0.18em] text-emerald-400/90">Presentación</p>
          <h2 className="truncate text-lg font-semibold text-white">{session.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            title="Pantalla completa (HTML5 Fullscreen API)"
          >
            Pantalla completa
          </button>
        </div>
      </div>

      <div className="relative mx-4 mb-2 aspect-[16/10] overflow-hidden rounded-xl border border-slate-700 bg-slate-950">
        <div
          key={step.id}
          className={`absolute inset-0 flex flex-col transition-all duration-300 ease-out ${
            enter ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'
          }`}
        >
          <div className="flex min-h-0 flex-1 items-center justify-center bg-[radial-gradient(ellipse_at_center,_#1e293b_0%,_#020617_70%)] p-3 sm:p-5">
            {step.imageBase64 ? (
              <img
                className="max-h-full max-w-full rounded-md object-contain shadow-2xl shadow-black/50 ring-1 ring-white/10"
                src={`data:image/png;base64,${step.imageBase64}`}
                alt={`Paso ${step.stepNumber}`}
              />
            ) : (
              <p className="text-sm text-slate-500">Sin captura de pantalla para este paso.</p>
            )}
          </div>
          <div className="border-t border-slate-800 bg-slate-900/95 px-4 py-3 backdrop-blur">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-slate-950">
                {step.stepNumber}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white sm:text-base">{step.description}</p>
                {step.avatarScript?.spokenText ? (
                  <p className="mt-2 text-sm leading-relaxed text-emerald-100/90">
                    <span className="mr-2 text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
                      Guión
                    </span>
                    {step.avatarScript.spokenText}
                  </p>
                ) : null}
                <p className="mt-1 truncate font-mono text-[11px] text-slate-400">
                  {step.action} · {step.url}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => goTo(index - 1)}
          className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-800 disabled:opacity-35"
        >
          ← Anterior
        </button>
        <p className="text-center text-xs text-slate-500">
          {isLast ? 'Fin de la presentación' : 'Teclas ← → · Espacio · F (fullscreen)'}
        </p>
        <button
          type="button"
          disabled={isLast}
          onClick={() => goTo(index + 1)}
          className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-35"
        >
          Siguiente →
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto border-t border-slate-800 px-4 py-3">
        {session.steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(i)}
            className={`h-2 w-8 shrink-0 rounded-full transition ${
              i === index ? 'bg-emerald-400' : i < index ? 'bg-emerald-800' : 'bg-slate-700'
            }`}
            aria-label={`Ir al paso ${i + 1}`}
            title={`Paso ${i + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
