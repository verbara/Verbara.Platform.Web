## ADDED Requirements

### Requirement: Admin force-offline action on agent detail

The Admin agent-detail view (`src/admin/agents/agent-detail.tsx`) SHALL expose a destructive
force-offline action that calls `POST /api/v1/admin/agents/{id}/force-offline` via a net-new
`useForceOffline` mutation hook in `src/core/api/hooks/use-agents.ts`. The action MUST be gated by
`src/core/ui/confirm-delete-dialog.tsx` with `confirmationWord="FORCE"` (the operator types
`FORCE` to confirm — no countdown path), and MUST expose a toggle for the request's
`revokeSessions` field. The button and its dialog MUST carry `data-testid` selectors and MUST use
`@base-ui/react` via the `render` prop (never Radix `asChild`).

**API-contract dependency (API-first, LIVE):** this consumes the W3 endpoint
`POST /api/v1/admin/agents/{id}/force-offline` (ADR-0009 line 79 — `AdminOnly` +
`RequireOperationalTenant`, tenant-scoped, forces Offline + removes the presence key + optionally
revokes the refresh-token family + writes an audit entry). No Platform change is in this child.

The request body is the golden fixture
`Verbara.Platform/openspec/changes/surface-agent-presence-admin-controls/fixtures/force-offline-request.json`,
cited verbatim:

```json
{
  "revokeSessions": true
}
```

The single wire field the action writes is **`revokeSessions`** (boolean). When the toggle is on,
the hook sends `revokeSessions: true`; when off, `revokeSessions: false`. No field is renamed or
paraphrased.

#### Scenario: Operator forces an agent offline with session revocation

- **GIVEN** an admin is on `agent-detail.tsx` for a routable agent and the `revokeSessions` toggle is enabled
- **WHEN** the operator opens the force-offline dialog, types `FORCE` into the confirm input, and confirms
- **THEN** `useForceOffline` issues `POST /api/v1/admin/agents/{id}/force-offline` with body `{ "revokeSessions": true }`, the `['agents', id]` / `['agents']` queries are invalidated, and a success toast is shown

#### Scenario: Operator forces an agent offline without revoking sessions

- **GIVEN** an admin is on `agent-detail.tsx` and the `revokeSessions` toggle is disabled
- **WHEN** the operator confirms the force-offline dialog by typing `FORCE`
- **THEN** the request body carries `"revokeSessions": false` and the agent is forced Offline without revoking its refresh-token family

#### Scenario: Confirm-word gate blocks an unconfirmed force-offline

- **GIVEN** the force-offline dialog is open with `confirmationWord="FORCE"`
- **WHEN** the confirm input does not exactly equal `FORCE`
- **THEN** the destructive confirm button stays disabled and no request is sent

### Requirement: PendingPauseTimeoutMinutes editor on the system auth-config page

The system auth-config page (`src/admin/system/auth-config-page.tsx`, own-tenant, scoped by
`tid`) SHALL expose a `pendingPauseTimeoutMinutes` number `Input`, mirroring the existing
`sessionIdleTimeoutMinutes` control, backed by extending the `AuthConfig` type plus the
`useAuthConfig` and `useUpdateAuthConfig` hooks in `src/core/api/hooks/use-auth-admin.ts`
(`GET`/`PUT /api/v1/admin/auth/config`). The editor MUST seed its value from the GET response and
MUST persist edits via a partial `PUT`. A value of `0` disables the deferred-pause timeout
force-apply for the tenant (ADR-0009 line 133). The `Input` MUST carry a `data-testid` selector.

**API-contract dependency (API-first, LIVE):** this consumes the W4 per-tenant config field
`PendingPauseTimeoutMinutes` on `TenantAuthConfig` (ADR-0009 lines 133, 147, 158 — default `30`;
`0` disables), read and written through `GET`/`PUT /api/v1/admin/auth/config`. No Platform change
is in this child.

The GET response is the golden fixture
`Verbara.Platform/openspec/changes/surface-agent-presence-admin-controls/fixtures/tenant-auth-config-response.json`,
cited verbatim:

```json
{
  "tenantId": "acme",
  "mfaPolicy": "Optional",
  "mfaRequiredRoles": ["Admin"],
  "passwordMinLength": 12,
  "passwordRequireUppercase": true,
  "passwordRequireNumber": true,
  "passwordRequireSpecial": true,
  "lockoutThreshold": 5,
  "lockoutDurationMinutes": 15,
  "sessionIdleTimeoutMinutes": 30,
  "sessionAbsoluteTimeoutHours": 24,
  "pendingPauseTimeoutMinutes": 30,
  "oidcEnabled": false,
  "oidcAuthority": null,
  "oidcClientId": null,
  "oidcClientSecretSet": false,
  "oidcClientSecretFingerprint": null,
  "oidcAutoCreateUsers": false,
  "oidcDefaultRole": "Agent",
  "impersonationMaxConcurrentSessions": 3,
  "impersonationAutoTimeoutMinutes": 30,
  "ipAllowlistEnabled": false,
  "updatedAt": "2026-07-27T00:00:00Z"
}
```

The partial-update write body is the golden fixture
`Verbara.Platform/openspec/changes/surface-agent-presence-admin-controls/fixtures/tenant-auth-config-update-request.json`,
cited verbatim:

```json
{
  "pendingPauseTimeoutMinutes": 20
}
```

The single wire field this editor reads and writes is **`pendingPauseTimeoutMinutes`** (int). It
is read from the response fixture to seed the `Input` and written back as a partial `PUT` body. No
field is renamed or paraphrased.

#### Scenario: Editor seeds from the current tenant auth config

- **GIVEN** `useAuthConfig` resolves `GET /api/v1/admin/auth/config` returning `"pendingPauseTimeoutMinutes": 30`
- **WHEN** the auth-config page renders
- **THEN** the `pendingPauseTimeoutMinutes` number `Input` shows `30`

#### Scenario: Operator lowers the deferred-pause timeout

- **GIVEN** the operator edits the `pendingPauseTimeoutMinutes` `Input` to `20`
- **WHEN** the form is saved
- **THEN** `useUpdateAuthConfig` issues `PUT /api/v1/admin/auth/config` with the partial body `{ "pendingPauseTimeoutMinutes": 20 }`, the `['auth-config']` query is invalidated, and a success toast is shown

#### Scenario: Zero disables the deferred-pause timeout

- **GIVEN** the operator sets `pendingPauseTimeoutMinutes` to `0`
- **WHEN** the form is saved
- **THEN** the partial `PUT` body carries `"pendingPauseTimeoutMinutes": 0`, which the Platform interprets as disabling the deferred-pause force-apply timeout for the tenant (ADR-0009 line 133)

### Requirement: Three-locale i18n parity for the new admin surfaces

Every new user-facing string introduced by the force-offline button and the
`pendingPauseTimeoutMinutes` editor SHALL have a key present in all three locale bundles
(`public/locales/{en-US,es-419,pt-BR}/`), under `admin.json` `auth.*` (editor) and `admin.json`
`agents.*` + `common.json` `confirm_dialog.*` (button). The change MUST NOT introduce a key that
is absent in any locale.

**API-contract dependency:** none — purely client-side i18n gated by `scripts/i18n-parity-check.mjs`.

#### Scenario: i18n parity gate passes for the new keys

- **GIVEN** the new `auth.*`, `agents.*`, and `confirm_dialog.*` keys are added to `en-US`, `es-419`, and `pt-BR`
- **WHEN** CI runs `scripts/i18n-parity-check.mjs`
- **THEN** the gate reports zero drift (every added key exists in all three locales)

## Architectural Risk

- **Level:** LOW.
- **Affected:** `src/admin/agents/agent-detail.tsx`, `src/admin/system/auth-config-page.tsx`,
  `src/core/api/hooks/use-agents.ts`, `src/core/api/hooks/use-auth-admin.ts`, and the three locale
  bundles. No Platform code — both endpoints (`POST /api/v1/admin/agents/{id}/force-offline`,
  `GET`/`PUT /api/v1/admin/auth/config`) are LIVE from ADR-0009 W3/W4.
- **Mitigation:** additive hook (`useForceOffline`) + one optional field on the existing
  `AuthConfig` type consumed by a partial `PUT` — existing callers are unaffected. All three wire
  fields are pinned to committed golden fixtures (cited verbatim above), so there is nothing to
  guess. The i18n-parity CI gate and the blocking `build` (`tsc -b`) + `vitest` gates catch key
  drift and type drift before merge.
