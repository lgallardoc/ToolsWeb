---
id: ADR-0007
title: Optional local audiovisual renderer (Remotion + FFmpeg + TTS adapters)
status: accepted
date: 2026-08-04
updated: 2026-08-04
---

# ADR-0007 — Renderer audiovisual opcional fuera del core

## Contexto

UC-0009 requiere MP4, TTS local y paquete Clipchamp. Remotion/FFmpeg/TTS son deps pesadas e incompatibles con el core de captura (ADR-0003: sin SDKs de video/LLM en el núcleo).

ROADMAP ya anticipa Remotion/FFmpeg **fuera del core**.

## Decisión

1. Nuevo workspace npm `packages/video-renderer` → **`@toolsweb/video-renderer`** (cubierto por glob `packages/*` de ADR-0001).
2. Depende de `@toolsweb/shared` + Remotion (`remotion`, `@remotion/renderer`, `@remotion/bundler`, `@remotion/cli` según necesidad) + `ffmpeg-static` / `ffprobe-static` (o binarios de sistema si existen).
3. **No** depende de cifrado ni lee `captures/*.enc` directamente.
4. Entrada normalizada: `VideoProjectSource` (Zod en shared), construida por `VideoProjectSourceService` en **backend** (usa `SessionLogService` + sanitize).
5. TTS: interfaz `NarrationAudioProvider` solo en el renderer; providers iniciales locales (`macos` / `existing` / `silent`). Proveedores cloud = adaptadores futuros sin tocar shared core.
6. Jobs de render: cola local en disco bajo `exports/video/` (gitignored); sin Redis/DB.
7. Frontend: panel quirúrgico “Video tutorial” que llama API; no Studio.

## Alternativas rechazadas

| Opción | Motivo |
|--------|--------|
| Remotion dentro de `@toolsweb/backend` | Contamina API de captura con deps de UI/render |
| Llamar HeyGen/Synthesia APIs | Viola ADR-0003 |
| Leer PDF/OCR para frames | Fuera de alcance; capturas ya existen |
| Proyecto propietario Clipchamp | No estable / no documentado; paquete de assets + README |

## Consecuencias

- `npm install` del monorepo descarga Remotion/FFmpeg estáticos (peso mayor).
- Render opcional: si faltan Chromium Remotion / `say`, validate y unit tests siguen; render completo se documenta como limitación.
- Exports nunca versionados (`exports/video/` en `.gitignore`).
