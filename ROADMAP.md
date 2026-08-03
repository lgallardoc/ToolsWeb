# Toolsweb — ROADMAP

## Activo (version2)

1. **Estabilizar bridge Playwright** — clicks/input/select + highlight sincronizado (UC-0002).
2. **ADR-0004** — pivot a WebExtensions / event-first (Prompt Maestro).
3. Contratos Zod enriquecidos alineados al modelo del Prompt Maestro (`TutorialAction`, viewport, locators, `sensitive`) — **ADR-0005** (dual con `CaptureStep`).
4. PrivacyFilter ampliado + `docs/PRIVACY.md` — **hecho** (Prompt Maestro §8).
5. Narración determinista + normalización/agrupación (sin IA) — **hecho** (§16–17); borrador incluido en `avatarPrompt`.
6. Scaffold WebExtensions / Studio (ADR-0006) — **hecho** (`apps/extension`, `apps/studio`).
7. EventRecorder en content script + mensajería Zod.
8. Popup start/pause/stop + SessionRepository.
9. Studio: import JSON / edición de pasos.

## Migración WebExtensions (destino)

Orden sugerido (Prompt Maestro §23):

1. Fundaciones monorepo / contracts / Vitest.
2. Núcleo semántico (`analyzeElement`).
3. Privacidad.
4. EventRecorder (delegation, debounce input, keyboard relevante).
5. Extensión Chromium.
6. Firefox adapters.
7. SPA history + MutationObserver (`interfaceChange`).
8. Tutorial engine (normalize / group / narrative).
9. Studio React (edición de pasos).
10. Vista previa con bounding boxes / cursor.

## Deprecación

- Playwright CDP capture, Express recorder y screenshots-por-acción: **bridge** hasta que la extensión cubra el flujo de grabación + export.
- npm workspaces → evaluar pnpm en ADR de follow-up al crear `apps/extension` + `apps/studio`.

## Posterior

- Capturas estratégicas (no por cada gesto).
- Auth / sync / backend cloud.
- Guion IA (sigue ADR-0003: prompt exportable).
- Voz / Remotion / FFmpeg / MP4.
- Safari packaging.
