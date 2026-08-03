---
id: UC-0001
title: Preview paginado de pasos de una TutorialSession
status: approved
date: 2026-08-02
actors: [Author]
---

# UC-0001 — Preview paso a paso

## Objetivo

Permitir revisar una captura **como presentación HTML5** (estilo diapositiva): un paso a la vez, barra de progreso, transición, teclado ←/→ y pantalla completa.

## Flujo principal

1. Autor abre una sesión (Stop o bitácora con imágenes).
2. Ve una “diapositiva” con screenshot + pie de descripción.
3. Navega con **Siguiente / Anterior**, teclado, o indicadores de progreso.
4. Opcional: **Pantalla completa** (Fullscreen API).
5. En el último paso se indica fin del recorrido.

## Contratos

- `GET /api/sessions/:id?withImages=1` para hidratar `imageBase64` desde disco cifrado.

## verifiedBy

- Manual / futuro `TEST-0001` (UAT automatizada pendiente — ASSUMP).
