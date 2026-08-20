---
id: UC-0009
title: Generación local de video tutorial (sessionId → MP4 + Clipchamp)
status: approved
date: 2026-08-04
updated: 2026-08-04
actors: [Author]
---

# UC-0009 — Generación local de video tutorial

## Objetivo

A partir de un `sessionId` de bitácora Toolsweb, generar de forma **opcional y local**:

1. Video tutorial MP4 (1920×1080, H.264 + AAC).
2. Una **escena por cada** `CaptureStep` persistido (sin agrupar ni omitir).
3. Narración sincronizada por paso (TTS local opcional; macOS `say` con pausas/`[[slnc]]`, rate por defecto ~160 y fades WAV). Opcional: bumper visual+TTS al **cambiar de menú** (`menuModule`, UC-0011; `VIDEO_STEP_BUMPER_MODE=module|step`) — los pasos no se eliminan. La siguiente escena no arranca hasta terminar bumper + audio + pad; el crossfade es solo visual.
4. Subtítulos externos `tutorial.srt` / `tutorial.vtt`.
5. Storyboard JSON + CSV.
6. Paquete importable **manualmente** en Microsoft Clipchamp (assets + README; sin formato propietario).
7. Imágenes y audios por escena bajo `exports/video/<sessionId>/` (gitignored).
8. `validation-report.json`.

Entrada principal: **`sessionId`**. No se requiere PDF. No OCR. No re-captura.

## Fuente de media

1. `SessionLogService.get(sessionId, { withImages: true })` (descifrado AES-256-GCM existente).
2. Equivalente a `GET /api/sessions/:sessionId?withImages=1`.
3. `imageBase64` / hidratación interna — **no** leer `.png.enc` saltando el servicio.
4. No modificar `packages/backend/captures/` ni `data/sessions/`.

## Narración (orden de resolución)

1. `step.avatarScript.spokenText` no vacío.
2. Narración del paso en `productionScript` (tabla TSV Parseable).
3. `distributeSpokenToSteps` sobre `fullScript` / production.
4. Borrador determinista (`narrationFromCaptureSession` / líneas del `avatarPrompt`).
5. Fallback semántico breve (`description` / `closestHeader` / `target.text`).
6. Si vacío → escena **visual silenciosa** (warning, no error).

No LLM. No reemplazar narraciones ya guardadas por el usuario cuando (1) existe.

## Duración de escena

`durationSeconds = max(mínimo_por_acción, audioDuration+padding, gapCap)`.

Mínimos sugeridos: navigate 3.0 · click 2.5 · select 3.0 · input 3.0 · silenciosa 2.0.

`gapMs`: &lt;800 → transición 0.1–0.2s; 800–3000 → 0.25–0.4s; &gt;3000 → hasta `VIDEO_MAX_GAP_SECONDS` (default 1). Nunca cortar narración.

## Audio (adaptador)

Interfaz `NarrationAudioProvider` solo en `@toolsweb/video-renderer`:

- `MacOsSayNarrationProvider` (`say` → WAV 48 kHz vía FFmpeg).
- `ExistingAudioNarrationProvider`.
- `SilentNarrationProvider`.

Sin SDK de ElevenLabs / OpenAI / HeyGen / Synthesia / Clipchamp API (ADR-0003 + ADR-0007).

## Render

Composición Remotion `ToolswebTutorialVideo` en el workspace opcional `@toolsweb/video-renderer` (ADR-0007 + ADR-0008). Marco/ventana inset + cámara suave (pan/zoom sutil al `highlight`) interpolada en el crossfade post-audio; sin ken-burns global. Render MP4 + regeneración por `sceneNumber`. Preview en UI: `GET /api/sessions/:sessionId/video-preview` sirve `exports/video/<sessionId>/05-video/tutorial-final.mp4` (404 si aún no existe).

## Clipchamp

Paquete carpeta `exports/video/<sessionId>/clipchamp-package/` con imágenes, audios, subtítulos, storyboard, MP4, metadata y `README-CLIPCHAMP.md`. No archivo de proyecto propietario.

## Privacidad

Respeta `docs/PRIVACY.md`. Exports locales. Advertencia: el video puede mostrar lo visible en capturas originales.

## Errores fatales vs warnings

**Fail:** sesión inexistente/vacía, `stepNumber` duplicados, captura requerida faltante, MP4 no generado, resolución ≠ 1920×1080, duración 0, audio ausente cuando TTS ≠ silent.

**Warn:** sin narración, sin bounding box, acción desconocida.

## Fuera de alcance

PDF/OCR; APIs cloud de video/TTS; Clipchamp propietario; Redis/DB de jobs; cambiar cifrado/captura/WebExtensions; Studio salvo justificación.

## Contratos (shared)

`VideoProjectSource`, `VideoStoryboard`, `VideoRenderJob`, `VideoValidationReport` (+ errores tipados).

## verifiedBy

- Specs + ADR-0007 en registry.
- Unit tests (fixtures) de source/duration/SRT/VTT/CSV/validate.
- Typecheck shared/backend/frontend/video-renderer.
- `video:validate` sobre fixture.
- Render fixture cuando FFmpeg/Chromium/`say` disponibles; si no, documentar limitación.
