# @toolsweb/video-renderer

Generación local opcional de video tutorial (UC-0009 / ADR-0007).

## Comandos

Desde la raíz del monorepo (sesión real de bitácora):

```bash
npm run video:validate -- --session <uuid> --silent
npm run video:build -- --session <uuid> [--silent]
```

Fixture / JSON `VideoProjectSource`:

```bash
npm run video:validate -w @toolsweb/video-renderer -- --source ./fixtures/source.json --silent
```

Preview Remotion Studio:

```bash
cd packages/video-renderer
npx remotion preview src/remotion/entry.ts
```

## TTS

`VIDEO_TTS_PROVIDER=macos|silent|existing`  
`VIDEO_TTS_VOICE="Paulina (Enhanced)"` `VIDEO_TTS_RATE=160`  
(Alternativas: `Paulina`, `Jimena (Enhanced)`, `Soledad (Enhanced)` — ver `say -v '?'`.)

Sin FFmpeg en PATH se usa `ffmpeg-static`.

## Salida

`exports/video/<sessionId>/` (gitignored) + `clipchamp-package/`.
