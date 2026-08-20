---
id: UC-0010
title: Borrado completo de bitácora y artefactos de sesión
status: approved
date: 2026-08-04
actors: [Author]
---

# UC-0010 — Borrado completo de sesión

## Objetivo

Al eliminar una bitácora (`DELETE /api/sessions/:sessionId`), remover **todos** los artefactos locales de esa sesión para no dejar datos huérfanos ni filtrables.

## Alcance (borra si existe)

1. Bitácora: `packages/backend/data/sessions/<sessionId>.json[.enc]`
2. Capturas: `packages/backend/captures/<sessionId>/` (ya existente)
3. Video / Clipchamp: `exports/video/<sessionId>/` (MP4, WAV, storyboard, paquete)
4. Jobs de render: `exports/video/_jobs/*.json` con ese `sessionId`

HTML/PDF de export por HTTP no se persisten en disco; no hay carpeta que limpiar.

## Reglas

1. No borrar si la sesión está en grabación (409).
2. `sessionId` debe ser seguro para path (sin `..` / separadores).
3. Fallos de `rm` individuales no bloquean el resto; la operación es best-effort por artefacto.
4. Respuesta: `{ ok, deleted, removed: string[] }` con paths lógicos eliminados.

## Fuera de alcance

Perfiles de browser (`data/browser-profiles/`), cifrado keys, otras sesiones.
