---
id: ADR-0003
title: Avatar scripts via exported prompt (no embedded LLM SDKs)
status: accepted
date: 2026-08-03
updated: 2026-08-03
---

# ADR-0003 — Prompt exportable en lugar de SDKs LLM

## Contexto

Integrar OpenAI/Gemini/Anthropic en el backend acopla keys, costos, fallos de red y providers. El autor ya usa chats AI externos.

## Decisión

1. `ENABLE_AVATAR_SCRIPT` controla metadata (UC-0003) + generación de **prompt** al stop.
2. No hay llamadas a APIs LLM desde Toolsweb.
3. El autor copia el prompt, lo corre donde quiera, y pega el guión vía `POST /api/sessions/:id/avatar-script`.
4. Se eliminan deps runtime `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`.

## Consecuencias

- Sin `LLM_API_KEY` / `GOOGLE_API_KEY` requeridas.
- Calidad del guión depende del modelo externo que elija el autor.
- Toolsweb solo orquesta captura → prompt → almacenamiento del guión.
