# Compliance Dashboard

**Date:** 2026-05-03
**Parent track:** v1.14.x — Track 4D (`v1.17.3-web`)
**Scope:** Platform.Web. Audit log dashboard + consent manager + data subject rights workflow. Apoyo a auditorías GDPR / SOC 2 / HIPAA-readiness.

## Context

Backend Platform tiene endpoints maduros de compliance:
- `audit-log` con filtering, pagination, retention configurable
- `gdpr/export` y `gdpr/purge` (use-gdpr.ts ya existe en Web)
- `compliance-rule` engine (parcialmente expuesto en `audit-page.tsx`)
- Retention policy config (parcialmente en `retention-admin-page.tsx`)

**Lo que falta en Web:**

1. **Audit dashboard avanzado** — los filtros actuales son básicos (date range, action). No hay: search libre, agrupación por user/tenant/resource, export CSV con filters aplicados, agregaciones (top actions, top users, anomaly detection).

2. **Consent manager** — sin UI. Backend tiene endpoints opt-in/opt-out per data subject, pero los admins no pueden ver/editar consents.

3. **Data subject rights workflow** — GDPR Art. 15-22: right of access, rectification, erasure, portability, restriction, objection. Backend tiene endpoints pero no hay workflow UI para tracking del request lifecycle.

Customers regulated (healthcare, finance, EU) necesitan auditar y ejercer derechos. Sin UI completa, esto se hace por ticket — no escala y no cumple SLAs regulatorios (ej. GDPR mandatorio responder en 30 días).

## Approved approach — 3 secciones

Una sola página `/admin/compliance/` con 3 tabs.

### Tab 1 — Audit Dashboard

Reemplaza el `audit-page.tsx` actual (que es básico). Mantiene la URL pero amplía features.

**Filters bar (top):**
- Date range picker (presets: today, 7d, 30d, custom)
- Search global (full-text en `details` + `actor` + `target`)
- Multi-select: action types, users, tenant (platform admin), resource types
- Severity filter (info / warning / critical)

**Layout:**
- Summary cards (top): total events, top action types, top actors, anomalies (e.g. login failures spike)
- Timeline chart (recharts): events per hour/day with action-type breakdown
- Data table (ag-grid, virtualized post-Track 5B): rows con expand-detail

**Export:**
- CSV con filtros aplicados — endpoint backend existente (`/api/v1/audit/export?...`)
- PDF (defer, requiere backend rendering)

### Tab 2 — Consent Manager

**Layout:**
- Search por data subject (email/external_id)
- Para cada subject: lista de consents activos + revoked, con timestamps y source (UI / API / API token)
- Bulk import via CSV (formato definido en backend)
- Audit trail per consent — quién cambió, cuándo, desde dónde

**Edit flow:**
- Single consent: dialog con justificación obligatoria (audit log mejor)
- Bulk revoke: confirm-delete-dialog con preview de cuántos subjects afectados

### Tab 3 — Data Subject Rights Workflow

Tablero kanban (o lista filtrable) de requests:

```
[New]    [Acknowledged]    [In Progress]    [Completed]    [Rejected]
```

Cada request es una tarjeta con:
- Subject id/email
- Right type (access / rectification / erasure / portability / restriction / objection)
- Submitted at
- Due date (calculado: submitted + 30 días GDPR, o configurable)
- Assignee (admin del tenant)
- Status notes (audit trail interno)

**Workflow actions:**
- Acknowledge → status update + email automático al subject
- Generate export (right of access) → trigger backend `gdpr/export` y attach al request
- Execute deletion (right of erasure) → backend `gdpr/purge` con confirm-delete (3s delay) y password re-entry
- Reject (con justificación obligatoria; audit log permanente)

**Compliance metrics dashboard:**
- Avg response time
- % completed within SLA (< 30 días)
- Pending requests overdue (red highlight)

## Implementation outline

1. Hook `use-audit-log.ts` (extender existing) con filters avanzados
2. Hook `use-consents.ts`, `use-data-subject-rights.ts`
3. Page `src/admin/compliance/compliance-page.tsx` con 3 Tabs (Tabs.Root pattern existente)
4. Componentes:
   - `audit-dashboard-tab.tsx` con summary cards + timeline + ag-grid
   - `consent-manager-tab.tsx` con search + list + bulk import dialog
   - `subject-rights-tab.tsx` con kanban/list
   - `subject-rights-card.tsx` — la tarjeta de request
   - `audit-export-dialog.tsx` — confirma export con filters preview
5. i18n keys en `admin:compliance.*` (3 locales). Términos legales (GDPR, "data subject", "controller", "processor") usar terminología oficial regulatoria — coordinar con legal o copiar de templates ICO/EDPB.
6. Permission: `compliance:audit:view` (read-only audit), `compliance:consent:manage`, `compliance:rights:execute`
7. Sidebar: "Compliance" como section top-level (no nested bajo "Security" — el alcance es mayor)
8. Tests:
   - Unit del kanban transitions (state machine)
   - E2E del flujo "submit right of access → admin acknowledge → generate export → completed"

## UX patterns críticos

- **Read-only por default** — toda action que modifica state requiere confirmación. Audit log es append-only en UI también.
- **Justificación obligatoria** — cualquier rechazo o bulk revoke pide razón en text field (mín. 20 caracteres) → al audit log.
- **Anonymization preview** — cuando se ejecuta erasure, mostrar preview de qué campos quedan vs cuáles se anonimizan vs cuáles se borran físicamente (depende de retention policy).
- **Legal hold** — si un subject tiene un legal-hold flag, erasure NO procede; UI debe mostrar warning prominente con razón.
- **i18n del estado regulatorio** — algunos términos NO se traducen ("GDPR", "HIPAA"), otros sí ("data subject" → "titular de datos" en español). Coordinar con legal.

## Out of scope

- **HIPAA-specific workflows** (BAA tracking, breach notification automation) — defer a Track HIPAA-readiness dedicado si customer lo demanda
- **SOC 2 evidence collection** automated — defer; el audit dashboard es la fundación, evidence collection es una capa encima
- **Cross-tenant compliance reports** (platform admin) — defer
- **PDF generation client-side** — usar backend rendering vía Track futuro, no jspdf
- **Anomaly detection ML-based** — la tabla audit muestra "spikes" simples (count > 2x baseline); ML defer

## Open questions

1. **¿Quién tiene permission `compliance:rights:execute`?** — solo DPO (Data Protection Officer) o admin del tenant? Probablemente role-based, no permission directa. Discutir con stakeholder.
2. **¿Workflow tickets se asignan automáticamente?** Round-robin entre admins, o manual claim?
3. **¿Email templates al data subject configurables por tenant?** — Track 4E (Notification rules) ya plantea templates; reutilizar.
4. **¿Backup/retention del audit log?** — el audit es immutable pero retention configurable. Confirmar default (7 años GDPR? 10 años SOX?). Coordinar con legal.
5. **¿Multi-language del audit dashboard contenido?** — los `details` del audit log vienen del backend en inglés. Decidir si se traducen UI-side o backend ofrece versions per-locale. Probablemente UI traduce con fallback al raw.
