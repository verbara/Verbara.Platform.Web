---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Verbara.Platform.Web/ADR-0009
---

## Why

ADR-0009 (Agent Presence, Session & Work-Continuity) shipped its backend fully — W1–W6 all live —
but two of its admin-facing affordances were **deliberately deferred as Web work** so the tracks
could stay focused and avoid opening the i18n-parity surface for non-critical convenience UI:

- **W3 admin force-offline UI button** (ADR-0009 line 98): the `POST /api/v1/admin/agents/{id}/force-offline`
  endpoint shipped, but the UI affordance + 3-locale i18n were explicitly deferred.
- **W4 `PendingPauseTimeoutMinutes` editor** (ADR-0009 line 158): the per-tenant value ships
  server-side in `TenantAuthConfig`, but the admin editor was deferred to align with the
  `AgentLivenessTimeoutSeconds`/session-idle admin surface.

Both endpoints and their per-tenant config are LIVE today; only the admin surfaces are missing. An
operator cannot force a routing-zombie agent offline from the UI (the only present affordance is a
**toast-only stub** on the operations agent-states page — it fires no request), nor tune the
deferred-pause timeout without a raw API call. This change closes those two ADR-0009 Grupo A gaps
against the endpoints as they already exist.

## What Changes

- **A. Admin force-offline button (W3).** A net-new `useForceOffline` mutation hook in
  `src/core/api/hooks/use-agents.ts` (`POST /api/v1/admin/agents/{id}/force-offline`) plus a
  destructive button on `src/admin/agents/agent-detail.tsx`. The button reuses
  `src/core/ui/confirm-delete-dialog.tsx` with `confirmationWord="FORCE"` and exposes a
  `revokeSessions` toggle (the endpoint's optional refresh-token-family revocation). The existing
  toast-only stub menu item at `src/operations/agent-states/agent-states-page.tsx:192` is **not**
  the admin surface — it stays a stub; the real admin action lives on `agent-detail.tsx`.
- **B. PendingPauseTimeoutMinutes editor (W4).** A new `pendingPauseTimeoutMinutes` number `Input`
  on `src/admin/system/auth-config-page.tsx` (mirroring the existing `sessionIdleTimeoutMinutes`
  control), backed by extending the `AuthConfig` type + `useAuthConfig` / `useUpdateAuthConfig`
  hooks in `src/core/api/hooks/use-auth-admin.ts` (`GET`/`PUT /api/v1/admin/auth/config`).
  Semantics: `0` disables the timeout force-apply for the tenant (ADR-0009 line 133). The editor
  lives on the **SYSTEM auth-config page** (own-tenant, scoped by `tid`) — not the per-tenant
  tenant-settings-form (scope decision fixed upstream by the orchestrator).
- **i18n:** new keys added across **all three** locales (`public/locales/{en-US,es-419,pt-BR}/`) —
  `admin.json` `auth.*` for the editor and `admin.json` `agents.*` + `common.json`
  `confirm_dialog.*` for the button. CI's `scripts/i18n-parity-check.mjs` fails if any key is
  missing in any locale.

No breaking change: the force-offline hook is additive, and the `AuthConfig` extension adds one
optional field consumed by a partial `PUT` (existing callers unaffected).

## Capabilities

### New Capabilities

- `agent-presence-admin-controls`: the Web admin surfaces for ADR-0009 Grupo A — the force-offline
  destructive action (with session revocation) on agent detail, and the per-tenant deferred-pause
  timeout editor on the system auth-config page. Covers the wire contract each surface consumes,
  the confirm-word gate, the `0`-disables semantics, and 3-locale i18n parity.

### Modified Capabilities

<!-- None — no existing Web living spec governs agent-presence admin controls; this is net-new. -->

## Impact

- **New hook:** `useForceOffline` in `src/core/api/hooks/use-agents.ts`.
- **Modified hooks/type:** `AuthConfig` + `useAuthConfig` / `useUpdateAuthConfig` in
  `src/core/api/hooks/use-auth-admin.ts` gain `pendingPauseTimeoutMinutes`.
- **Modified UI:** `src/admin/agents/agent-detail.tsx` (force-offline button + dialog),
  `src/admin/system/auth-config-page.tsx` (timeout Input).
- **Reused UI:** `src/core/ui/confirm-delete-dialog.tsx` (`confirmationWord="FORCE"`).
- **i18n:** `public/locales/{en-US,es-419,pt-BR}/admin.json` + `.../common.json` — parity gate
  `scripts/i18n-parity-check.mjs`.
- **Consumed Platform endpoints (LIVE, no Platform change in this child):**
  `POST /api/v1/admin/agents/{id}/force-offline`, `GET`/`PUT /api/v1/admin/auth/config`.
- **No runtime dependency added, no new CI job:** the existing blocking `build` + `i18n:check` +
  `vitest` gates cover this change.
- **Not in scope:** any Platform endpoint/DTO change (LIVE already); the operations agent-states
  stub menu item (stays a stub); the per-tenant tenant-settings-form (scope fixed to the system
  auth-config page).
