---
id: ADR-0006
title: Scaffold apps/extension and apps/studio (WebExtensions pivot)
status: accepted
date: 2026-08-03
updated: 2026-08-03
---

# ADR-0006 — Scaffold de extensión y studio

## Contexto

ADR-0004 fija el destino WebExtensions + Studio. El monorepo actual usa `packages/*` (shared/backend/frontend) con Playwright bridge.

## Decisión

1. Añadir workspaces `apps/*` junto a `packages/*` (npm workspaces, sin migrar a pnpm todavía).
2. Crear stubs:
   - `apps/extension` — manifests Chromium/Firefox + content/background stubs + `webextension-polyfill`.
   - `apps/studio` — huso React/Vite futuro; por ahora README + typecheck vacío.
3. El núcleo de contratos permanece en `@toolsweb/shared` (ADR-0005); no duplicar `packages/contracts` hasta que haga falta separar.
4. El bridge Playwright (`packages/backend`) sigue siendo el runtime de grabación hasta que la extensión grabe de punta a punta.

## Consecuencias

- Estructura alineable al Prompt Maestro sin reescritura big-bang.
- Builds de extensión/studio se añaden por fases posteriores.
