# Contributing — Toolsweb

1. Leer Volume 0 y la Project Constitution (`specifications/`).
2. Trabajar contra una Specification / ADR aprobada (`id` permanente) cuando el cambio sea funcional.
3. No introducir dependencias fuera del stack sin ADR.
4. Preferir TypeScript estricto (`strict`); evitar `any`.
5. Contratos Zod en `@toolsweb/shared` son fuente de verdad de DTOs; no duplicar shapes a mano.
6. No versionar `packages/backend/captures/`, `packages/backend/data/sessions/`, exports temporales, `.env` ni secretos.
7. Scripts inyectados en el browser (Playwright) deben ser **JS plano** (sin sintaxis TypeScript) — ADR-0002.
8. No embeber SDKs de LLM / video providers (ADR-0003); solo prompts copiables.
9. Features de producto: Specification Gate (`.cursor/rules/09-specification-gate.mdc`) antes de código no trivial.

## Orden

Specification → Validation → Plan → Code → Tests → Traceability → Quality Gates → Human Review.

## Agents / tokens

Antes de explorar el repo en ancho: leer `.cursor/rules/00-project-constitution.mdc` y `ARCHITECTURE.md`.  
Cambios quirúrgicos: tocar solo el paquete / app afectado (`shared` | `backend` | `frontend` | `extension` | `studio`).

## Branches

- `main` — estable / integración.
- Features: ramas cortas ancladas a un `id` (`TW-*`, `ADR-*`, `UC-*`).
- `version2` — línea de trabajo WebExtensions + bridge; fusionar a `main` cuando el hito esté listo.

## Checks locales habituales

```bash
npm run build -w @toolsweb/shared
npm run dev:stack              # API + UI (scripts/dev.sh)
npm run typecheck --workspace=@toolsweb/backend
npm run typecheck --workspace=@toolsweb/frontend
env -u PLAYWRIGHT_BROWSERS_PATH npx playwright install chromium   # si PDF falla
```
