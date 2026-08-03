# Toolsweb — ROADMAP

## Activo (version2)

1. **Estabilizar bridge Playwright** — clicks/input/select + highlight sincronizado (UC-0002).
2. **ADR-0004** — pivot a WebExtensions / event-first (Prompt Maestro).
3. Contratos Zod enriquecidos alineados al modelo del Prompt Maestro (`TutorialAction`, viewport, locators, `sensitive`).
4. PrivacyFilter ampliado + `docs/PRIVACY.md`.
5. Narración determinista + normalización/agrupación (sin IA).

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
