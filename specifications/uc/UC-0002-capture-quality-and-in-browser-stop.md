---
id: UC-0002
title: Calidad de captura (screenshot sync)
status: approved
date: 2026-08-02
updated: 2026-08-19
actors: [Author]
---

# UC-0002 — Calidad de captura

## Objetivo

1. Densidad suficiente para ver el **flujo de opciones** (apertura de menús, focus de campos, cada selección).
2. El screenshot de **click/input/select** debe capturar la vista útil (freeze + settle instantáneo cuando aplica); el highlight coincide con esa vista.
3. Detener la grabación desde la **UI Toolsweb** (Stop session). No hay botón flotante en el browser capturado.

## Flujo

1. Autor inicia sesión de captura.
2. Interactúa en la ventana Playwright.
3. En clicks que puedan cambiar de vista: se congela el gesto → highlight → screenshot rápido → se reproduce el click. Form fields, combobox y menús **no** se congelan.
4. Se generan pasos adicionales de densidad:
   - **focus** de input/textarea/select/combobox (action `input`, descripción “Focus on…”) — **primera muestra** del campo.
   - **valor final** de input/textarea/contenteditable al **blur/change** o tras **500 ms** sin teclear — **última muestra**; los eventos `input` intermedios **no** generan pasos (UC-0002).
   - **apertura de menú/listbox** tras click en opener (segundo shot ~250ms si `aria-expanded` o listbox/menu visible).
   - cada **cambio** de `<select>` / option / menuitem (action `select`).
5. Blank-skip (≥90% uniforme) **solo** para `navigate` **excepto** hosts OAuth. `click` / `input` / `select` se conservan aunque el PNG sea claro/casi vacío.
6. El anillo/cursor de highlight lo limpia **solo Node tras el screenshot**. El `emit` del browser no hace `clearHighlight` (evita carrera que borraba el foco en click/select de listbox).
7. Binding vía `context.exposeBinding` + **cola in-page** (`__toolswebQueue`) drenada por Node cada ~80ms (default; no es FPS de video — es polling de cola).
8. `pointerdown` captura opciones de listbox antes de que el DOM las desmonte; `click` congela navegaciones. Ack de freeze vía `__toolswebFreezeAck`.
9. **OAuth / Google login**: al navegar a un host de autenticación (`isSensitiveAuthUrl`), siempre se genera paso `navigate` con screenshot (sin blank-skip); settle hasta `CAPTURE_AUTH_NAVIGATE_TIMEOUT_MS` (default 8s). Los pasos `navigate` se encolan aunque haya un shot en curso (no se pierde el redirect). **En hosts OAuth no se usa freeze de click** (Siguiente / Next deben funcionar nativamente; captura vía pointerdown).
10. Autor pulsa **Stop session** en la UI → sesión se cierra y se guarda en bitácora.

## Reglas

- Clicks en `[data-toolsweb="chrome"]` / highlight no generan pasos.
- `navigate` sí espera estabilización larga (load/network); OAuth hasta 8s por defecto.
- OAuth: imágenes de login se conservan; metadatos sanitizados (PRIVACY).
- `freshLogin` / perfil persistente no cambian por este UC.
- `click` / `select` con `clickPoint` usan anillo rojo + cursor; focus de campo usa anillo verde.
- Input/textarea: máximo **2** capturas por edición (focus + valor final si cambió); no un paso por tecla.
- Si falta `boundingBox`, se sintetiza un anillo 56×56 alrededor de `clickPoint`.
- Bridge Playwright temporal (ADR-0004); destino WebExtensions.
