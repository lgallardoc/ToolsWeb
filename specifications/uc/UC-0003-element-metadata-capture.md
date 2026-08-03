---
id: UC-0003
title: Captura de metadata enriquecida de elementos
status: approved
date: 2026-08-03
actors: [Author]
---

# UC-0003 — Metadata de elementos en pasos de captura

## Objetivo

Enriquecer cada `CaptureStep` de interacción (`click`, `input`, `select`) con contexto semántico del target DOM para tutoriales y export más legibles.

## Flujo principal

1. Autor inicia una sesión de grabación.
2. Interactúa (click, escritura, cambio de `<select>`).
3. El init script (JS plano) llama a la lógica de `MetadataExtractor.extractElementMetadata` sobre el target.
4. El bridge envía la metadata junto al payload de captura.
5. `RecorderService` persiste en el JSON del paso: `ariaLabel`, `closestHeader`, `formContext`, `placeholder` (opcionales).

## Campos

| Campo | Origen típico |
|-------|----------------|
| `ariaLabel` | `aria-label` del target |
| `placeholder` | `placeholder` en input/textarea |
| `closestHeader` | Encabezado (`h1`–`h6`) más cercano en el ancestro/hermanos |
| `formContext` | `form` / `fieldset` más cercano (legend, aria-label, name, id) |

## Contratos / APIs relacionados

- `@toolsweb/shared` — `CaptureStepSchema`, `CaptureActionSchema` (`select` añadido)
- `MetadataExtractor` — `packages/backend/src/services/MetadataExtractor.ts`
- ADR-0002 — extracción inyectada permanece como JS plano

## verifiedBy

- Typecheck `shared` + `backend` tras extender Zod
- Smoke: pasos click/input/select incluyen metadata cuando el DOM la expone
