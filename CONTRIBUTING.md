# Contributing — Toolsweb

1. Leer Volume 0 y la Project Constitution (`specifications/`).
2. Trabajar contra una Specification / ADR aprobada (`id` permanente) cuando el cambio sea funcional.
3. No introducir dependencias fuera del stack sin ADR.
4. Preferir TypeScript estricto (`strict`); evitar `any`.
5. Contratos Zod en `@toolsweb/shared` son fuente de verdad de DTOs; no duplicar shapes a mano.
6. No versionar `packages/backend/captures/`, exports temporales, `.env` ni secretos.
7. Scripts inyectados en el browser (Playwright) deben ser **JS plano** (sin sintaxis TypeScript).

## Orden

Specification → Validation → Plan → Code → Tests → Traceability → Quality Gates → Human Review.

## Agents / tokens

Antes de explorar el repo en ancho: leer `.cursor/rules/00-project-constitution.mdc` y `ARCHITECTURE.md`.  
Cambios quirúrgicos: tocar solo el paquete afectado (`shared` | `backend` | `frontend`).

## Branches

- `main` — estable.
- Features / refactor: ramas cortas ancladas a un `id` (`TW-*`, `ADR-*`, `UC-*`).
