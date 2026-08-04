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
│   ├── shared/      # Types + Zod + privacy + narración (@toolsweb/shared)
│   ├── backend/     # Express API + Playwright services (@toolsweb/backend)
│   └── frontend/    # React editor UI — bitácora / preview / guión (@toolsweb/frontend)
├── apps/
│   ├── extension/   # WebExtensions MV3 (Chromium) — destino de captura
│   └── studio/      # Studio React: editar ActionSession (puerto 5174)
├── specifications/  # Constitución, ADRs, UC, registry
├── docs/            # PRIVACY y material auxiliar
├── package.json     # npm workspaces root
└── tsconfig.base.json
```

## Quick start

```bash
cp .env.example .env
# Set TOOLSWEB_ENCRYPTION_KEY=$(openssl rand -hex 32)
npm install
npx playwright install chromium   # PDF + recorder (también postinstall del backend)
npm run build:shared
npm run dev:api                   # BACKEND_HOST:BACKEND_PORT
npm run dev:ui                    # FRONTEND_HOST:FRONTEND_PORT
```

Defaults: API `http://127.0.0.1:4410`, UI `http://127.0.0.1:5173/` (proxy `/api`).  
Puertos, host y cifrado: ver [.env.example](./.env.example).

Si PDF falla con “Executable doesn't exist”, reinstala Chromium **sin** `PLAYWRIGHT_BROWSERS_PATH` de sandbox:

```bash
env -u PLAYWRIGHT_BROWSERS_PATH npx playwright install chromium
```

Los scripts `dev`/`start` del backend ya hacen `env -u PLAYWRIGHT_BROWSERS_PATH`.

### Extensión / Studio (destino)

```bash
npm run build -w @toolsweb/extension   # cargar apps/extension/dist en Chrome
npm run dev -w @toolsweb/studio        # http://127.0.0.1:5174
```

## Uso rápido (UI bridge Playwright)

1. Elige URL, título opcional y browser (`chrome` recomendado para OAuth Google).
2. **Perfil persistente**: reutiliza cookies entre grabaciones.
3. **Iniciar sin sesión (nuevo usuario)**: browser efímero sin borrar el perfil guardado.
4. **Prompt de avatar + metadata**: al detener genera un prompt copiable (tabla TSV Synthesia).
5. **Start session** → interactúa en la ventana Playwright.
6. **Stop session** → bitácora cifrada.
7. Copia el prompt → ejecútalo en cualquier AI → pega el guión → **Guardar**.
8. Preview con subtítulos; exporta HTML/PDF (narración incluida).

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
| Highlights | Caja en el target + **icono de cursor** en el punto del click |
| Cola in-page | Gestos encolados en browser → drain Node (UC-0002) |
| Freeze de click | Navegación real; menús / scroll nativos cuando aplica |
| Pantallas vacías | PNG ≥90% uniforme → paso omitido (navigate) |
| Stop | Solo desde la UI Toolsweb |
| Privacidad | URLs/textos OAuth saneados; passwords no en claro — [PRIVACY.md](./docs/PRIVACY.md) |
| At-rest | Bitácora y capturas cifradas (`TOOLSWEB_ENCRYPTION_KEY`, AES-256-GCM) |

## API (resumen)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions/start` | Inicia grabación |
| `POST` | `/api/sessions/stop` | Detiene, guarda bitácora, adjunta `avatarPrompt` |
| `POST` | `/api/sessions/force-stop` | Cierra grabación huérfana |
| `GET` | `/api/sessions` | Bitácora + `activeSessionId` / `recording` |
| `GET` | `/api/sessions/:sessionId` | Snapshot (`?withImages=1`); refresca prompt Synthesia si es legacy |
| `POST` | `/api/sessions/:sessionId/avatar-script` | Guarda guión pegado → subtítulos + `videoPrompt` |
| `DELETE` | `/api/sessions/:sessionId` | Elimina bitácora + capturas |
| `POST` | `/api/export/html` / `.../pdf` | Export desde payload session |
| `POST` | `/api/export/html/:sessionId` / `.../pdf/:sessionId` | Export desde bitácora |
| `GET` | `/health` | Liveness |

Detalle: [ARCHITECTURE.md](./ARCHITECTURE.md).

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
| [ADR-0003](./specifications/adr/ADR-0003-llm-avatar-script-adapter.md) | Sin SDK LLM embebidos |
| [ADR-0004](./specifications/adr/ADR-0004-webextensions-pivot.md) | Pivot WebExtensions |

## Stack

- TypeScript (strict), Node.js ≥ 20, Express 4
- Playwright, Zod, Handlebars, `pngjs`
- React 18, Vite 5, Tailwind 3
- Extensión: Vite + `@crxjs/vite-plugin` (MV3)
