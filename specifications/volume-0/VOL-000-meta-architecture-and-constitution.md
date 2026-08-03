# TOOLSWEB

# VOLUMEN 0

# META ARCHITECTURE & SPECIFICATION FRAMEWORK

**Identificador:** TW-VOL-000  
**Versión:** 0.1.0  
**Estado:** Approved  
**Clasificación:** Normative  
**Ámbito:** Todo el proyecto Toolsweb  
**Precedencia:** Superior a specs funcionales; subordinado a `TW-000` (misión/principios).  
**Fecha:** 2026-08-02

---

## 1. Propósito

Definir cómo se describen, relacionan, validan e implementan los artefactos de Toolsweb para que arquitectura, contratos, código y pruebas no evolucionen por separado.

Principios:

- Specification-Driven Development
- Contract-First (Zod en `@toolsweb/shared`)
- Architecture as Code / Documentation as Code
- Traceability by Design
- **AI-Assisted Development under Human Governance**
- Economía de contexto: los agentes leen constitución + `id` relevante, no el repo entero

El código no es la única fuente de verdad. La implementación deriva de specs aprobadas.

---

## 2. Jerarquía normativa

```text
TW-000 Project Constitution
        │
        ▼
TW-VOL-000 (este documento)
        │
        ▼
ADR-*
        │
        ▼
UC-* · TS-* · FS-*
        │
        ▼
Implementation (packages/*)
        │
        ▼
TEST-* / smoke scripts
```

`ARCHITECTURE.md` y `README.md` son **descriptivos**. No redefinen ADRs.

---

## 3. Prefijos de artefactos

| Prefijo | Uso |
|---------|-----|
| `TW` / `VOL` | Constitución / volúmenes |
| `ADR` | Architecture Decision Record |
| `UC` | Use Case |
| `TS` | Technical Specification / API |
| `FS` | Functional Specification |
| `TEST` | Prueba normativa o smoke |
| `ASSUMP` | Supuesto explícito |

IDs permanentes; no reutilizar números.

---

## 4. Flujo de cambio

1. Contrastar gap con specs existentes.
2. Aprobación humana explícita (Domain Owner).
3. Actualizar o crear artefacto (`status: draft` → `approved`).
4. Implementar en el workspace afectado.
5. Typecheck / smoke.
6. Actualizar `specifications/registry/registry.json` si hay artefacto nuevo.

---

## 5. Gobernanza de agentes (tokens)

- Reglas Cursor: `.cursor/rules/00-project-constitution.mdc` (always), `09-specification-gate.mdc` (always), `01-architecture.mdc` (globs).
- Prohibido: explorar en ancho sin `id` de tarea; inventar stacks; reescribir monorepo.
- Obligatorio: cambios quirúrgicos; citar `id` en PRs/commits de features.

---

## 6. Baseline de producto (resumen)

Herramienta para grabar navegación web (Playwright) y exportar tutoriales HTML5 / PDF.  
Monorepo npm: `shared` | `backend` | `frontend`. Detalle runtime: `ARCHITECTURE.md`.
