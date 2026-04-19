# Plan: Crear sistemas completos de memoria para Platform y Platform.Web

## Context

Los repos Platform (API) y Platform.Web (React UI) no tienen sistema de memoria Claude. Cuando se trabaja directamente en ellos, Claude no tiene contexto de lo construido, decisiones tomadas, ni convenciones. El repo Pro tiene 90 archivos de memoria que funcionan como plantilla.

**Objetivo:** Crear CLAUDE.md + memory/ + MEMORY.md en ambos repos para que cualquier sesión futura tenga contexto completo.

---

## Datos verificados

| Repo | Packages | Tests | Files | Warnings |
|------|----------|-------|-------|----------|
| Platform | 27 src + 27 test | 908 (22 API failing) | 612 .cs | 0 |
| Platform.Web | - | 28 (4 test files) | 246 .ts/.tsx | 0 TS |

---

## Entregables (27 archivos nuevos + 1 update)

### Platform (15 archivos)
```
/home/orion75/.claude/projects/-media-Data-Source-IPcom-Asterisk-Platform/memory/
  MEMORY.md                          (índice)
  feedback_commit_rules.md           (copiar de Pro)
  feedback_no_company_references.md  (copiar de Pro)
  feedback_subagent_patterns.md      (copiar de Pro)
  feedback_subagent_execution.md     (copiar de Pro)
  feedback_update_plan.md            (copiar de Pro)
  feedback_nuget_docker_cache.md     (copiar de Pro)
  project_platform_architecture.md   (27 pkgs, store pattern, middleware, DI)
  project_platform_milestones.md     (S1→Plan 22, todas las versiones)
  project_plan21_demo.md             (demo docker, 8 servicios)
  project_plan22_schema.md           (queues→queue_configs, auto-migrate)
  project_v110_enterprise.md         (Auth+RBAC backend, 20 commits)
  research_auth_architecture.md      (JWT+MFA+OIDC+API Keys)
  research_rbac_design.md            (52 permisos, 7 templates)
  reference_pro_packages.md          (wiring de cada Pro package)

/media/Data/Source/IPcom/Asterisk.Platform/CLAUDE.md  (UPDATE existente)
```

### Platform.Web (13 archivos)
```
/home/orion75/.claude/projects/-media-Data-Source-IPcom-Asterisk-Platform-Web/memory/
  MEMORY.md                          (índice)
  feedback_commit_rules.md           (copiar de Pro)
  feedback_no_company_references.md  (copiar de Pro)
  feedback_shadcn_v4_baseui.md       (copiar de Pro)
  feedback_subagent_patterns.md      (copiar de Pro)
  feedback_subagent_execution.md     (copiar de Pro)
  feedback_update_plan.md            (copiar de Pro)
  project_web_architecture.md        (4 dominios, routing, state, API)
  project_web_milestones.md          (Plans 1-8, 18, 20c, 20d)
  project_web_hooks_inventory.md     (38 hooks documentados)
  project_v110_enterprise_ui.md      (Auth pages, RBAC guards, DnD)
  research_frontend_patterns.md      (shadcn, TanStack, Zustand, etc.)

/media/Data/Source/IPcom/Asterisk.Platform.Web/CLAUDE.md  (CREATE nuevo)
```

---

## Ejecución (Subagent-Driven, 4 fases)

### Fase A: Directorios + feedback (foundation)
- **Tarea A1:** Crear directorios memory/ para ambos repos
- **Tarea A2:** Copiar 6 feedback files → Platform memory/
- **Tarea A3:** Copiar 6 feedback files → Platform.Web memory/

### Fase B: Project + research memories (parallelizable)
- **Tarea B1:** Platform — project_platform_architecture.md + project_platform_milestones.md
- **Tarea B2:** Platform — project_plan21_demo.md + project_plan22_schema.md + project_v110_enterprise.md
- **Tarea B3:** Platform — research_auth_architecture.md + research_rbac_design.md + reference_pro_packages.md
- **Tarea B4:** Web — project_web_architecture.md + project_web_milestones.md
- **Tarea B5:** Web — project_web_hooks_inventory.md + project_v110_enterprise_ui.md + research_frontend_patterns.md

### Fase C: CLAUDE.md files (parallel)
- **Tarea C1:** Update Platform CLAUDE.md (rewrite con datos actuales)
- **Tarea C2:** Create Platform.Web CLAUDE.md (nuevo completo)

### Fase D: MEMORY.md indices (after B completes)
- **Tarea D1:** Platform MEMORY.md
- **Tarea D2:** Platform.Web MEMORY.md

---

## Nota: 22 API tests failing en Platform
Los tests fallidos son pre-existentes (no relacionados con este trabajo). Se documentarán en la memoria como bug conocido.

## Verificación
- Leer MEMORY.md de ambos repos → confirmar que todos los archivos existen
- Verificar que CLAUDE.md de Platform.Web tiene build commands correctos
- Verificar que cada memory file tiene frontmatter YAML válido
