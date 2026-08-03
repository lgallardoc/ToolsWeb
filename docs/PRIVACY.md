# Toolsweb — Privacy

Cómo Toolsweb trata datos personales y secretos al capturar y exportar tutoriales.

## Qué se captura

- URL (sin query/hash en la forma sanitizada).
- Tipo de acción (click, input, select, navigate, …).
- Metadatos semánticos del control (aria-label, placeholder, encabezado cercano, contexto de formulario).
- Texto / valor del control **solo** si no se clasifica como sensible.
- Screenshots de viewport (bridge Playwright). Pueden mostrar datos visibles en pantalla.

## Qué no debe guardarse en claro

| Categoría | Tratamiento |
|-----------|-------------|
| `type="password"` y campos de autenticación | Siempre `[REDACTED]` |
| Tokens OAuth / `client_secret` / API keys | Redactados en texto y query |
| Número de tarjeta / CVV | Redactados por patrón / contexto |
| RUT chileno | Redactado por patrón |
| Correo / teléfono | Redactados por defecto (configurable) |
| URLs de identity providers | Path/query sanitizados (`sanitizeTutorialUrl`) |

Implementación: `PrivacyFilter` en `@toolsweb/shared` (`privacy.ts`).

## Consentimiento

Toolsweb es una herramienta de autoría. Quien graba es responsable de:

1. Tener base legal / consentimiento para grabar la sesión.
2. No distribuir tutoriales con PII visible en capturas.
3. Revisar la bitácora antes de exportar HTML/PDF.

## Configuración

```ts
import { PrivacyFilter } from '@toolsweb/shared';

PrivacyFilter.filterFieldValue(value, hint, {
  redactEmail: true,   // default
  redactPhone: true,   // default
  keepLength: false,   // si true → [REDACTED:n]
  extraSensitiveMarkers: ['folio-interno'],
});
```

## Riesgos residuales

- Screenshots pueden revelar PII aunque el JSON esté redactado.
- Campos custom sin label semántica pueden no clasificarse (añadir `extraSensitiveMarkers`).
- El bridge Playwright usa CDP: el destino (ADR-0004) es content-script sin almacenamiento de sync con payloads grandes.

## Uso empresarial (recomendaciones)

1. Perfiles de grabación sin datos productivos reales cuando sea posible.
2. Cifrar bitácora en reposo (`TOOLSWEB_ENCRYPTION_KEY`).
3. No versionar `captures/`, `data/sessions/`, ni `.env`.
4. Restringir host permissions en la futura extensión a orígenes autorizados.

## Relacionado

- Prompt Maestro §8
- ADR-0003 (prompt avatar sin enviar secretos a LLM embebido)
- ADR-0004 / ADR-0005
- `sanitizeTutorialSession` en exports / API
