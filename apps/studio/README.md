# @toolsweb/studio

Studio MVP (UC-0007): importar / editar / exportar `ActionSession` JSON.

## Comandos

```bash
npm run build -w @toolsweb/shared
npm run dev -w @toolsweb/studio
```

Abre `http://STUDIO_HOST:STUDIO_PORT/` (default `http://127.0.0.1:5174`).  
Puertos en `.env` raíz: `STUDIO_HOST`, `STUDIO_PORT`.

## Funciones

- Importar JSON validado con `ActionSessionSchema`
- Listar pasos (tipo, contexto, localizador, posición, narración)
- Reordenar / eliminar / editar narración
- Regenerar narración determinista
- Exportar JSON
