# Toolsweb — ROADMAP

## Hecho (integrado en main)

1. Bridge Playwright — cola in-page, highlights, OAuth Google, coalescing input (UC-0002).
2. **ADR-0004** — pivot WebExtensions; Playwright como bridge.
3. Contratos duales `CaptureStep` + `TutorialAction` — **ADR-0005**.
4. PrivacyFilter + `docs/PRIVACY.md`.
5. Narración determinista en `avatarPrompt`.
6. Scaffold `apps/extension` + `apps/studio` — **ADR-0006**.
7. EventRecorder + popup extensión — **UC-0005 / UC-0006**.
8. Studio ActionSession — **UC-0007**.
9. Prompt producción video — **UC-0008**.
10. Prompt avatar TSV + import guión — **UC-0004**.
11. **Video local** Remotion + TTS + Clipchamp — **UC-0009 / ADR-0007 / ADR-0008**.
12. Purge sesión completa — **UC-0010**.
13. Sticky menu modules — **UC-0011**.
14. Script `scripts/dev.sh` + puertos paramétricos + CORS auto.
15. Documentación runtime con diagramas — `ARCHITECTURE.md`.

## Activo

1. Polish Remotion (cámara cinemática ADR-0008, tiempos, TTS cross-platform).
2. Pack Firefox + build unificado extensión.
3. Preview visual bounding boxes / cursor (Prompt Maestro §23 Fase 10).
4. Migrar autoría primaria Playwright → extensión.

## Migración WebExtensions (destino)

1. Fundaciones monorepo — *parcial*.
2. Núcleo semántico — *parcial*.
3. Privacidad — *hecho*.
4. EventRecorder Chromium — *hecho*.
5. Extensión Chromium MVP — *hecho*.
6. Firefox adapters / pack — *pendiente*.
7. SPA history + MutationObserver.
8. Tutorial engine — *parcial en shared*.
9. Studio React MVP — *hecho*.
10. Preview bbox / cursor — *pendiente*.

## Deprecación

- Playwright + Express recorder: **bridge** hasta cobertura extensión.
- Evaluar pnpm si el monorepo crece (ADR follow-up).

## Posterior

- Auth / sync / backend cloud.
- TTS no-macOS (ADR dedicado).
- Safari packaging.
