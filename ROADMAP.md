# Toolsweb — ROADMAP

## Hecho (integrado en main)

1. Bridge Playwright estabilizado — cola in-page + highlights (UC-0002).
2. **ADR-0004** — pivot WebExtensions documentado; Playwright como bridge.
3. Contratos duales `CaptureStep` + `TutorialAction` — **ADR-0005**.
4. PrivacyFilter + `docs/PRIVACY.md`.
5. Narración determinista + normalización (sin IA) en `avatarPrompt`.
6. Scaffold `apps/extension` + `apps/studio` — **ADR-0006**.
7. EventRecorder + mensajería Zod — **UC-0005**.
8. Popup start/pause/stop/export — **UC-0006**.
9. Studio import/edit/export ActionSession — **UC-0007**.
10. Prompt de producción de video — **UC-0008**.
11. Prompt avatar formato Synthesia TSV + import (`productionScript`, subtítulos preview/export) — **UC-0004**.

## Activo

1. Pack Firefox + build unificado de la extensión.
2. Preview visual con bounding boxes / cursor (Prompt Maestro §23 Fase 10).
3. Migrar el flujo de autoría primario de Playwright → extensión cuando el pack esté listo.

## Migración WebExtensions (destino)

Orden sugerido (Prompt Maestro §23):

1. Fundaciones monorepo / contracts / Vitest — *parcial*.
2. Núcleo semántico (`analyzeElement`).
3. Privacidad — *hecho en shared*.
4. EventRecorder — *hecho (Chromium)*.
5. Extensión Chromium — *MVP*.
6. Firefox adapters / pack.
7. SPA history + MutationObserver (`interfaceChange`).
8. Tutorial engine (normalize / group / narrative) — *parcial en shared*.
9. Studio React — *MVP*.
10. Vista previa con bounding boxes / cursor.

## Deprecación

- Playwright CDP capture, Express recorder y screenshots-por-acción: **bridge** hasta que la extensión cubra grabación + bitácora + export.
- Evaluar pnpm en ADR de follow-up si el monorepo crece.

## Posterior

- Capturas estratégicas (no por cada gesto).
- Auth / sync / backend cloud.
- Integraciones opcionales de voz / Remotion / FFmpeg / MP4 (siempre fuera del core, ADR-0003).
- Safari packaging.
