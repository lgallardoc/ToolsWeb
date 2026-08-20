---
id: ADR-0008
title: Cinematic camera in local video renderer (Screen Studio–style, no live capture)
status: accepted
date: 2026-08-04
---

# ADR-0008 — Cámara cinematográfica en el renderer (sin video crudo)

## Contexto

UC-0009 genera MP4 a partir de screenshots por paso. El look de productos tipo Screen Studio (cámara continua, foco al UI, marco) no requiere grabar video crudo ni cambiar el bridge de captura (UC-0002 / ADR-0004).

## Decisión

1. **Fase A (marco):** composición Remotion con fondo + ventana redondeada/sombra; imagen inset (no full-bleed).
2. **Fase B (cámara suave):** interpolar `scale` + pan centrado en `highlight` / fit completo si falta box; durante el crossfade post-audio, lerp de cámara actual → siguiente. Zoom sutil (~1.05–1.15× fit).
3. **Bumper de paso (configurable):** tarjeta «Paso N» + TTS opcional («Iniciaremos el paso {n}») + pausa (`VIDEO_STEP_BUMPER`, `VIDEO_STEP_BUMPER_SECONDS`); override por API/UI al generar.
4. Zoom **sutil** / sin ken-burns global.
5. **Fuera de alcance ahora (Fase C):** grabación de pantalla continua / FFmpeg screen capture — requeriría ADR aparte.

Los bounding boxes viven en `VideoProjectSource` / storyboard; no se reescriben capturas en `captures/`.

## Consecuencias

- Mejor percepción tutorial sin alterar Recorder.
- Escenas sin `highlight` → cámara overview (fit).
- Dependencia de calidad de `target.boundingBox` en la captura.
