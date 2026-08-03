---
id: UC-0005
title: Extension EventRecorder and messaging
status: approved
date: 2026-08-03
updated: 2026-08-03
actors: [Author]
---

# UC-0005 — EventRecorder (extensión)

## Objetivo

Registrar acciones en el content script (event-first) y persistirlas en el background vía mensajes validados con Zod, sin CDP.

## Flujo

1. Cliente envía `START_RECORDING` al background.
2. Background crea `ActionSession` (status `recording`) y difunde `RECORDING_STATE`.
3. Content inicia `EventRecorder` (click, dblclick, input debounce, change, submit).
4. Cada gesto → `RECORDED_ACTION` → background asigna `id` / `sequence` / `sessionId`.
5. `PAUSE` / `RESUME` / `STOP` actualizan estado y el content arranca/detiene listeners.
6. `EXPORT_SESSION` devuelve JSON de `ActionSession`.

## Reglas

- Validar todo mensaje con `ExtensionMessageSchema`.
- Ignorar UI con `data-tutorial-recorder-ui="true"`.
- `composedPath()` para Shadow DOM abierto.
- Privacidad vía `filterFieldValue` / `analyzeElement`.
- Bridge Playwright sigue siendo el runtime productivo hasta pack de extensión (ADR-0004).

## Contratos

- `@toolsweb/shared` — `extensionMessages.ts`, `TutorialAction`, `ActionSession`
