# Toolsweb — modelo de eventos

Contrato canónico: `TutorialAction` / `ActionSession` en `@toolsweb/shared` (`types/action.ts`).

Ver Prompt Maestro §4–5 y ADR-0005 (dual con `CaptureStep` del bridge Playwright).

## Tipos de acción

`click` · `doubleClick` · `input` · `change` · `select` · `submit` · `navigation` · `scroll` · `keyboard` · `interfaceChange`

## Pipeline

```
acciones crudas → dedupe → groupFieldEdits → collapseClickNavigation → narración
```

APIs: `normalizeActions`, `generateDeterministicNarration`, `PrivacyFilter`.
