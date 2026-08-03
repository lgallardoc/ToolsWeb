---
id: ADR-0005
title: Dual contract model during WebExtensions migration
status: accepted
date: 2026-08-03
updated: 2026-08-03
---

# ADR-0005 — Contratos duales (CaptureStep + TutorialAction)

## Contexto

ADR-0004 pivota hacia el modelo del Prompt Maestro (`TutorialAction` / sesión event-first). El bridge Playwright actual persiste `CaptureStep` + screenshots (TW-000 / UC-0002–0004).

Sustituir de golpe `CaptureStep` rompería bitácora, export HTML/PDF y la UI.

## Decisión

1. **`CaptureStep` / `TutorialSession` (steps)** siguen siendo el contrato del **bridge Playwright** y exports actuales.
2. Se añaden en `@toolsweb/shared` los schemas canónicos del Prompt Maestro: `TutorialAction`, `SemanticTarget`, `LocatorCandidate`, `ViewportState`, etc.
3. Ambos conviven hasta que el EventRecorder WebExtensions sea el productor principal.
4. Se exporta un mapper `captureStepToTutorialAction` (best-effort) para ir alineando Studio/narración al modelo canónico.
5. Vitest queda para la fase monorepo extensión; validación inmediata vía script Node/`tsx` sobre fixtures Zod.

## Consecuencias

- Sin breaking change en API/bitácora.
- Studio/narración futuros deben consumir `TutorialAction`.
- Cuando el bridge se deprecie, `CaptureStep` se elimina o queda como adaptador legacy.
