# Backend-to-UI Bridge — Catalog

**Date:** 2026-05-03
**Parent track:** v1.14.x Operational Foundation — Track 4 (Niveles `v1.17.x`)
**Scope:** Documenta los 32 endpoints del backend Platform que NO tienen hook Web. Doc operativa que guía qué construir y en qué orden.
**Related:** [ADR-0004](../decisions/0004-backend-to-ui-bridge-as-track.md)

## Context

Cross-repo audit comparó:

- Platform backend: ~71 archivos `*Endpoints.cs` con ~95 mapeos HTTP
- Platform.Web: 54 hooks `src/core/api/hooks/use-*.ts`

**Brecha: 32 endpoints sin consumidor Web.** Cubren capabilities ya shipped que clientes podrían usar pero no pueden — entry-point invisible en UI. La historia ha sido "agregar hooks oportunísticamente cuando una feature lo requiere"; con 32 atrasados, la práctica oportunista no cierra la brecha.

[ADR-0004](../decisions/0004-backend-to-ui-bridge-as-track.md) decide tratarlo como track dedicado de 5 sub-tracks agrupados por dominio. Este spec cataloga los 32 endpoints con priority, UI pattern y reuse references.

## Approved approach — 5 sub-tracks por dominio

Cada sub-track ship como patch + version bump; el último ship del track recibe tag `v1.17.5-web`.

### 4A — Tenant lifecycle & onboarding (Partner Portal) — `v1.17.0`

| Endpoint file | Purpose | UI pattern | Priority |
|---|---|---|---|
| `ManagementTenantEndpoints` | create / suspend / restore tenants | Detail page con state machine UI + confirm-delete-dialog (3s delay) | P0 |
| `ManagementSystemEndpoints` | system-wide config (license, retention defaults) | Settings page nested under `/admin/system/` | P1 |
| `SetupEndpoints` | advanced setup wizard steps | Extender `setup-wizard.tsx` existente | P1 |
| `OnboardingEndpoints` | onboarding flow per tenant | Wizard multi-step | P1 |

**Reuse:** `tenants-page.tsx` (existing list), `confirm-delete-dialog`, `data-table`. Hook nuevo: `use-management-tenants.ts`.

### 4B — Webhooks management — `v1.17.1`

| Endpoint file | Purpose | UI pattern | Priority |
|---|---|---|---|
| `ManagementWebhookEndpoints` | webhook subscriptions CRUD | List + detail + form | P0 |
| `WebhookEventTypeEndpoints` | event types catalog (read-only) | List with filters + drawer | P1 |
| `WebhookSubscriptionEndpoints` | per-tenant subscriptions | Sub-page de tenant | P0 |
| `NotificationEndpoints` | backend notifications dispatch | Embed en Notification Center (ver spec separado) | P0 |
| `SseEndpoints` | SSE connection management | Diagnostic dashboard (operator-only) | P2 |

**Reuse:** existing `notification-bell` infrastructure, `audit-trail-mini` para histórico de delivery. **Nuevo:** Webhook DLQ inspector (drawer con retry + replay + redrive controls).

### 4C — Recording + Media — `v1.17.2`

| Endpoint file | Purpose | UI pattern | Priority |
|---|---|---|---|
| `MapRecordingEndpoints` | playback + stereo channel selector | Player component (wavesurfer.js ya instalado) | P0 |
| `MediaEndpoints` | streaming/transcoding test | Diagnostic page (operator) | P2 |

**Reuse:** `wavesurfer.js`/`@wavesurfer/react` ya en deps. `audio-player.tsx` existente como base; agregar dual-channel toggle (left = agent, right = customer). **Nuevo:** Archive viewer con search por date/agent/queue.

### 4D — Compliance — `v1.17.3`

Subspec: [`2026-05-03-compliance-dashboard.md`](2026-05-03-compliance-dashboard.md)

| Endpoint file | Purpose | UI pattern | Priority |
|---|---|---|---|
| `RetentionAdminEndpoints` | dry-run + scheduled purges | Form + preview table | P0 |
| Audit dashboard endpoints | filtros + CSV export | Dashboard page con filters + ag-grid | P0 |
| Consent management endpoints | opt-in/out central | List + bulk actions | P0 |
| Data subject rights workflow | export/delete/portability requests | Multi-step workflow | P0 (regulatorio) |

**Reuse:** `audit-page.tsx` (existing), `gdpr-page.tsx` (existing), `retention-policy-section.tsx`.

### 4E — Notification rules + Misc — `v1.17.5` (cierre track)

Subspec: [`2026-05-03-notification-rules-admin.md`](2026-05-03-notification-rules-admin.md)

| Endpoint file | Purpose | UI pattern | Priority |
|---|---|---|---|
| Notification rules admin | channel routing, escalation rules | Rule builder UI | P0 |
| `CallAttemptEndpoints` | analytics suplementaria | Chart en analytics dashboard | P1 |
| `OutboundRouteEndpoints` | outbound routing config | Form + list | P1 |
| `PartnerBillingEndpoints` | billing analytics | Dashboard partner-only | P1 |
| `PartnerCustomerEndpoints` | customer-level usage | Detail nested in partner | P1 |
| `PartnerRevenueEndpoints` | revenue breakdowns | Charts | P1 |
| `PartnerSettingsEndpoints` | partner config | Form | P1 |

### Internal-only endpoints (deferred, justificadamente)

5+ endpoints son herramientas internas (diagnostics, health probes, migration helpers). Se documentan en spec pero no se exponen UI hasta justificación de operador concreta. Decisión revisable.

## Implementation pattern por sub-track

Cada sub-track sigue el patrón:

1. **Hook:** `src/core/api/hooks/use-<domain>.ts` — usa `customFetch<T>` de `src/core/api/client.ts`
2. **Page:** `src/admin/<domain>/<domain>-page.tsx` — list + filters + create button
3. **Detail drawer:** `src/admin/<domain>/<domain>-detail-drawer.tsx` (cuando aplica)
4. **Form:** `src/admin/<domain>/<domain>-form.tsx` con React Hook Form + Zod + i18n
5. **Routing:** entry en `router.tsx` con `PermissionGuard` apropiado
6. **Sidebar:** entry en `src/admin/sidebar.tsx`
7. **i18n:** keys en los 3 locales + `npm run i18n:check` verde
8. **Tests unit:** del hook (con MSW post-Track 2C) + del componente
9. **Tests E2E:** flujo crítico (create + edit + delete) en `tests/e2e/tests/<domain>/`

Subagent-driven: un subagente por sub-track. Cada subagente arranca leyendo este catálogo + el hook similar más reciente como referencia.

## Acceptance criteria

- 32 endpoints sin hook → ≤ 5 sin hook (los restantes con razón documentada en este catálogo, marcados como "deferred — internal only")
- Cada sub-track con su patch tag (`v1.17.0`..`v1.17.4`); cierre `v1.17.5-web` "Backend-to-UI Bridge complete"
- Coverage ≥ 80% líneas (post-Track 2C, mantener no bajar)
- E2E tests para flujos P0 (no obligatorio en P1, P2)

## Out of scope

- Redesign de hooks existentes — solo agregar los faltantes
- Cambios en backend (endpoints, contratos) — coordinar con Platform team aparte si surge necesidad
- Optimización de endpoints (caching, batching) — Track separado de performance

## Open questions

1. **Internal-only endpoints — UI eventualmente?** — defer decision hasta que operador concreto lo pida
2. **Endpoints deprecated en backend?** — verificar al inicio del track si Platform ha marcado alguno como `[Obsolete]` y skipearlo
3. **¿E2E para todos los endpoints P0 o solo críticos?** — todos los P0 customer-visible (Recording, Compliance, Tenant lifecycle); P1 con unit tests del hook suficiente
4. **¿Spec dedicado por sub-track?** — solo los más complejos (Compliance dashboard, Notification rules) tienen spec propio. Los demás se ejecutan desde este catálogo.
