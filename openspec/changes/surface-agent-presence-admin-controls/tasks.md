## 1. Phase A — Foundation: hooks + types (batch)

- [x] 1.1 Add `useForceOffline` mutation to `src/core/api/hooks/use-agents.ts`: input
      `{ id: string; revokeSessions: boolean }`, `customFetch<void>` →
      `POST /api/v1/admin/agents/{id}/force-offline` with body `{ revokeSessions }` (the
      `force-offline-request.json` fixture shape — `revokeSessions` verbatim). On success
      invalidate `['agents']` + `['agents', id]` and toast; on error toast the message.
- [x] 1.2 Extend `AuthConfig` in `src/core/api/hooks/use-auth-admin.ts` with
      `pendingPauseTimeoutMinutes: number` (the `tenant-auth-config-response.json` field —
      `pendingPauseTimeoutMinutes` verbatim). `useAuthConfig` (GET) and `useUpdateAuthConfig`
      (partial `PUT` of `Partial<AuthConfig>`) already carry the field once typed — no signature
      change beyond the new field.

## 2. Phase B — Critical components: admin surfaces (focused)

- [x] 2.1 Force-offline button on `src/admin/agents/agent-detail.tsx`: a destructive button
      (`@base-ui/react` `render` prop, NOT Radix `asChild`) that opens
      `src/core/ui/confirm-delete-dialog.tsx` with `confirmationWord="FORCE"`. Add a
      `revokeSessions` toggle (its own `data-testid`), default off; on confirm call
      `useForceOffline.mutate({ id: agent.id, revokeSessions })`. Give the trigger button its own
      `data-testid` (e.g. `agent-detail-force-offline`). Guard with the appropriate
      `PermissionGuard` (AdminOnly), matching the existing delete affordance.
- [x] 2.2 `pendingPauseTimeoutMinutes` `Input` on `src/admin/system/auth-config-page.tsx`: clone
      the `sessionIdleTimeoutMinutes` control (~line 206) — `type="number"`, `min={0}` (0
      disables per ADR-0009), `data-testid="auth-config-pendingPauseTimeout"`,
      `value={form.pendingPauseTimeoutMinutes ?? 30}`,
      `onChange={(e) => update('pendingPauseTimeoutMinutes', Number(e.target.value))}`, with a
      hint that `0` disables. Save issues the partial `PUT`
      `{ "pendingPauseTimeoutMinutes": <n> }` (the `tenant-auth-config-update-request.json` shape).

## 3. Phase C — i18n + integration (batch)

- [x] 3.1 Add the new keys to ALL THREE locales
      (`public/locales/{en-US,es-419,pt-BR}/`): `admin.json` `auth.*` (timeout label +
      `0`-disables hint), `admin.json` `agents.*` (force-offline button + revoke-session toggle
      labels), and `common.json` `confirm_dialog.*` (any force-offline dialog copy not covered by
      the existing `confirm_delete_dialog.*`). Keys must match across locales.
- [x] 3.2 `npm run build` — `tsc -b && vite build` must pass clean (drift-catching gate).
- [x] 3.3 `npx vitest run` — add unit coverage: `useForceOffline` posts `{ revokeSessions }`
      (both true/false); the auth-config editor seeds from `pendingPauseTimeoutMinutes` and its
      save sends the partial `PUT` body (including `0`). All existing tests stay green.
- [x] 3.4 `npm run lint` + i18n parity: `npx eslint .` clean and `scripts/i18n-parity-check.mjs`
      (`i18n:check`) reports zero drift.
- [x] 3.5 `npx playwright test` — E2E for the two flows using `data-testid` selectors only
      (`agent-detail-force-offline` → type `FORCE` in `confirm-delete-word-input` → confirm via
      `confirm-delete-btn`; edit `auth-config-pendingPauseTimeout` → save). Follow the anti-flake
      fences: no `waitForTimeout`/wall-clock waits, assert via `expect(...)` polling or
      `waitForResponse` on the `force-offline` / `auth/config` calls; respect the suite posture
      (workers:1, retries:1, `data-testid` selectors).
