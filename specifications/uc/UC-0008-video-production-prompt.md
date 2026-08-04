---
id: UC-0008
title: Video production prompt (script + screens + timing)
status: approved
date: 2026-08-03
updated: 2026-08-03
actors: [Author]
---

# UC-0008 — Prompt de producción de video corto

## Objetivo

Tras tener un guión narrativo (`fullScript`), Toolsweb genera un **segundo prompt** (`videoPrompt`) que combina:

1. El guión hablado (texto fijo).
2. La secuencia de pantallas (pasos con descripción / metadata).
3. Tiempos sugeridos (`elapsedMs`, `gapMs`, `holdSec`, duración total).

El autor lo copia a una AI o herramienta tipo HeyGen / Synthesia / editor IA para producir un video corto sincronizado.

## Flujo

1. Autor graba y obtiene `avatarPrompt` → AI devuelve guión.
2. Autor pega guión → `fullScript` (UC-0004).
3. Backend/UI genera `videoPrompt` automáticamente.
4. Autor copia `videoPrompt` y lo ejecuta en la AI de video junto con las capturas (o describe pantallas del JSON).

## Reglas

- No embebemos providers de video (misma filosofía ADR-0003).
- `holdSec` por pantalla: `max(1.2, gapMs/1000)` acotado; la duración narrada se estima ~2.5 palabras/s.
- Preferir pasos interactivos; si no hay, usar todos.

## Contrato

- `TutorialSession.videoPrompt?: string`
