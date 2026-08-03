---
id: TW-000
title: Toolsweb Project Constitution
version: 0.1.0
status: approved
date: 2026-08-02
---

# TW-000 — Project Constitution

## 1. Misión

Permitir capturar interacciones reales en el navegador y convertirlas en tutoriales reutilizables (HTML5 standalone y PDF), con contratos tipados y exportación reproducible.

## 2. Principios

1. **Contrato primero:** shapes compartidos viven en `@toolsweb/shared` (Zod + tipos inferidos).
2. **Separación de paquetes:** UI ≠ API ≠ tipos; sin imports cruzados ilegales (frontend ↛ Playwright).
3. **Captura fiel:** highlight + screenshot en el momento del evento; descripciones humanas por step.
4. **Export portable:** HTML autocontenido (CSS + imágenes embebidas); PDF derivado del mismo HTML.
5. **Gobernanza humana:** el agente propone; el humano aprueba alcance y ADRs.
6. **Economía de tokens:** constitución y specs antes que exploración masiva del código.

## 3. Stack canónico

| Capa | Tecnología |
|------|------------|
| Language | TypeScript strict, Node ≥ 20 |
| API | Express 4 |
| Automation | Playwright (Chromium) |
| Templates | Handlebars |
| Validation | Zod |
| UI | React 18 + Vite 5 + Tailwind 3 |

Fuera de tabla → ADR + aprobación.

## 4. Invariantes

- Máximo **una** sesión de recording activa por proceso API (ASSUMP-0001) hasta ADR de multi-sesión.
- Init script de captura = **JS plano** (ASSUMP-0002 / ADR-0002).
- No versionar capturas, secrets ni dumps.
- Validar requests de API con schemas Zod exportados desde shared.

## 5. Roles humanos

| Rol | Responsabilidad |
|-----|-----------------|
| Domain Owner | Prioridad de features y aceptación |
| Architecture Board | ADRs y límites de stack |
| Agent (Cursor) | Implementación quirúrgica bajo esta constitución |

## 6. Relación con otros artefactos

- Meta-marco: `TW-VOL-000`
- Runtime descriptivo: `ARCHITECTURE.md`
- Contribución: `CONTRIBUTING.md`
- Decisiones: `specifications/adr/`
