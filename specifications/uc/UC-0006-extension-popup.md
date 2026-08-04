---
id: UC-0006
title: Extension popup recording controls
status: approved
date: 2026-08-03
updated: 2026-08-03
actors: [Author]
---

# UC-0006 — Popup de grabación (extensión)

## Objetivo

Controlar la sesión de grabación desde el popup React (start / pause / resume / stop / export JSON) vía mensajes Zod al background.

## Flujo

1. Autor abre el popup.
2. Ve estado, URL de la pestaña activa y conteo de acciones.
3. **Iniciar** → `START_RECORDING` (initialUrl = tab URL).
4. **Pausar** / **Reanudar** / **Finalizar** según estado.
5. **Exportar JSON** → descarga `ActionSession` como archivo.

## Reglas

- Botones habilitados según `ActionSession.status`.
- Accesible por teclado.
- No usar `chrome.*` directo — `webextension-polyfill`.
- Build Vite + `@crxjs/vite-plugin` (Chromium MV3). Firefox pack en fase posterior.

## Relacionado

- UC-0005 EventRecorder / messaging
- ADR-0006 scaffold
