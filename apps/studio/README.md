# @toolsweb/studio

Studio MVP (UC-0007): importar / editar / exportar `ActionSession` JSON.

## Comandos

```bash
npm run build -w @toolsweb/shared
npm run dev -w @toolsweb/studio
```

Abre [http://127.0.0.1:5174](http://127.0.0.1:5174).

## Funciones

- Importar JSON validado con `ActionSessionSchema`
- Listar pasos (tipo, contexto, localizador, posición, narración)
- Reordenar / eliminar / editar narración
- Regenerar narración determinista
- Exportar JSON
