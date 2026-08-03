---
id: ADR-0004
title: Pivot architecture toward WebExtensions (Prompt Maestro)
status: accepted
date: 2026-08-03
updated: 2026-08-03
---

# ADR-0004 — Pivot a WebExtensions (event-first)

## Contexto

El documento *Prompt Maestro para Cursor* define un MVP basado en:

- WebExtensions (Chromium + Firefox; Safari aplazado).
- Captura principalmente por **eventos del DOM**, semántica ARIA y localizadores — no por screenshot de cada acción.
- Núcleo compartido (`packages/core` / contracts) sin React ni CDP.
- Studio React + narración determinista; capturas estratégicas y tipado de timeline como capa posterior.

Toolsweb hoy (TW-000 / ADR-0001–0003) usa **npm workspaces + Express + Playwright** con screenshot por interacción. Eso contradice el principio event-first y el aislado de CDP del Prompt Maestro.

## Decisión

1. **Línea objetivo (version2+):** migrar a la arquitectura WebExtensions del Prompt Maestro (extension + studio + core/contracts/tutorial-engine).
2. **Playwright + Express** quedan como **runtime bridge temporal** para no perder bitácora / export HTML-PDF mientras el MVP extensión no esté listo. Van a ROADMAP de deprecación, no como destino.
3. Nuevos contratos Zod y el EventRecorder deben diseñarse **neutrales** (sin `chrome.*` ni CDP en el núcleo), reutilizables por el bridge Playwright y por content scripts.
4. Qualquier cambio de stack (pnpm, apps/extension, etc.) requiere actualización de TW-000 o ADR de follow-up; este ADR autoriza el pivot de captura.

## Consecuencias

- Corto plazo: corregir y estabilizar la captura Playwright (clicks / highlight) como puente.
- Medio plazo: Fase 1–10 del Prompt Maestro (contracts → semantic → privacy → recorder → extension → studio).
- Documentar limitaciones (iframes cross-origin, canvas, Shadow cerrado) desde la extensión.

## Relación

- Constituciones TW-000 / VOL-000 deben alinearse en follow-up (stack canónico).
- ADR-0002 (init JS plano Playwright) sigue vigente **solo** mientras el bridge Playwright exista.
