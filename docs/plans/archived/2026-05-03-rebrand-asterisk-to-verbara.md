# Plan: Rebrand técnico Asterisk → Verbara (cross-repo)

**Created:** 2026-05-03
**Status:** Active (planning, not yet executed — Phase 1 ready)
**Scope:** 4 repos del ecosistema (`Asterisk.Sdk`, `Asterisk.Sdk.Pro`, `Asterisk.Platform`, `Asterisk.Platform.Web`)
**Trigger:** [ADR-0006](../../decisions/0006-license-and-commercial-tier-strategy.md) — rebrand a Verbara para evitar trademark conflict con Sangoma/Digium ("Asterisk").

## Context

La marca "Asterisk" es trademark registrado de Sangoma Technologies / Digium. ADR-0006 decidió rebrandear el producto a **Verbara** (verbara.io). Esta es una **migración técnica** que toca:

- Nombres de repositorios en GitHub
- Package names en `package.json` (Web) y `.csproj` / paquetes NuGet (.NET repos)
- Namespaces .NET (`namespace Asterisk.Platform.X` → `namespace Verbara.Platform.X`)
- Imports / using statements en código
- Docker image names + docker-compose service names
- Documentación (READMEs, CLAUDE.md, ADRs históricos, plans)
- URLs en código y comentarios
- CI/CD workflows (cuando existan)

Es un trabajo coordinado de ~2-4 semanas calendario. Se ejecuta **DESPUÉS de Track 1A** del v1.14.x roadmap (LICENSE/CONTRIBUTING/README ya shipped en cada repo).

## Pre-requisitos antes de empezar

- [x] ADR-0006 Accepted en Web repo
- [x] LICENSE/NOTICE/CONTRIBUTING/README updated en Web repo
- [ ] Lo mismo en `Asterisk.Sdk` repo
- [ ] Lo mismo en `Asterisk.Sdk.Pro` repo
- [ ] Lo mismo en `Asterisk.Platform` repo
- [ ] User-side: dominio `verbara.io` confirmado funcionando ✅ (done por el usuario)
- [ ] User-side: GitHub org `github.com/verbara` creada
- [ ] User-side: email aliases de verbara.io probados y funcionando

## Fases

### Fase 1 — Branding superficial (1-2 días)

**Objetivo:** Toda la documentación pública dice "Verbara" sin tocar código todavía.

**Repos afectados:** los 4.

**Tareas por repo:**

1. Crear/actualizar `LICENSE` con copyright `Copyright 2026-present Harol A. Reina H. and Verbara Contributors` (Apache 2.0 para Platform/Web; mantener MIT en Sdk; mantener Commercial en Sdk.Pro)
2. Crear `NOTICE` con cross-repo matrix bajo branding Verbara
3. Crear/actualizar `CONTRIBUTING.md` con DCO requirement + `verbara.io` emails
4. Actualizar `README.md` — título `# Verbara X`, descripción con Verbara branding, sección License con matriz cross-repo, nota transitional sobre repo names
5. Actualizar `CLAUDE.md` (si existe) con nuevas referencias
6. ADR equivalente al 0006 en cada repo

**Criterio de éxito:** README de cada repo dice "Verbara" en título y body; LICENSE/NOTICE shipped; CI sigue verde (sin tocar código).

**Estado actual (Web):** ✅ COMPLETADO 2026-05-03.

### Fase 2 — Crear GitHub org Verbara + transferir repos (1 día)

**Objetivo:** Mover los 4 repos a `github.com/verbara` con redirects activos.

**Tareas:**

1. Crear `github.com/verbara` org (action del user, ya documentada)
2. Para cada repo, en **Settings → Transfer**: transferir de `Harol-Reina/<oldname>` a `verbara/<oldname>`
3. GitHub mantiene redirect 301 automáticamente del URL viejo → nuevo (cuántas semanas/meses depende del repo activity)
4. Actualizar todos los `git remote set-url origin` locales

**Criterio de éxito:** `git pull` desde URL viejo redirige; los 4 repos visibles en `github.com/verbara`.

**Riesgo:** Si los repos tenían stars / forks / GitHub Pages activos, el redirect protege links externos pero algunos integrations (GitHub Apps, secret scanning) requieren reconfigurar.

### Fase 3 — Rename de repos individuales (1 día)

**Objetivo:** Renombrar cada repo en GitHub al nombre final (`verbara-X`).

| Repo actual                     | Nombre nuevo               |
| ------------------------------- | -------------------------- |
| `verbara/Asterisk.Sdk`          | `verbara/verbara-sdk`      |
| `verbara/Asterisk.Sdk.Pro`      | `verbara/verbara-sdk-pro`  |
| `verbara/Asterisk.Platform`     | `verbara/verbara-platform` |
| `verbara/Asterisk.Platform.Web` | `verbara/verbara-web`      |

**Tareas:**

1. Settings → Rename (uno por uno)
2. GitHub redirect 301 mantiene los URLs viejos funcionando
3. Actualizar `git remote set-url origin git@github.com:verbara/verbara-X.git` localmente

**Criterio de éxito:** URLs nuevos funcionan; viejos redirigen.

### Fase 4 — Rename de namespaces / packages (.NET repos: Sdk, Sdk.Pro, Platform) (1-2 semanas)

**Objetivo:** Cambiar `namespace Asterisk.X` → `namespace Verbara.X` y package names en NuGet.

**Estrategia:** Una migración coordinada repo por repo, en orden de dependencia (Sdk → Pro → Platform).

#### Sub-fase 4.1 — `Asterisk.Sdk` → `Verbara.Sdk`

1. **Search/replace:** `Asterisk.Sdk` → `Verbara.Sdk` en todo el repo (con cuidado en strings/docs que se refieran al PBX original de Sangoma — ahí se queda como "Asterisk PBX")
2. **Renombrar archivos:** `Asterisk.Sdk.csproj` → `Verbara.Sdk.csproj`, etc. (`git mv`)
3. **Renombrar carpetas:** `src/Asterisk.Sdk.X/` → `src/Verbara.Sdk.X/` (`git mv`)
4. **Actualizar `<PackageId>` y `<AssemblyName>`** en cada `.csproj`
5. **Build local** debe compilar limpio
6. **Tests verde** después del rename
7. **Publicar nuevos paquetes a local-nuget-feed** con nombres `Verbara.Sdk.*`
8. **Mantener publicación temporal de paquetes con nombres viejos** (`Asterisk.Sdk.*`) por 6-12 meses como deprecation path para downstream

#### Sub-fase 4.2 — `Asterisk.Sdk.Pro` → `Verbara.Sdk.Pro`

Mismo pattern + actualizar dependency reference desde `Asterisk.Sdk` → `Verbara.Sdk`.

#### Sub-fase 4.3 — `Asterisk.Platform` → `Verbara.Platform`

Mismo pattern + actualizar dependency references a `Verbara.Sdk` y `Verbara.Sdk.Pro`.

**Criterio de éxito (por sub-fase):** build verde, tests verde, paquetes publicados a local feed con ambos nombres (transitional).

### Fase 5 — Rename del Web (.NET-independent, JS) (3-5 días)

**Objetivo:** Cambiar `asterisk-platform-web` → `verbara-web` en `package.json` + actualizar referencias internas.

#### Tareas

1. `package.json` → `"name": "verbara-web"`
2. Buscar referencias a `asterisk-platform-web` en:
   - `package-lock.json` (regenera con `npm install`)
   - Docker `Dockerfile` (si menciona el nombre)
   - `nginx.conf`
   - `vite.config.ts`
   - Comentarios en código
3. Actualizar URL en `git@github.com:verbara/verbara-web.git`
4. Actualizar URLs en docs (READMEs, plans, ADRs históricos no — solo docs activos; ADRs son append-only)

**Build verde + tests verde + Playwright verde + nginx funcionando = success.**

### Fase 6 — Coordinación cross-repo (3-5 días)

**Objetivo:** Asegurar que todas las dependencias entre repos apuntan a los nombres nuevos.

1. Web: actualizar referencias en doc/comentarios al backend (si los hay) — `Asterisk.Platform` → `Verbara.Platform`
2. Cada repo `.NET`: actualizar `<ProjectReference>` y `<PackageReference>` a los nombres nuevos
3. Actualizar `local-nuget-feed` para que el nuevo `dotnet restore` use los `Verbara.*` packages
4. Verificar que la cadena Sdk → Pro → Platform → Web compila end-to-end

### Fase 7 — Docker / docker-compose (2-3 días)

**Objetivo:** Renombrar imágenes y servicios en docker-compose files.

1. `docker-compose.*.yml`: `asterisk-platform-web` → `verbara-web`, etc.
2. Image names en Dockerfiles y CI (cuando existan)
3. Container names, network names (si referencian "asterisk")

### Fase 8 — Anuncio público (cuando se decida publicar) (post-launch)

**Objetivo:** Comunicar el rebrand a la comunidad cuando se publique públicamente.

1. Blog post explicando el rebrand (trademark + brand vision)
2. Migration guide para usuarios existentes (si los hay) — cómo cambiar dependencias `Asterisk.* → Verbara.*`
3. Deprecation timeline de los paquetes con nombres viejos (típicamente 12 meses)
4. Update redes sociales / canales públicos

## Out of scope para este plan

- **Trademark filing de "Verbara"** en USPTO — separado, ~$5k legal cuando revenue justifique. Hasta entonces aplica common-law trademark vía uso comercial consistente.
- **Rebrand del logo / identidad visual** — separado, contratar diseñador.
- **Adquisición de `verbara.com`** — cuando revenue justifique ($500-5k al squatter).
- **Migration tooling** para usuarios externos — solo necesario si hay externos usando los repos viejos antes del rebrand.

## Verificación end-to-end

Después de Fase 7:

```sh
# 1. Cada repo compila clean con nuevo nombre
cd ~/source/verbara-sdk && dotnet build -c Release    # → Verbara.Sdk.dll
cd ~/source/verbara-sdk-pro && dotnet build -c Release # → Verbara.Sdk.Pro.dll
cd ~/source/verbara-platform && dotnet build -c Release # → Verbara.Platform.dll
cd ~/source/verbara-web && npm run build && npm run test -- --run

# 2. Cadena de dependencias resuelve
cd ~/source/verbara-platform && dotnet restore
# → debería resolver Verbara.Sdk + Verbara.Sdk.Pro desde local-nuget-feed

# 3. Web + backend integration end-to-end
cd ~/source/verbara-platform && docker compose up
cd ~/source/verbara-web && npm run dev
# → http://localhost:5173 debería mostrar la UI hablando con backend Verbara

# 4. Tests E2E
cd ~/source/verbara-web && npx playwright test
```

## Estimación

| Fase                       | Calendario       | Notas                                    |
| -------------------------- | ---------------- | ---------------------------------------- |
| 1 — Branding superficial   | 1-2 días         | Web ✅ done; faltan Sdk + Pro + Platform |
| 2 — Crear org + transferir | 1 día            | Mecánico                                 |
| 3 — Rename repos           | 1 día            | Mecánico                                 |
| 4 — Namespaces .NET        | 1-2 semanas      | Trabajo serio, repo por repo             |
| 5 — Rename Web             | 3-5 días         | Más simple que .NET                      |
| 6 — Cross-repo deps        | 3-5 días         | Coordinación                             |
| 7 — Docker                 | 2-3 días         | Mecánico                                 |
| 8 — Anuncio público        | (post-launch)    | Cuando se decida publicar                |
| **Total**                  | **~3-5 semanas** | Calendario, no full-time effort          |

## Dependencias

- Track 1A (v1.14.0 — Public docs baseline) en cada repo: **debe completarse primero**. Sin LICENSE/NOTICE/CONTRIBUTING en cada repo, no hay base sobre la que rebrandear.
- Decisión de cuándo publicar públicamente: si los repos siguen privados, este plan se ejecuta con calma. Si se decide publicar antes de terminar el rebrand, hay que acelerar las Fases 4-7.

## Mitigación de riesgos

| Riesgo                                                       | Mitigación                                                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Romper builds intermedios                                    | Cada sub-fase debe terminar en build verde + tests verde antes de mergear                                      |
| Romper dependencias downstream (si hay externos)             | Mantener publicación dual de paquetes Asterisk._ + Verbara._ por 6-12 meses                                    |
| Confusión durante la transición                              | Notas transitional explícitas en READMEs ("formerly Asterisk.X")                                               |
| Olvidar referencias a "Asterisk"                             | Final pass con `grep -ri "Asterisk" --include="*.cs" --include="*.ts" --include="*.md"` antes de declarar done |
| Conflicto con menciones legítimas a "Asterisk PBX" (Sangoma) | Mantener esas referencias intactas (son atribuciones a otro producto, no nuestro branding)                     |
