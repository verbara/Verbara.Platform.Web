# Notification Rules Admin UI

**Date:** 2026-05-03
**Parent track:** v1.14.x — Track 4E (`v1.17.5-web` cierre Bridge)
**Scope:** Platform.Web. Admin UI para configurar reglas de notificaciones del backend (channel routing, escalation, throttling). Zero backend changes.

## Context

Backend Platform tiene Notification Center completo desde Sprint 4 (2026-04-07): 5 endpoints, 14 tipos de notificación, 3 severidades (Info/Warning/Critical), routing por rol. Spec previo: `2026-04-10-sub-a-notification-center-design.md` (parcialmente shipped en v1.6.0).

**Lo que falta:** UI para que un admin de tenant configure las reglas (cuándo notificar, a quién, por qué canal, con qué severidad). Hoy las reglas son hardcoded en backend o configurables solo via API.

Customers enterprise piden self-service:
- "Notificar al supervisor solo si la cola tiene > 10 llamadas en espera por > 5 minutos"
- "Mandar email al admin de billing cuando un invoice queda overdue"
- "Push critical alerts al móvil del on-call después de las 6pm"

Sin UI, esto se configura por ticket de soporte → no escala.

## Approved approach

UI tipo "Rule Builder" con 4 sub-componentes:

### 1. Rules list page — `/admin/notifications/rules`

- Tabla de reglas activas con columnas: nombre, evento trigger, canales, severidad, recipientes, estado (active/paused), última disparo
- Filters: por evento type, por canal, por estado
- Bulk actions: pause/activate, delete
- Empty state con CTA "Create your first rule"

### 2. Rule editor — drawer o full page

Sectiones del editor (cada una colapsable):

**a) Trigger (event)** — dropdown de los 14 event types del catálogo backend (`webhook.event-types` endpoint). Cada type tiene sub-conditions configurables:

```
Event: queue.threshold.exceeded
  ├─ Queue: [select multi: support, sales, billing]
  ├─ Threshold: [number] calls in queue
  ├─ Sustained for: [number] [seconds/minutes]
```

**b) Conditions (filters)** — opcional. Combinador AND/OR sobre atributos del evento:

```
WHERE
  - tenant_id = current
  - AND severity >= warning
  - AND (queue.tag includes "vip" OR queue.priority = high)
```

UI: Visual condition builder estilo Linear/Notion (no SQL puro, no JSON puro — chips + dropdowns).

**c) Actions (channels)** — multi-select de canales con configuración por canal:

```
☑ Email     → To: [supervisors of queue], Subject template: [...]
☑ SMS       → To: [on-call rotation], Body template: [...]
☑ Push      → To: [admins on iOS/Android]
☐ Webhook   → URL: [...], Auth: [...]
☑ In-app    → Severity: [critical], Bell + toast
```

**d) Schedule (when active)** — opcional. Time-window restriction:

```
Active: [Always / Business hours / Custom schedule]
Timezone: [tenant default / explicit]
```

**e) Throttling** — anti-spam:

```
Send max [N] notifications per [hour/day]
Cooldown after fire: [minutes] silence
```

### 3. Rule preview — "what will fire?"

Antes de save, mostrar:
- Si la rule estuviera activa hace 24h, ¿cuántas veces habría disparado? (call al backend con dry-run del rule)
- Lista de los últimos N events que matchearían
- Recipients estimados

Útil para evitar reglas overzealous que generen alert fatigue.

### 4. History tab — auditoría de disparos

Por rule: tabla de disparos pasados (timestamp, evento snapshot, canales notificados, success/failure por canal, retry attempts).

Reuse: `audit-trail-mini.tsx` patrón.

## Implementation outline

1. Hook `use-notification-rules.ts` — list / get / create / update / delete / pause / dry-run
2. Page `src/admin/notifications/rules-page.tsx` — list view
3. Drawer `src/admin/notifications/rule-editor-drawer.tsx` — editor full
4. Componentes:
   - `rule-trigger-section.tsx` — dropdown event + sub-conditions dynamic
   - `rule-conditions-section.tsx` — visual AND/OR builder
   - `rule-actions-section.tsx` — multi-channel selector + per-channel config
   - `rule-schedule-section.tsx` — time-window picker
   - `rule-preview-card.tsx` — dry-run results
5. i18n keys en `admin:notifications.rules.*` (3 locales)
6. Permission: `notifications:rule:configure`
7. Sidebar entry: "Notifications" → "Rules" (nested bajo Comms o System según jerarquía existente)
8. Tests: unit del rule-editor con cases edge (todo vacío, todo lleno, conditions complejas), E2E flujo completo

## UX patterns críticos

- **Validación inline** — cada section valida con Zod al perder focus, no esperar submit
- **Dirty state** — confirm-leave dialog si user navega con cambios sin guardar
- **Versioning** — cuando se edita una rule existente, guardar versión previa en backend (audit trail). Backend ya lo soporta.
- **Test-fire button** — en dev/staging, enviar el rule a un endpoint que simula trigger sin afectar prod
- **Disable, no delete** — eliminar una rule borra el audit trail; preferir "pause" como soft-delete. Confirm-delete real solo en bulk action explícito.

## Out of scope

- **Rule templates marketplace** — librería de reglas pre-armadas. Defer hasta demanda real.
- **Conditional language (DSL)** — no exponer un lenguaje custom; mantener visual builder.
- **Cross-tenant rules** (platform admin) — backend lo permite pero UI lo expondría solo a platform admins (Track separado si demanda).
- **Real-time preview as-you-type** — preview solo on-demand (botón "Run preview"); evitar carga al backend.

## Open questions

1. **¿Cuántos rule events de los 14 ameritan UI dedicado?** Algunos son operacionales (system.health.degraded) — exponer a admin de tenant o solo platform admin? Decidir per-event al implementar.
2. **¿Templates de mensaje WYSIWYG vs Mustache?** Mustache simple `{{queue.name}}` para v1; WYSIWYG defer.
3. **¿Schedule con calendar integration (Google/Outlook)?** No, demasiado scope. Solo time-windows.
4. **¿Bulk import/export de rules (CSV/JSON)?** Útil para migración entre tenants. Defer a v2 del feature.
5. **¿Test-fire en producción?** Riesgoso (puede notificar a usuarios reales). Solo permitir en dev/staging via env flag.
