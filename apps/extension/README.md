# @toolsweb/extension

Extensión WebExtensions (ADR-0004 / UC-0005 / UC-0006).

## Estado

- EventRecorder en content script + SessionStore en background.
- Popup React: iniciar / pausar / reanudar / finalizar / exportar JSON.
- Build Chromium MV3 con Vite + `@crxjs/vite-plugin`.
- Firefox: manifesto stub; pack dedicado pendiente.

## Desarrollo

```bash
npm install
npm run build -w @toolsweb/shared
npm run dev -w @toolsweb/extension
```

Carga en Chrome: `chrome://extensions` → Modo desarrollador → **Cargar descomprimida** → `apps/extension/dist`.

```bash
npm run build -w @toolsweb/extension
```

## Mensajes

Ver `@toolsweb/shared` → `extensionMessages.ts` y UC-0005.

## Nota

`host_permissions: <all_urls>` es para desarrollo; producción debe restringir orígenes (Prompt Maestro §19).
