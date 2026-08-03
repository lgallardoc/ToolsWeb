# @toolsweb/extension

Scaffold de la extensión WebExtensions (ADR-0004 / ADR-0006).

## Estado

Stubs de **background**, **content** y **popup**. La grabación productiva sigue en el bridge Playwright (`packages/backend`) hasta completar EventRecorder + mensajería.

## Manifests

- `manifests/chromium.json` — MV3 Chromium/Edge
- `manifests/firefox.json` — MV3 Firefox (`browser_specific_settings.gecko`)

`host_permissions: <all_urls>` es solo para desarrollo; producción debe restringir orígenes (Prompt Maestro §19).

## Comandos

```bash
npm run typecheck -w @toolsweb/extension
```

Build/packaging Vite se añade en una fase posterior.
