---
persona: smb-owner
journey: 00-smoke
title: "Smoke — caminata del pipeline de manuales"
version: v2.5.4
locale: es-419
status: scaffolding
authored: 2026-05-27
---

# Smoke — caminata del pipeline

> Este "manual" no documenta una funcionalidad de Verbara — existe solo para
> validar que la cadena **test → screenshot → renderer → Markdown** funciona
> de extremo a extremo antes de empezar Fase 1 (el primer manual real:
> instalación SMB + WebChat).

## Paso 1 — Página de bienvenida

Lo primero que el test hace es abrir la URL configurada en
`MANUAL_BASE_URL` (en Fase 0 apunta a `example.com` por estabilidad) y
verificar que el título contiene la palabra "Example". Cuando el test pasa,
el renderer reemplaza el placeholder de aquí abajo con la captura tomada
en ese momento.

{{step:welcome}}

Si esta imagen aparece bien renderizada en un visor de Markdown
(VSCode preview, GitHub web, etc.), significa que:

- Playwright capturó la imagen
- El renderer leyó la salida de Allure
- El template engine sustituyó `{{step:welcome}}` por la ruta correcta
- El Markdown resultante es legible

## Paso 2 — Contenido principal

El segundo paso valida que la página tiene un encabezado `<h1>` visible y
captura otra imagen. Este paso no agrega valor pedagógico — solo confirma
que el pipeline funciona con **dos** capturas (no solo una), que es donde
suelen aparecer los bugs de race condition o template engine.

{{step:content}}

## ¿Qué viene después?

Cuando este smoke pase y la salida `.md` se vea bien, arrancamos
[Fase 1 — SMB Owner Día 1](../../docs/plans/active/2026-05-27-living-docs-from-e2e-tests.md):
instalar Verbara con `docker compose`, completar el setup wizard,
configurar el canal WebChat y recibir el primer mensaje.
