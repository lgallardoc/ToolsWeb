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
3. El prompt exige salida en **tabla TSV de producción Synthesia**: secciones + columnas `Paso / Tiempo / Duración / Acción visual en Synthesia / Narración` (1 fila por `stepNumber`), más notas “Precisión importante” cuando el registro no respalde una acción asumible.
4. El autor pega la respuesta de la AI en la UI; Toolsweb la guarda como `fullScript` (y opcionalmente `steps[].avatarScript` si viene JSON).

## Línea de tiempo

1. Cada gesto se sella con `capturedAt` (ISO-8601) **en el browser** al emitir el evento — no al terminar el screenshot en Node.
2. `CaptureStep.timestamp` = ese instante (fallback: reloj Node si falta).
3. El prompt incluye por paso: `timestamp`, `elapsedMs` (desde el 1.ᵉʳ paso del registro usado) y `gapMs` (delta vs. anterior), más `timeline.durationMs`.
4. Las instrucciones del prompt piden tabla TSV 1:1 con sugerencias `suggestedDurationSec` / `suggestedTimeRange` por paso.

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
7. Si el texto es plano (o JSON sin `steps[]`), se **reparten párrafos** a pasos interactivos como `steps[].avatarScript` para subtítulos en el preview (UC-0001).
8. Si el pegado es una **tabla de producción** (`Paso` + columnas + `Narración`, p. ej. Synthesia), se mapea la columna Narración a `steps[].avatarScript` por `stepNumber`; `fullScript` guarda la locución limpia concatenada; la tabla original se anexa al `videoPrompt`.
9. **Export HTML/PDF**: si hay `steps[].avatarScript.spokenText`, se renderiza como subtítulo sobre/bajo cada captura.
10. El pegado crudo se persiste en `productionScript` y al **Abrir** se restaura en el textarea (además de `fullScript` con la locución limpia).

## Alternativos

- Flag off → sin metadata enriquecida ni prompt.
- Respuesta en texto plano → `fullScript` + distribución párrafo→paso interactivo (orden).
- Tabla paso/narración → subtítulos 1:1 por número de paso.
- Respuesta JSON (schema avatar) con `steps[]` → se mapea a pasos; sin `steps[]` → misma distribución.
- Más párrafos que pasos → sobrantes se fusionan en el último paso interactivo.
- Más pasos que párrafos → solo los primeros N interactivos llevan subtítulo.

## Contratos

- `TutorialSession.avatarPrompt?: string`
- `TutorialSession.fullScript?` / `CaptureStep.avatarScript?`
- `CaptureStep.timestamp` (ISO desde el gesto)
- `ImportAvatarScriptRequest`

## verifiedBy

- Stop sin red a providers LLM
- Typecheck sin deps `openai` / `@anthropic-ai/sdk` / `@google/generative-ai`
- Prompt JSON incluye `timestamp` / `elapsedMs` / `gapMs` por paso
