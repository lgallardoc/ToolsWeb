---
id: UC-0002
title: Calidad de captura (screenshot sync)
status: approved
date: 2026-08-02
updated: 2026-08-03
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
   - **focus** de input/textarea/select/combobox (action `input`, descripción “Focus on…”).
   - **apertura de menú/listbox** tras click en opener (segundo shot ~250ms si `aria-expanded` o listbox/menu visible).
   - cada **cambio** de `<select>` / option / menuitem (action `select`).
5. Blank-skip (≥90% uniforme) **solo** para `navigate`. `click` / `input` / `select` se conservan aunque el PNG sea claro/casi vacío.
6. El anillo/cursor de highlight lo limpia **solo Node tras el screenshot**. El `emit` del browser no hace `clearHighlight` (evita carrera que borraba el foco en click/select de listbox).
7. Binding vía `context.exposeBinding` (sobrevive navegaciones). Gestos no-freeze se encolan en Node **sin bloquear** el browser (evita perder clicks/teclas mientras la cola de PNG drena).
8. `pointerdown` captura opciones de listbox antes de que el DOM las desmonte; `click` congela navegaciones.
9. Autor pulsa **Stop session** en la UI → sesión se cierra y se guarda en bitácora.

## Reglas

- Clicks en `[data-toolsweb="chrome"]` / highlight no generan pasos.
- `navigate` sí espera estabilización larga (load/network).
- `freshLogin` / perfil persistente no cambian por este UC.
- `click` / `select` con `clickPoint` usan anillo rojo + cursor; focus de campo usa anillo verde.
- Si falta `boundingBox`, se sintetiza un anillo 56×56 alrededor de `clickPoint`.
