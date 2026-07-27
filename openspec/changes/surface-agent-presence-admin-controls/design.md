## Context

ADR-0009 (Verbara.Platform.Web/ADR-0009 — Agent Presence, Session & Work-Continuity, authored
under the shared Platform+Web workstream) shipped W1–W6 fully. Two admin-facing affordances were
recorded as **deferred Web work**:

- **W3 admin force-offline UI button** — ADR-0009 line 98: "the backend endpoint shipped; the UI
  affordance + 3-locale i18n are deferred to keep W3 focused and avoid opening the i18n-parity
  surface for a non-critical convenience."
- **W4 `PendingPauseTimeoutMinutes` editor** — ADR-0009 line 158: "the per-tenant value ships
  server-side; the editor is deferred (align with the `AgentLivenessTimeoutSeconds` admin surface
  when built)."

Both Platform endpoints are LIVE. This is the **CONSUMER child** of a cross-repo `/xr:propagate`
for ADR-0009 Grupo A: it only consumes the existing contract — no Platform endpoint/DTO change is
in scope. The three wire shapes are pinned by committed golden fixtures under
`Verbara.Platform/openspec/changes/surface-agent-presence-admin-controls/fixtures/`, cited verbatim
in `specs/agent-presence-admin-controls/spec.md`.

Current Web state (verified):

- `src/core/api/hooks/use-agents.ts` already types admin agents via the generated
  `AdminAgentResponseDto` + `hydrate` (client `id` alias) — a `useForceOffline` mutation is
  net-new alongside the existing `useUpdateAgent` / `useDeleteAgent`.
- `src/core/api/hooks/use-auth-admin.ts` has a hand-written `AuthConfig` interface plus
  `useAuthConfig` (GET) / `useUpdateAuthConfig` (partial `PUT` of `Partial<AuthConfig>`). It
  already carries `sessionIdleTimeoutMinutes` / `sessionAbsoluteTimeoutHours` — the model to
  mirror. It does **not** yet carry `pendingPauseTimeoutMinutes`.
- `src/admin/system/auth-config-page.tsx` renders the `sessionIdleTimeoutMinutes` control at
  ~line 206 (`type="number"`, `data-testid="auth-config-sessionIdle"`, `update(...)` on change) —
  the exact control to clone.
- `src/admin/agents/agent-detail.tsx` already imports a confirm dialog and holds a `deleteAgent`
  mutation with a `deleteOpen` state and `handleDelete` — the pattern to parallel for
  force-offline. The task pins the force-offline dialog to `confirm-delete-dialog.tsx`
  (`confirmationWord="FORCE"`), which supports a word-gate (`confirmationWord` prop) and a
  `data-testid="confirm-delete-word-input"` / `data-testid="confirm-delete-btn"`.
- `src/operations/agent-states/agent-states-page.tsx:192` is a **toast-only stub** menu item
  (`toast.success(...)`, no request). It is NOT the admin surface and stays a stub.

## Goals / Non-Goals

**Goals:**

- Add a `useForceOffline` mutation hook consuming `POST /api/v1/admin/agents/{id}/force-offline`
  with the fixture body `{ "revokeSessions": boolean }`.
- Wire a destructive force-offline button on `agent-detail.tsx` behind
  `confirm-delete-dialog.tsx` (`confirmationWord="FORCE"`) with a `revokeSessions` toggle.
- Extend `AuthConfig` + `useAuthConfig` / `useUpdateAuthConfig` with `pendingPauseTimeoutMinutes`
  and add a mirrored number `Input` on the system auth-config page (`0` disables).
- Ship the new i18n keys in all three locales so `scripts/i18n-parity-check.mjs` stays green.

**Non-Goals:**

- Any Platform endpoint/DTO change — both endpoints are LIVE (ADR-0009 W3/W4).
- Converting the operations agent-states stub menu item into a real action (out of scope; it
  stays toast-only — the admin action lives on `agent-detail.tsx`).
- The per-tenant tenant-settings-form — the orchestrator fixed the editor's scope to the SYSTEM
  auth-config page (own-tenant, `tid`-scoped).
- The `AgentLivenessTimeoutSeconds` editor (a separate W3 knob) — only
  `pendingPauseTimeoutMinutes` is in this child.

## Decisions

**D1 — `useForceOffline` sends the fixture body verbatim (`revokeSessions`).** The request body is
the golden fixture `force-offline-request.json` = `{ "revokeSessions": true }`. The hook takes
`{ id: string; revokeSessions: boolean }`, issues
`customFetch<void>({ url: \`/api/v1/admin/agents/${id}/force-offline\`, method: 'POST', data: { revokeSessions } })`,
invalidates `['agents']`/`['agents', id]`, and toasts on success. **`revokeSessions`** is used
verbatim (exact camelCase) — no rename. *Alternative rejected:* a bare `POST` with no body — the
fixture proves the endpoint accepts (and W3/ADR-0009 line 79 documents) the optional refresh-token-
family revocation, so the toggle is a real, contract-backed control, not invented.

**D2 — Reuse `confirm-delete-dialog.tsx` with `confirmationWord="FORCE"`.** Task-pinned. The dialog
already supports a word-gate (type the literal `FORCE`, no countdown) with
`data-testid="confirm-delete-word-input"` + `data-testid="confirm-delete-btn"`, so the destructive
intent is explicit. The `revokeSessions` toggle lives on `agent-detail.tsx` (a checkbox/switch
with its own `data-testid`) and is read into the mutation when the operator confirms. _Alternative
rejected:_ the generic `confirm-dialog.tsx` (used by the existing delete) — the task pins the
word-gated dialog for the more deliberate FORCE confirmation.

**D3 — `pendingPauseTimeoutMinutes` extends `AuthConfig`; editor mirrors `sessionIdleTimeoutMinutes`.**
Add `pendingPauseTimeoutMinutes: number` to the `AuthConfig` interface in `use-auth-admin.ts`;
`useAuthConfig` (GET) already returns the whole config (fixture `tenant-auth-config-response.json`
carries `"pendingPauseTimeoutMinutes": 30`), and `useUpdateAuthConfig` already sends a
`Partial<AuthConfig>`, so a partial `PUT` of just `{ "pendingPauseTimeoutMinutes": 20 }`
(fixture `tenant-auth-config-update-request.json`) is already the wire shape — no hook signature
change beyond the type field. The page adds one number `Input` cloned from the
`auth-config-sessionIdle` control with its own `data-testid`. **`pendingPauseTimeoutMinutes`** is
used verbatim (exact camelCase) — no rename. _Alternative rejected:_ a dedicated GET/PUT hook pair
— redundant; the auth-config endpoints already carry the field (fixtures prove it).

**D4 — `0` disables (surfaced, not clamped).** Per ADR-0009 line 133, `0` disables the deferred-
pause force-apply timeout. The `Input` allows `min={0}` (unlike `sessionIdle`'s `min={5}`) and a
hint communicates that `0` disables. The Web layer sends `0` verbatim; the disabling semantics are
enforced server-side.

**D5 — i18n keys in all three locales.** New strings: `admin.json` `auth.*` (the timeout label +
`0`-disables hint), `admin.json` `agents.*` (the force-offline button label + revoke toggle
label), and `common.json` `confirm_dialog.*` (any force-offline-specific dialog copy not already
covered by `confirm_delete_dialog.*`). Baseline for the parity check is `es-419`; keys land in
`en-US`, `es-419`, `pt-BR` together. `@base-ui/react` `render` prop is used for any new control
(never Radix `asChild`).

## Risks / Trade-offs

- [The generated `AdminAgentResponseDto` may not expose a force-offline result shape] → the
  endpoint returns no body of interest; `useForceOffline` types the response as `void` and relies
  on query invalidation to refresh presence, matching `useDeleteAgent`'s pattern. No generated DTO
  is needed.
- [`AuthConfig` is hand-written, not generated — risk of drift from the real contract] → mitigated
  by pinning to the committed `tenant-auth-config-response.json` fixture and the blocking `build`
  (`tsc -b`) gate; the field name matches the fixture exactly. (A future migration to the
  generated auth-config DTO is a separate concern, out of scope here.)
- [i18n parity gate fails if a key is missed in one locale] → add every new key to all three
  bundles in the same change and run `scripts/i18n-parity-check.mjs` before PR.
- [Confirm-word UX friction] → intentional: force-offline is destructive (pulls a live agent out
  of routing + optionally kills their sessions); the FORCE word-gate is the deliberate guard the
  task specifies.

## Migration Plan

Additive, no data migration. Deploy is a standard Web build. Rollback = revert the Web commit; the
LIVE Platform endpoints are untouched, so there is no coupled rollback. The change ships behind the
existing blocking `build` + `i18n:check` + `vitest` CI gates.

## Open Questions

None. All three consumed wire shapes are pinned by committed golden fixtures
(`force-offline-request.json`, `tenant-auth-config-response.json`,
`tenant-auth-config-update-request.json`), so there is no route or DTO left to guess. The editor's
scope (system auth-config page, not the per-tenant tenant-settings-form) was fixed by the
orchestrator. This design records durable choices; ADR-0009 already holds the architectural
decision, so no new ADR is required for this consumer child.
