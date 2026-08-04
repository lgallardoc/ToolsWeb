---
id: UC-0007
title: Studio — import, edit and export ActionSession
status: approved
date: 2026-08-03
updated: 2026-08-03
actors: [Author]
---

# UC-0007 — Studio (MVP)

## Objetivo

Aplicación React independiente para cargar un `ActionSession` JSON (export de la extensión), editar/reordenar/eliminar pasos, regenerar narración determinista y exportar el JSON corregido.

## Flujo

1. Autor abre Studio (`npm run dev -w @toolsweb/studio`).
2. Importa un archivo JSON (`ActionSession`).
3. Ve nombre, URL inicial, estado, fecha y lista de pasos.
4. Puede editar narración, subir/bajar, eliminar pasos.
5. Puede regenerar narración determinista para todos los pasos.
6. Exporta el JSON actualizado.

## Reglas

- Validar con `ActionSessionSchema` al importar.
- Valores `sensitive` no se muestran en claro (`[REDACTED]`).
- No editor de video (Prompt Maestro §15).
- Contratos desde `@toolsweb/shared` (ADR-0005).

## verifiedBy

- Typecheck `@toolsweb/studio`
- Import fixture inválido → error; válido → lista editable
