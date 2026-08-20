# Toolsweb

Captura acciones de navegación web (clicks, inputs, screenshots) y las compila en tutoriales HTML5 standalone, exports PDF, guiones de avatar y planes de video (Synthesia / HeyGen) — sin APIs LLM embebidas.

## Gobernanza (leer antes de codificar)

| Doc | Rol |
|-----|-----|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Cómo contribuir / orden de trabajo |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Runtime descriptivo |
| [ROADMAP.md](./ROADMAP.md) | Estado activo y destino WebExtensions |
| [docs/PRIVACY.md](./docs/PRIVACY.md) | Política de privacidad / redaction |
| [specifications/constitution/TW-000-project-constitution.md](./specifications/constitution/TW-000-project-constitution.md) | Constitución |
| [specifications/volume-0/VOL-000-meta-architecture-and-constitution.md](./specifications/volume-0/VOL-000-meta-architecture-and-constitution.md) | Meta-marco |
| [specifications/registry/registry.json](./specifications/registry/registry.json) | Índice de UC / ADR |
| `.cursor/rules/` | Reglas always-on para agentes (economía de tokens) |

## Monorepo layout

```
Toolsweb/
├── packages/
│   ├── shared/          # Types + Zod + privacy + narración (@toolsweb/shared)
│   ├── backend/         # Express API + Playwright services (@toolsweb/backend)
│   ├── frontend/        # React editor UI — bitácora / preview / guión (@toolsweb/frontend)
│   └── video-renderer/  # MP4 Remotion + TTS local (ADR-0007 / UC-0009)
├── apps/
│   ├── extension/       # WebExtensions MV3 (Chromium) — destino de captura
│   └── studio/          # Studio React: editar ActionSession
├── scripts/
│   └── dev.sh           # Levantar / reiniciar API + UI
├── specifications/      # Constitución, ADRs, UC, registry
├── docs/                # PRIVACY y material auxiliar
├── package.json         # npm workspaces root
└── tsconfig.base.json
```

## Quick start

```bash
cp .env.example .env
# TOOLSWEB_ENCRYPTION_KEY=$(openssl rand -hex 32)  → pegar en .env
npm install
npx playwright install chromium   # PDF + recorder (también postinstall del backend)
npm run build:shared
npm run dev:stack               # API + UI (reinicia si ya estaban activos)
```

Alternativa manual (dos terminales):

```bash
npm run dev:api    # BACKEND_HOST:BACKEND_PORT
npm run dev:ui     # FRONTEND_HOST:FRONTEND_PORT
```

### Script de desarrollo (`scripts/dev.sh`)

| Comando | Acción |
|---------|--------|
| `npm run dev:stack` | Levanta API + UI; **reinicia** si los puertos ya están en uso |
| `npm run dev:stack:stop` | Detiene ambos servicios |
| `npm run dev:stack:restart` | stop + start |
| `npm run dev:stack:status` | Muestra si API/UI están activos |

Logs en `.toolsweb/logs/{api,ui}.log` (gitignored).

### Puertos (paramétricos vía `.env`)

| Variable | Default | Servicio |
|----------|---------|----------|
| `BACKEND_HOST` / `BACKEND_PORT` | `127.0.0.1` / `4410` | Express API |
| `FRONTEND_HOST` / `FRONTEND_PORT` | `127.0.0.1` / `5173` | UI Vite (proxy `/api`) |
| `STUDIO_HOST` / `STUDIO_PORT` | `127.0.0.1` / `5174` | Studio Vite |
| `VITE_BACKEND_URL` | derivado de backend | Override del proxy frontend |

CORS del backend se deriva de `FRONTEND_HOST:FRONTEND_PORT` salvo `CORS_ORIGIN` explícito.

Si PDF falla con “Executable doesn't exist”, reinstala Chromium **sin** `PLAYWRIGHT_BROWSERS_PATH` de sandbox:

```bash
env -u PLAYWRIGHT_BROWSERS_PATH npx playwright install chromium
```

Los scripts `dev`/`start` del backend ya hacen `env -u PLAYWRIGHT_BROWSERS_PATH`.

### Extensión / Studio (destino)

```bash
npm run build -w @toolsweb/extension
npm run dev -w @toolsweb/studio        # STUDIO_HOST:STUDIO_PORT
```

## Uso rápido (UI bridge Playwright)

1. Elige URL, título opcional y browser (**Google Chrome** recomendado para login con Google).
2. **Perfil persistente**: reutiliza cookies entre grabaciones (sesiones OAuth).
3. **Iniciar sin sesión (nuevo usuario)**: browser efímero sin borrar el perfil guardado.
4. **Prompt de avatar + metadata**: al detener genera un prompt copiable (tabla TSV Synthesia).
5. **Start session** → interactúa en la ventana Playwright.
6. **Stop session** → bitácora cifrada.
7. Copia el prompt → ejecútalo en cualquier AI → pega el guión → **Guardar**.
8. Preview con subtítulos; exporta HTML/PDF (narración incluida).

### Login con Google (OAuth)

- Usa **Chrome instalado** (`browser: chrome`) y perfil persistente.
- Al redirigir a `accounts.google.com` (u otro host OAuth), el recorder **captura la pantalla de inicio de sesión** como paso `navigate`.
- Las pantallas OAuth **no** se descartan aunque el PNG parezca en blanco (loaders).
- El settle en hosts OAuth es más largo (`CAPTURE_AUTH_NAVIGATE_TIMEOUT_MS`, default 8 s).
- URLs y textos sensibles se redactan en metadatos — las **imágenes** del paso se conservan. Ver [PRIVACY.md](./docs/PRIVACY.md).

## Flujo de guión / video (sin LLM embebido)

| Paso | Artefacto | Spec |
|------|-----------|------|
| Stop | `avatarPrompt` (pide tabla Paso/Tiempo/Duración/Acción visual/Narración) | UC-0004 |
| Pegar respuesta AI | `productionScript` (crudo) + `fullScript` (locución) + `steps[].avatarScript` | UC-0004 |
| Preview | Subtítulos por escena | UC-0001 / UC-0004 |
| Export HTML/PDF | Subtítulo sobre cada captura | UC-0004 |
| Prompt de video | `videoPrompt` (guión + pantallas + tiempos) | UC-0008 |

## Capacidades de captura (bridge)

| Capacidad | Comportamiento |
|-----------|----------------|
| Densidad | **Por gesto**, no FPS de video: click, focus, input final, select, navigate |
| Cola in-page | Gestos encolados en browser → drain Node ~80 ms (~12 Hz, UC-0002) |
| Input / textarea | **2 capturas por campo**: focus (inicio) + valor final al salir (sin paso por tecla) |
| Highlights | Caja en el target + **icono de cursor** en el punto del click |
| Freeze de click | Navegación real; menús / scroll nativos cuando aplica |
| Pantallas vacías | PNG ≥90% uniforme → paso omitido solo en `navigate` (excepto OAuth) |
| OAuth / Google | Navigate a host de login siempre capturado + settle extendido |
| Stop | Solo desde la UI Toolsweb |
| Privacidad | URLs/textos OAuth saneados; passwords no en claro — [PRIVACY.md](./docs/PRIVACY.md) |
| At-rest | Bitácora y capturas cifradas (`TOOLSWEB_ENCRYPTION_KEY`, AES-256-GCM) |

Tuneo opcional en `.env`: `CAPTURE_QUEUE_DRAIN_MS`, `CAPTURE_HIGHLIGHT_HOLD_MS`, `CAPTURE_AUTH_NAVIGATE_TIMEOUT_MS`.

## API (resumen)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions/start` | Inicia grabación |
| `POST` | `/api/sessions/stop` | Detiene, guarda bitácora, adjunta `avatarPrompt` |
| `POST` | `/api/sessions/force-stop` | Cierra grabación huérfana |
| `GET` | `/api/sessions` | Bitácora + `activeSessionId` / `recording` |
| `GET` | `/api/sessions/:sessionId` | Snapshot (`?withImages=1`); refresca prompt Synthesia si es legacy |
| `POST` | `/api/sessions/:sessionId/avatar-script` | Guarda guión pegado → subtítulos + `videoPrompt` |
| `DELETE` | `/api/sessions/:sessionId` | UC-0010: bitácora + capturas + `exports/video/<id>` + jobs video |
| `POST` | `/api/export/html` / `.../pdf` | Export desde payload session |
| `POST` | `/api/export/html/:sessionId` / `.../pdf/:sessionId` | Export desde bitácora |
| `GET` | `/health` | Liveness |

Detalle: [ARCHITECTURE.md](./ARCHITECTURE.md) (diagramas de sistema, grabación, OAuth, input, video y dev stack).

## Diagramas de flujo

| Diagrama | Ubicación |
|----------|-----------|
| Vista general del sistema | [ARCHITECTURE.md § Vista general](./ARCHITECTURE.md#vista-general-del-sistema) |
| Proceso de grabación bridge | [ARCHITECTURE.md § Proceso de grabación](./ARCHITECTURE.md#proceso-de-grabación-bridge) |
| OAuth / Google login | [ARCHITECTURE.md § OAuth](./ARCHITECTURE.md#oauth--google-login) |
| Coalescing input (2 capturas/campo) | [ARCHITECTURE.md § Coalescing](./ARCHITECTURE.md#coalescing-de-campos-de-texto) |
| Guión → export → video MP4 | [ARCHITECTURE.md § Flujo guión](./ARCHITECTURE.md#flujo-guión--export--video) |
| Pipeline Remotion (UC-0009) | [ARCHITECTURE.md § Pipeline video](./ARCHITECTURE.md#pipeline-video-local-uc-0009) |
| Dev stack (`dev.sh`) | [ARCHITECTURE.md § Dev stack](./ARCHITECTURE.md#dev-stack) |

## Specs de producto relevantes

| Id | Tema |
|----|------|
| [UC-0001](./specifications/uc/UC-0001-step-preview.md) | Preview presentación + subtítulos |
| [UC-0002](./specifications/uc/UC-0002-capture-quality-and-in-browser-stop.md) | Calidad captura / cola / stop |
| [UC-0003](./specifications/uc/UC-0003-element-metadata-capture.md) | Metadata semántica |
| [UC-0004](./specifications/uc/UC-0004-avatar-script-feature-flag.md) | Prompt avatar TSV + import guión |
| [UC-0005](./specifications/uc/UC-0005-extension-event-recorder.md) | EventRecorder extensión |
| [UC-0006](./specifications/uc/UC-0006-extension-popup.md) | Popup extensión |
| [UC-0007](./specifications/uc/UC-0007-studio-action-session.md) | Studio ActionSession |
| [UC-0008](./specifications/uc/UC-0008-video-production-prompt.md) | Prompt producción de video |
| [UC-0009](./specifications/uc/UC-0009-local-video-tutorial-generation.md) | Video MP4 local |
| [UC-0010](./specifications/uc/UC-0010-session-full-purge.md) | Purge sesión completa |
| [UC-0011](./specifications/uc/UC-0011-menu-module-sticky-grouping.md) | Sticky menu modules |
| [ADR-0003](./specifications/adr/ADR-0003-llm-avatar-script-adapter.md) | Sin SDK LLM embebidos |
| [ADR-0004](./specifications/adr/ADR-0004-webextensions-pivot.md) | Pivot WebExtensions |
| [ADR-0007](./specifications/adr/ADR-0007-optional-local-video-renderer.md) | Renderer local opcional |
| [ADR-0008](./specifications/adr/ADR-0008-cinematic-camera-video-renderer.md) | Cámara cinemática Remotion |

## Video local (UC-0009)

```bash
npm run video:validate -- --session <uuid> --silent
npm run video:build -- --session <uuid> [--silent]
```

Paquete `@toolsweb/video-renderer` (ADR-0007): MP4 Remotion + TTS `say`/silent + Clipchamp folder package bajo `exports/video/` (gitignored). Panel **Video tutorial** en la UI.
