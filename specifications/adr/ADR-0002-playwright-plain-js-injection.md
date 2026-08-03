---
id: ADR-0002
title: Playwright browser injection as plain JS string
status: accepted
date: 2026-08-02
---

# ADR-0002 — Init script de captura como JS plano

## Contexto

Playwright serializa `addInitScript` / `evaluate` para ejecutarlos en el browser. TypeScript tipado (interfaces, annotations) rompe en runtime.

## Decisión

Mantener `CAPTURE_INIT_SCRIPT` como **string JavaScript** en `packages/backend/src/services/recorder/captureInitScript.ts`.  
La lógica Node tipada vive en `RecorderService`.

## Consecuencias

- No “migrar” el init script a TS function toString().
- Smoke de click/input debe cubrir el bridge `window.__toolswebCapture`.
