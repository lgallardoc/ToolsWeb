---
id: ADR-0001
title: npm workspaces monorepo (shared / backend / frontend)
status: accepted
date: 2026-08-02
---

# ADR-0001 — Monorepo con npm workspaces

## Contexto

Toolsweb necesita tipos compartidos, un motor Playwright/Express y una UI de control.

## Decisión

Usar npm workspaces:

- `@toolsweb/shared` — contratos Zod
- `@toolsweb/backend` — API + services
- `@toolsweb/frontend` — editor/control UI

## Consecuencias

- Cambios de contrato obligan `npm run build:shared`.
- Evita duplicar `CaptureStep` / `TutorialSession` en UI y API.
- Acoplamiento de publicación: versionado privado (`*`) vía workspaces.
