# Plan — Platform.Web v1.9.0 "Value Materialization" (R4)

**Fecha:** 2026-04-21 · **Target:** v1.9.0 · **Tipo:** Minor feature release
**Depende de:** Platform v1.9.0 + v1.9.1 (shipped) · **Paralelo a:** eventual v1.9.2 (Asterisk 23 matrix)
**Track:** A (Pre-v2 continuation, R4) · **Estimación:** 2 semanas · **Repo:** `Asterisk.Platform.Web`

---

## Context

Platform backend ha shipped en este sprint dos releases que entregan valor ya existente pero no visible al usuario final:

- **v1.9.0 "Secure + Current"** — OpenTelemetry + Prometheus `/metrics`, T27 event bridges, Resilience MVP (3 call-sites), P0 security fixes (impersonation + MFA), bot handoff.
- **v1.9.1 "Resilience Coverage"** — 29 call-sites adicionales wrapped con `ResiliencePolicy`, HealthChecks con circuit-state awareness, `IResilienceStateObserver`, Grafana dashboard + runbook.

Track A designó **R4 Platform.Web** como el release siguiente que materializa ese valor en la UI. **Paralelo a v1.9.2 (Asterisk 23 matrix)** — zero dependencias cross-repo después de que Web consuma los nuevos hooks.

Platform.Web state baseline:

- Version `1.8.0` (SDK consumer via typed fetch to Platform.Api `/api/v1/*`)
- React 19 + TypeScript + Vite + Tailwind + shadcn/ui v4 (`@base-ui/react`, NO Radix)
- 45 unit tests (Vitest) + 265 E2E tests (Playwright)
- SignalR client (`@microsoft/signalr` v10) already wired via `src/core/realtime/platform-hub.ts` (Plan 32C Sprint 5 E2)

**Target version:** `v1.9.0` (Track A plan menciona "1.7.0" pero Web está en 1.8.0 — typo heredado; next minor = 1.9.0, coordinated naming with Platform backend).

---

## Alcance (6 frentes)

### A. SignalR consumer hooks — T27 bridges (Plan 32C close-out)

Los 3 backend T27 bridges shipped en Platform v1.9.0 publican a `IPushEventBus` con topics estandarizados. Web debe consumir vía `PlatformHub` + SignalR subscription + React Query invalidation.

| Hook                                            | Topic subscription                                           | Consumers                       | File                                                  |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------- |
| `useConversationStateStream(tenantId, convId?)` | `conversation.{tenant}.*.state.changed` (or single `convId`) | Conversation UI live-update     | `src/core/api/hooks/use-conversation-state-stream.ts` |
| `useAgentStateStream(tenantId, agentId?)`       | `agent.{tenant}.*.state.changed` (or single `agentId`)       | Agent desktop + supervisor view | `src/core/api/hooks/use-agent-state-stream.ts`        |
| `useClusterStateStream()`                       | `cluster.node.*.state.changed` (admin-scoped)                | Cluster admin page              | `src/core/api/hooks/use-cluster-state-stream.ts`      |

**Pattern** (reuse `src/core/realtime/use-realtime-presence.ts` precedent):

```typescript
export function useConversationStateStream(tenantId: string, convId?: string) {
  const hub = usePlatformHub();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!hub) return;
    const topic = convId
      ? `conversation.${tenantId}.${convId}.state.changed`
      : `conversation.${tenantId}.*.state.changed`;
    const unsubscribe = hub.on(topic, (evt: ConversationStateChangedEvent) => {
      // Invalidate relevant React Query caches
      queryClient.setQueryData(['conversations', tenantId, convId], (old) => ...);
    });
    return () => unsubscribe();
  }, [hub, tenantId, convId, queryClient]);
}
```

**Tests:** Vitest unit tests with mock `PlatformHub` verify subscription lifecycle + cache updates. Playwright E2E test adds a scenario where backend emits a state-changed event and UI updates within 500ms.

### B. Dashboards sin mocks — materialize real backend data

Dos dashboards en Web aún consumen mocks en lugar de las APIs reales que Platform ya expone.

1. **Call Analytics dashboard** (`src/pages/analytics/call-analytics/`)
   - Consume hook real: `useCallAnalytics(...)` backed by `/api/v1/call-analytics/...`
   - Remove mock data file (if exists: `__mocks__/call-analytics.ts` or similar)
   - Connect charts + tables to real response types (Pro.CallAnalytics.Storage.Postgres shapes)

2. **Bot Analytics dashboard** (`src/pages/analytics/bot-analytics/`)
   - Consume real-time metrics via `Pro.Analytics.Push` event stream (wired through `/api/v1/analytics/live`)
   - Charts: queue metrics, bot escalation rate, conversation duration

**Acceptance:** visual parity with mocked version + no `__mocks__` imports in production code paths. Playwright E2E verifies chart renders with real backend data (Testcontainers Postgres + seeded fixtures).

### C. Retention admin page (new)

Platform v1.8.0 shipped `Pro.Storage.Common.Retention` with `DryRun` default. Admins need a UI to:

- View retention policy status per table (event stores, CDR, dialer contacts, etc.)
- Toggle `DryRun` → live mode (danger zone UI with confirmation modal)
- See last execution status + rows-purged counter from meter
- Schedule override (one-off manual run)

**New files:**

- `src/pages/admin/retention/retention-page.tsx` (page component)
- `src/pages/admin/retention/retention-policy-card.tsx` (per-table card)
- `src/pages/admin/retention/retention-danger-zone-modal.tsx`
- `src/core/api/hooks/use-retention.ts` — hook wrapping `/api/v1/management/retention/*`
- Route registration in `src/App.tsx` or equivalent admin router

**API dependency:** `Platform.Api/Endpoints/ManagementRetentionEndpoints.cs` — verify/add if missing (requires `PlatformAdminOnly` authz).

### D. EventStore audit UI — expansion

Existing `src/pages/admin/audit/` probably covers basic auth events. Expand to surface:

- Impersonation events (both caller + target tenant entries — P0 v1.9.0 dual audit)
- MFA policy enforcement events (enrollment-required, policy-violation, policy-updated)
- Resilience circuit-open/close events from `IResilienceStateObserver` (optional dev-facing, gate behind feature flag)

**Scope:** extend existing audit page with filters by new action constants from `Asterisk.Platform.Identity.AuthEventTypes.ImpersonationTargetAccessed` + `ImpersonationPrivilegeEscalationAttempted`. Do NOT rewrite the audit page.

### E. P0 security UI — companion to v1.9.0 backend security fixes

Backend shipped P0 impersonation + MFA enforcement. Frontend needs companion UX:

1. **MFA enrollment wizard** (when login returns `MfaEnrollmentRequiredResponse`)
   - TOTP QR code display
   - Recovery codes (10 codes, download + print UI)
   - Verification step

2. **MFA login field** — when login returns `MfaChallengeResponse`, show TOTP code input.

3. **Sessions management page** (`src/pages/admin/security/sessions.tsx`) — list active refresh tokens, manual revoke button per session.

4. **Recovery codes regen** — user-settings page adds "regenerate codes" action (invalidates old + shows new).

5. **Password policy display** — visible in user-settings + admin tenant-settings.

**Acceptance:** Playwright E2E covers the full MFA enrollment flow (happy path + failure modes). Unit tests cover DTO deserialization from the new backend response shapes.

### F. Sub-B Web Sync (nice-to-have, scope TBD per session bandwidth)

- Cases backend wiring (if partially mocked)
- Canned responses UI (CRUD admin)
- 17+ i18n keys reported missing from recent Plan 33 work (see gitignored translations audit)

**Scope guard:** if F inflates the release beyond 2 weeks, defer to v1.9.1-web patch.

---

## Criterios de éxito (Acceptance global)

- ✅ `npm run build` — 0 TypeScript errors, 0 ESLint errors (`npm run lint` green)
- ✅ `npm test` — baseline 45 + new unit tests pass, 0 failures
- ✅ `npm run e2e` — baseline 265 + new Playwright specs pass (includes SignalR live-update + MFA wizard + retention danger-zone)
- ✅ All 3 SignalR hooks subscribed + emit React Query invalidations verified via Vitest mock
- ✅ Call Analytics + Bot Analytics dashboards use real APIs (no `__mocks__` imports in `src/pages/analytics/`)
- ✅ Retention admin page: DryRun toggle + confirmation modal + policy cards render
- ✅ Audit UI filters by new impersonation + MFA event action constants
- ✅ MFA enrollment wizard + TOTP challenge + sessions management page all shipped
- ✅ Docker compose `full.yml` up → Web connects to Platform.Api live, SignalR handshake succeeds
- ✅ Version bump 1.8.0 → 1.9.0 en `package.json` + CHANGELOG.md si existe (si no, crear)

---

## Archivos críticos (por frente)

**A — SignalR hooks:**

- `src/core/api/hooks/use-conversation-state-stream.ts` (new)
- `src/core/api/hooks/use-agent-state-stream.ts` (new)
- `src/core/api/hooks/use-cluster-state-stream.ts` (new)
- `src/core/realtime/platform-hub.ts` (may need topic subscription helpers)
- `src/core/api/hooks/__tests__/use-conversation-state-stream.test.tsx` (new)

**B — Dashboards mock removal:**

- `src/pages/analytics/call-analytics/call-analytics-page.tsx`
- `src/pages/analytics/bot-analytics/bot-analytics-page.tsx`
- Remove any `__mocks__/` in the same directories
- `src/core/api/hooks/use-call-analytics.ts` (likely exists, verify + fix)

**C — Retention admin:**

- `src/pages/admin/retention/` (new directory, 3-4 new files)
- `src/core/api/hooks/use-retention.ts` (new)
- Route registration
- Server-side: `Asterisk.Platform/src/Asterisk.Platform.Api/Endpoints/ManagementRetentionEndpoints.cs` (verify/add)

**D — Audit UI expansion:**

- `src/pages/admin/audit/audit-page.tsx` (extend filters)
- `src/core/api/hooks/use-audit.ts` (add new action constants)

**E — P0 security UI:**

- `src/pages/auth/login.tsx` (MFA challenge field)
- `src/pages/auth/mfa-enrollment.tsx` (new wizard)
- `src/pages/admin/security/sessions.tsx` (new)
- `src/pages/user-settings/recovery-codes.tsx` (new)
- `src/core/api/hooks/use-mfa.ts` (may exist — extend)
- `src/core/api/response-types.ts` — add `MfaEnrollmentRequiredResponse`, `PasswordResetMfaRequiredResponse`

**F — Sub-B (if in scope):**

- `src/pages/agent/cases/` (wiring)
- `src/pages/admin/canned-responses/` (CRUD UI)
- `src/locales/*.json` (i18n keys)

---

## Verification

```sh
cd /media/Data/Source/Verbara/Asterisk.Platform.Web

# Per-frente verification
npm run build                    # TypeScript + Vite build
npm run lint                     # ESLint
npm test                         # Vitest unit

# E2E (requires Platform.Api running)
docker compose -f ../Asterisk.Platform/docker/docker-compose.full.yml up -d
npm run e2e                      # Playwright — 265 baseline + new specs

# Smoke: SignalR handshake + live update
npm run dev                      # local Web server
# Open browser, login, observe conversation list updates on backend state change
```

---

## Commits esperados (~15-20)

1. `docs(plans): mirror R4 v1.9.0 plan to active/`
2. `feat(hooks): add useConversationStateStream for T27 conversation bridge` (Frente A)
3. `feat(hooks): add useAgentStateStream for T27 agent bridge` (Frente A)
4. `feat(hooks): add useClusterStateStream for T27 cluster bridge` (Frente A)
5. `feat(analytics): connect Call Analytics dashboard to real backend API` (Frente B)
6. `feat(analytics): connect Bot Analytics dashboard to Pro.Analytics.Push stream` (Frente B)
7. `feat(admin): add retention admin page with DryRun toggle` (Frente C)
8. `feat(admin): expand audit UI filters for impersonation + MFA events` (Frente D)
9. `feat(auth): add MFA enrollment wizard` (Frente E)
10. `feat(auth): add MFA challenge field to login flow` (Frente E)
11. `feat(admin): add sessions management page` (Frente E)
12. `feat(user-settings): add recovery codes regeneration + password policy display` (Frente E)
13. `feat(sub-b): cases backend wiring` (Frente F — optional)
14. `feat(sub-b): canned responses CRUD UI + i18n keys` (Frente F — optional)
15. `test(e2e): add Playwright specs for SignalR + retention + MFA wizard`
16. `chore(release): bump Platform.Web 1.8.0 -> 1.9.0 + CHANGELOG`

---

## Permissions previstos

- `Bash`: `npm` (build/test/lint/e2e/run), `docker compose` (up/down for E2E backend), `git` (status/log/diff — NO push sin confirmación)
- `Edit`/`Write`: `src/**`, `tests/**`, `docs/**`, `package.json` (version bump), `CHANGELOG.md`
- **No push sin confirmación explícita del usuario**

---

## Kickoff (next session)

1. `git status` + `git pull origin main` (main clean)
2. Review backend API contracts: verify `Platform.Api/Endpoints/ManagementRetentionEndpoints.cs` exists. If not, add it to v1.9.2 backend patch — OR include as part of R4 (cross-repo).
3. Run baseline `npm test` + `npm run e2e` (capture green counts).
4. **Execution strategy — Subagent-Driven with FCM batching:**
   - **Phase A (Foundation, batch):** docs + all 3 SignalR hooks (independent files, trivial to parallelize in 1 subagent)
   - **Phase B (Critical components, focused subagents paralelos — 3 agents):**
     - Subagent 1: Dashboards mock removal (Frente B)
     - Subagent 2: Retention admin page (Frente C) + Audit UI expansion (Frente D)
     - Subagent 3: P0 security UI (Frente E — MFA wizard + sessions + recovery codes)
   - **Phase C (Integration, batch):** Playwright E2E specs + version bump + CHANGELOG + release
5. **Decision mid-R4:** si Sub-B (Frente F) cabe dentro del budget de 2 semanas, agregar al scope; de lo contrario diferir a v1.9.1-web patch.

---

## Referencias

- **Track A execution order:** [`../../../Asterisk.Sdk.Pro/docs/plans/active/2026-04-20-track-a-execution-order.md`](../../../../Asterisk.Sdk.Pro/docs/plans/active/2026-04-20-track-a-execution-order.md)
- **v1.9.0 Platform release:** https://github.com/Harol-Reina/Asterisk.Platform/releases/tag/v1.9.0
- **v1.9.1 Platform release:** https://github.com/Harol-Reina/Asterisk.Platform/releases/tag/v1.9.1
- **T27 bridges source (Pro):** `Asterisk.Sdk.Pro/src/Asterisk.Sdk.Pro.Push.SignalR/Bridges/`
- **Existing SignalR client:** `src/core/realtime/platform-hub.ts`, `src/core/realtime/use-realtime-presence.ts`
- **Existing response DTOs (Platform backend):** `Asterisk.Platform/src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs` (MfaEnrollmentRequiredResponse, PasswordResetMfaRequiredResponse)

---

## No hacer en esta iteración

- **No Asterisk 23 matrix** (that's v1.9.2 backend scope)
- **No JWT hardening UI** (depends on backend v1.9.2+ JWT rotation — separate session)
- **No OIDC MFA enforcement UI** (blocked on backend OIDC callback fix — flagged orthogonal)
- **No MFA cache cross-instance UI** (infrastructure concern, not frontend)
- Y específicamente **no** meter shortcuts:
  - NO consumir mocks en Call Analytics o Bot Analytics post-ship (backend APIs existen y están probadas)
  - NO skippear Playwright E2E en MFA wizard (P0 flow, needs end-to-end validation)
  - NO bundlear los 3 SignalR hooks en un solo commit (cada hook independiente → audit trail claro)

---

## Progress log

### 2026-04-21 — Frente A / Opción B landed (local, pending push)

**Scope:** 2/3 hooks shipped via Platform-only relay (Opción B). Cluster hook diferido a Opción A (requires Pro-side `admins:platform` group, separate session).

**Commits (local main, not pushed):**

- Platform `999d494` — `feat(api): add PushToHubRelay forwarding T27 conversation+agent events to SignalR`
- Web `111d9ac` — `feat(realtime): add onHubEvent subscription helper for ad-hoc hub events`
- Web `a86cd01` — `feat(hooks): add useConversationStateStream for T27 conversation bridge`
- Web `00f1184` — `feat(hooks): add useAgentStateStream for T27 agent bridge`

**Tests:** Platform +5 (`PushToHubRelayTests`, 5/5 green, 1,762 total non-Postgres). Web +11 (6 conversation + 5 agent stream tests, 56/56 green, baseline 45).

**Implementation notes:**

- Relay uses dynamic SignalR method name via `SendCoreAsync(method, [payload], ct)` — avoids Pro change (no typed `IPlatformHubClient` extension). Opción A follow-up migrates to typed interface.
- Hooks use a new `onHubEvent<T>(method, handler) → unsubscribe` helper exported from `platform-hub.ts` — keeps the global `registerHandlers()` unchanged and lets components opt in per-effect.
- Broadcasts target the existing `tenant:{tenantId}` SignalR group (clients auto-join on connect via JWT `tid`). No backend schema / auth changes required.

**E2E deferred to Frente B.** Rationale:

- Hooks return `void` — no observable UI state without a consumer. Validating cache invalidation without a visible re-fetch adds either a test-only endpoint (backend debt) or a fake debug page (frontend debt).
- Frente B wires `Call Analytics` + `Bot Analytics` dashboards to real backend data → those become the natural consumers. Closing a conversation via the existing API causes `CallEndedEvent` → bridge → bus → relay → hub → `useConversationStateStream` → dashboard re-fetches updated row. That Playwright spec validates the complete wire with a realistic trigger.
- Contract is already covered end-to-end by unit tests on both layers (Platform 5 + Web 11 = 16). Transport is `@microsoft/signalr` v10 + ASP.NET SignalR — battle-tested.

**TODO for Frente B session:** add a Playwright spec under `tests/e2e/tests/analytics/` that (a) logs in as supervisor, (b) opens Call Analytics dashboard, (c) triggers conversation close via API or UI, (d) asserts the affected row updates within 500ms. Gate behind `E2E_FULL_STACK=true` following the existing `realtime-presence.spec.ts` pattern.

### 2026-04-21 — Frente A / Opción A follow-up landed (local, pending push)

**Scope:** 3/3 hooks complete. Migrated to typed `IPlatformHubClient` interface in Pro, added `admins:platform` SignalR group for PlatformAdmin connections, added cluster hook end-to-end.

**Commits (local main, not pushed):**

- Pro `68176d4` — `feat(push-signalr): add typed hub client methods + admins:platform group for T27 events`
- Pro `fa68350` — `chore(release): bump Pro 1.10.0-pro -> 1.11.0-pro`
- Platform `cbd66cd` — `feat(api): migrate PushToHubRelay to typed IHubContext + add cluster event forward`
- Web `39c2cb3` — `feat(hooks): add useClusterStateStream for T27 cluster bridge`

**Tests:**

- Pro `Push.SignalR.Tests` 58 → 61 (+3 admin group join scenarios)
- Platform `PushToHubRelayTests` 5 → 7 (+2 cluster forward + null-node skip) — all migrated to typed NSubstitute mocks
- Web total 56 → 62 (+6 cluster stream scenarios)

**Wire contract:** `OnConversationStateChanged` / `OnAgentStateChanged` / `OnClusterNodeStateChanged`. Payloads camelCase (Pro's `ProPresenceJsonContext` matches Platform's `ApiJsonContext`). No breaking change for Opción B consumers — the frontend hooks require no modification.

**New Pro version:** `1.11.0-pro` (minor, additive). Packaged in local feed; Platform pins advanced 15 entries from `1.10.0-pro` to `1.11.0-pro`.

**Frente A is now fully complete.** Next fronts: B (dashboards sin mocks — includes the deferred Playwright E2E for T27 conversation bridge), C (retention admin), D (audit UI), E (P0 security UI), F (Sub-B).

### 2026-04-21 — Frente B pivot: Pro.CallAnalytics materialization (Ω track)

**Scope correction driven by deep analysis.** Frente B as originally written (migrate Call Analytics + Bot Analytics dashboards from mocks) was premised on a stale understanding of the codebase. Reality check:

- `DashboardPage` + `BotAnalyticsCard` already consume real backend APIs — no mocks to migrate.
- `useCallAnalytics` hook does not exist; `/api/v1/analytics/qa` already surfaces Pro.CallAnalytics results via QA scoring UI.
- The genuine gap is **Pro.CallAnalytics aggregations** (topic trends, sentiment trends, compliance roll-ups) which `AnalyticsEndpoints.ListQa` does NOT expose — it returns per-session rows, not tenant-scoped aggregations.

**Frente B replaced by Ω track** — a 3-phase vertical slice materializing the latent Pro.CallAnalytics investment (99 backend tests, 5 analyzers, storage, tracing, per-analyzer resilience) via a supervisor-facing Speech Analytics dashboard.

#### Ω-1 → Ω-1b — Platform v1.9.3 aggregation endpoints (backend)

- **Ω-1 initial (commits `ca84105` + `bd5c498`)** — shipped list + detail endpoints that, post-landing, were discovered to duplicate `/api/v1/analytics/qa` list + detail (which already uses `ICallAnalyticsStore.QueryAsync` + CDR/agent enrichment). **Scope correction mid-flight** — no revert, refactor forward.
- **Ω-1b (commit `69ef239`)** — `CallAnalyticsEndpoints.cs` refactored to aggregations-only:
  - `GET /api/v1/call-analytics/topics/trends` — top N topics by occurrence with avg confidence
  - `GET /api/v1/call-analytics/sentiment/trends` — time-bucketed (day/week) sentiment metrics: avg score + positive/neutral/negative counts per bucket
  - `GET /api/v1/call-analytics/compliance/summary` — violations grouped by (RuleId, Severity) with occurrence + sessions-affected + severity breakdown
  - All gated by `SupervisorPlus` + `Analytics` license feature
- Platform bumped 1.9.2 → 1.9.3. CHANGELOG documents scope correction honestly. 7 tests (5 new + 2 kept topic/auth).

**Learnings from Ω-1 mistake:** when adding endpoints, grep existing endpoint code for the same backend service dependency (`ICallAnalyticsStore` here) before designing surface. Two endpoints touching the same store is a hot warning signal for duplication.

#### Ω-2 — Platform.Web Speech Analytics page (frontend)

- **Commits `9a7fcd1` + `41ef339`**:
  - 3 new hooks in `use-analytics.ts`: `useTopicTrends`, `useSentimentTrends`, `useComplianceSummary`. Query keys scoped to `['call-analytics', *]`.
  - New page at `/analytics/speech` (`src/analytics/speech-analytics/speech-analytics-page.tsx`) with 3 tabs consuming the hooks:
    - **Topic Trends** — horizontal bar chart + table (top N selectable 10 / 25 / 50)
    - **Sentiment Trends** — stacked bars (pos/neu/neg) + avg score line chart, Day/Week bucket toggle
    - **Compliance Overview** — severity pie + sortable rules table + severity filter
  - Page-level `onHubEvent('OnConversationStateChanged')` invalidates `['call-analytics']` when `newState === 'ended'` → live refresh without polling. Keeps generic `useConversationStateStream` hook untouched.
  - Sidebar entry: `sidebar.speech` (AudioWaveform icon) after QA.
  - Route wired in `router.tsx` via lazy import.
  - i18n: 28 keys in en-US + es-419 + pt-BR.
- Tests: 8 new (5 page + 3 hooks). Vitest 62 → 70 green.

#### Ω-3 — pending (next session)

1. **Enrich `qa-detail-drawer.tsx`** to surface Pro.CallAnalytics summary narrative + compliance violation list + sentiment per-turn timeline. The drawer today shows QA scorecard; the backend exposes more via `/api/v1/analytics/qa/{sessionId}` (`QaDetail` type already has summary + violations + sentiment + topics — the frontend fields may not all be rendered yet; audit needed).
2. **Playwright E2E for T27 conversation bridge** — closes the deferred acceptance criterion from Frente A. Spec: login supervisor → open `/analytics/speech` → trigger conversation close via API → assert `['call-analytics']` invalidation fires within 500ms (observable via re-fetch network request or data change on the page). Gate with `E2E_FULL_STACK=true`.

### Status after this session

- **Frente A ✅** (3/3 SignalR hooks, end-to-end wiring)
- **Frente B → pivoted to Ω** (Ω-1 + Ω-1b + Ω-2 shipped; Ω-3 pending)
- **Frente C / D / E / F** — pending
- **R4 release (v1.9.0 Web)** — will bundle Ω-3 completion + any subset of C/D/E/F desired

---

## 2026-04-22 — Absorbed into R5 Production Readiness Release Train

R4 pending scope is absorbed into the broader cross-repo release train R5. See authoritative spec in Platform repo: [`docs/plans/active/2026-04-22-r5-production-readiness-release-train.md`](../../../../../Asterisk.Platform/docs/plans/active/2026-04-22-r5-production-readiness-release-train.md).

Mapping of pending R4 items to R5:

| R4 pending item                              | R5 destination                                              |
| -------------------------------------------- | ----------------------------------------------------------- |
| Ω-3 drill-down (qa-detail-drawer enrichment) | R5.3 S4.6                                                   |
| Ω-3 Playwright E2E T27 bridge                | R5.3 S4.7                                                   |
| Frente C — Retention admin                   | R5.2 S3.5                                                   |
| Frente D — EventStore/Audit UI expansion     | R5.2 S3.2                                                   |
| Frente E — P0 security UI (MFA wizard)       | R5.2 S3.4 (co-shipped with MFA admin S3.1 for UX coherence) |
| Frente F — Sub-B Web Sync                    | R5.3 S4.8 (scope-guarded)                                   |

Rationale for absorption: R4 was Web-only in scope but the pending items all interlock with backend work (Platform audit enrichment, Retention per-tenant viewer, MFA admin view) and with Ops Toolkit UI (Phase 0 shared primitives consolidation benefits all subsequent UI work). Execution as one coordinated release train is more coherent than splitting R4 Web from a parallel Platform effort.

R4 release bump (was v1.9.0 Web) replaced by R5 staggered bumps: R5.2 ships Web 1.10.0 (absorbs Frentes C/D/E), R5.3 ships Web 1.11.0 (absorbs Ω-3 + Frente F + R4 closure criteria).

**This file remains in `plans/active/` until R5.3 ships the last absorbed R4 items; on R5.3 ship it moves to `plans/completed/` together with the R5 spec.**
