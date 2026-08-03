# Toolsweb

Captura acciones de navegación web (clicks, inputs, screenshots) y las compila en tutoriales HTML5 standalone y exports PDF.

## Gobernanza (leer antes de codificar)

| Doc | Rol |
|-----|-----|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Cómo contribuir / orden de trabajo |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Runtime descriptivo |
| [specifications/constitution/TW-000-project-constitution.md](./specifications/constitution/TW-000-project-constitution.md) | Constitución |
| [specifications/volume-0/VOL-000-meta-architecture-and-constitution.md](./specifications/volume-0/VOL-000-meta-architecture-and-constitution.md) | Meta-marco |
| [specifications/registry/registry.json](./specifications/registry/registry.json) | Índice de UC / ADR |
| `.cursor/rules/` | Reglas always-on para agentes (economía de tokens) |

## Monorepo layout

```
Toolsweb/
├── packages/
│   ├── shared/      # Types + Zod schemas (@toolsweb/shared)
│   ├── backend/     # Express API + Playwright services (@toolsweb/backend)
│   └── frontend/    # React editor UI (@toolsweb/frontend)
├── specifications/  # Constitución, ADRs, UC/TS, registry
├── package.json     # npm workspaces root
└── tsconfig.base.json
```

## Quick start

```bash
cp .env.example .env
# Set TOOLSWEB_ENCRYPTION_KEY=$(openssl rand -hex 32)
npm install
npx playwright install chromium firefox webkit   # once
npm run build:shared
npm run dev:api                   # BACKEND_HOST:BACKEND_PORT
npm run dev:ui                    # FRONTEND_HOST:FRONTEND_PORT
```

Defaults: API `http://127.0.0.1:4410`, UI `http://127.0.0.1:5173/` (proxy `/api`).  
Puertos, host y cifrado: ver [.env.example](./.env.example).

## Uso rápido (UI)

1. Elige URL, título opcional y browser (`chrome` recomendado para OAuth Google).
2. **Perfil persistente**: reutiliza cookies entre grabaciones.
3. **Iniciar sin sesión (nuevo usuario)**: abre browser efímero (pide login / otra cuenta) sin borrar el perfil guardado.
4. **Start session** → interactúa en la ventana Playwright.
5. Usa **Stop session** en la UI Toolsweb para cerrar la grabación y guardarla en bitácora.
6. Revisa el preview paso a paso, exporta HTML/PDF desde la sesión o la bitácora.

## Capacidades de captura

| Capacidad | Comportamiento |
|-----------|----------------|
| Highlights | Caja en el target + **icono de cursor** en el punto del click |
| Freeze de click | Solo en navegación real (links/submit); menús y scroll siguen el gesto nativo |
| Estabilización | Espera carga / red (best-effort) / animaciones quietas antes del screenshot |
| Pantallas vacías | Si el PNG es ≥90% uniforme, el paso **no se guarda** |
| Stop | Solo desde la UI Toolsweb (`Stop session`) |
| Privacidad | URLs/textos OAuth saneados en display/export; passwords no en claro |
| At-rest | Bitácora y capturas cifradas con `TOOLSWEB_ENCRYPTION_KEY` (AES-256-GCM) |

## API (resumen)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions/start` | Inicia grabación (`url`, `browser`, `persistentProfile`, `freshLogin`, …) |
| `POST` | `/api/sessions/stop` | Detiene, guarda bitácora, devuelve `TutorialSession` |
| `POST` | `/api/sessions/force-stop` | Cierra grabación huérfana y guarda |
| `GET` | `/api/sessions` | Bitácora + `activeSessionId` / `recording` |
| `GET` | `/api/sessions/:sessionId` | Snapshot live o bitácora (`?withImages=1`) |
| `DELETE` | `/api/sessions/:sessionId` | Elimina bitácora + capturas |
| `POST` | `/api/export/html` | Export HTML (payload session) |
| `POST` | `/api/export/pdf` | Export PDF |
| `POST` | `/api/export/html/:sessionId` | HTML desde bitácora |
| `POST` | `/api/export/pdf/:sessionId` | PDF desde bitácora |
| `GET` | `/health` | Liveness |

Detalle: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Specs de producto relevantes

| Id | Tema |
|----|------|
| [UC-0001](./specifications/uc/UC-0001-step-preview.md) | Preview paginado estilo presentación |
| [UC-0002](./specifications/uc/UC-0002-capture-quality-and-in-browser-stop.md) | Calidad de captura (sync screenshot) |

## Stack

- TypeScript (strict), Node.js ≥ 20, Express 4
- Playwright, Zod, Handlebars, `pngjs` (detección de frames vacíos)
- React 18, Vite 5, Tailwind 3
