---
id: UC-0011
title: Agrupar pasos por módulo de menú (sticky) sin omitir capturas
status: approved
date: 2026-08-04
actors: [Author]
---

# UC-0011 — Módulo de menú sticky + bumper por cambio de sección

## Objetivo

Mantener **todos** los `CaptureStep`. Agruparlos bajo un `menuModule` (ítem de menú principal) para que el aviso/bumper del video hable al **cambiar de módulo**, no en cada acción.

## Flujo

1. En captura: si el click ocurre en nav/sidebar primario (no submenús `role=menu|listbox`), se marca `menuModuleTrigger` y el recorder actualiza el sticky de sesión.
2. Cada paso siguiente hereda `menuModule` hasta el próximo click de menú principal.
3. Offline (bitácoras legacy): `assignStickyMenuModules` infiere módulos cuando un `click` es seguido de `navigate` (label desde `target.text` / description).
4. Video (UC-0009): con `VIDEO_STEP_BUMPER_MODE=module` (default), el bumper suena/muestra solo si `menuModule` ≠ el de la escena anterior. El número del aviso es `menuModuleIndex` (1, 2, 3… por grupo), **no** `CaptureStep.stepNumber`. Visual: «Paso N» + nombre del módulo. TTS: `Paso {n}. {module}.`

## Contratos

- `CaptureStep.menuModule?: string`
- `VideoSourceStep.menuModule?: string`
- No se eliminan ni fusionan pasos/escenas.

## Fuera de alcance

OCR; modelos por sitio hardcodeados; fusionar capturas en una sola escena.
