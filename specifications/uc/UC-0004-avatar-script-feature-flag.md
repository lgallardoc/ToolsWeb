---
id: UC-0004
title: Prompt de avatar desacoplado (sin APIs LLM embebidas)
status: approved
date: 2026-08-03
updated: 2026-08-03
actors: [Author]
---

# UC-0004 — Prompt de guión para cualquier AI

## Objetivo

Al detener una sesión con avatar/metadata activos:

1. Toolsweb **no** llama a OpenAI / Gemini / Anthropic.
2. Genera un **prompt** listo para pegar en cualquier chat AI, a partir de los pasos, metadatos semánticos, **línea de tiempo** y un **borrador determinista** en español (sin LLM).
3. El autor pega la respuesta de la AI en la UI; Toolsweb la guarda como `fullScript` (y opcionalmente `steps[].avatarScript` si viene JSON).

## Línea de tiempo

1. Cada gesto se sella con `capturedAt` (ISO-8601) **en el browser** al emitir el evento — no al terminar el screenshot en Node.
2. `CaptureStep.timestamp` = ese instante (fallback: reloj Node si falta).
3. El prompt incluye por paso: `timestamp`, `elapsedMs` (desde el 1.ᵉʳ paso del registro usado) y `gapMs` (delta vs. anterior), más `timeline.durationMs`.
4. Las instrucciones del prompt piden adaptar el ritmo narrativo a esos gaps.

## Narración determinista

1. `normalizeActions` (dedupe, agrupa inputs, colapsa click+navigate).
2. `generateNarrativeStep` / `generateDeterministicNarration` en español, 2.ª persona, sin jerga DOM.
3. El prompt embede el borrador bajo “BORRADOR DETERMINISTA” para que la AI lo refine.

## Flujo principal

1. Autor graba con “Avatar script + metadata” activo.
2. Stop → backend construye `session.avatarPrompt` (con timeline).
3. UI muestra el prompt + **Copiar**.
4. Autor lo ejecuta en ChatGPT / Gemini / Claude / etc.
5. Pega el guión resultante → `POST /api/sessions/:id/avatar-script`.
6. Sesión actualizada con `fullScript` (y SSML derivado o del JSON).

## Alternativos

- Flag off → sin metadata enriquecida ni prompt.
- Respuesta en texto plano → se guarda como locución completa.
- Respuesta JSON (schema avatar) → se mapea a pasos + fullScript.

## Contratos

- `TutorialSession.avatarPrompt?: string`
- `TutorialSession.fullScript?` / `CaptureStep.avatarScript?`
- `CaptureStep.timestamp` (ISO desde el gesto)
- `ImportAvatarScriptRequest`

## verifiedBy

- Stop sin red a providers LLM
- Typecheck sin deps `openai` / `@anthropic-ai/sdk` / `@google/generative-ai`
- Prompt JSON incluye `timestamp` / `elapsedMs` / `gapMs` por paso
