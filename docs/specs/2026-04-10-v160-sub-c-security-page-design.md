# v1.6.0 Sub C — Security Page Polish + Critical Security Fixes

**Status:** Design approved, ready for plan
**Date:** 2026-04-10
**Parent release:** v1.6.0 "Production Polish"
**Repos touched:** `Verbara.Platform` (backend) + `Verbara.Platform.Web` (frontend)
**Related memory:** `project_v160_production_polish.md`
**Sub-project predecessor:** Sub A Notification Center (complete 2026-04-10)

## Executive Summary

Sub C started as "wire the MFA enabled flag in `security-page.tsx` line 30" but deep audit across 3 rounds of subagent analysis revealed a much richer scope:

- **2 P0 bugs** blocking production use (broken MFA login flow, impersonation privilege escalation)
- **1 security-policy bypass bug** (MfaDisable doesn't honor tenant `MfaPolicy`)
- **3 adjacent gaps with shipped backends** (user sessions management, recovery codes regeneration, password policy display)
- **5 edge cases** in the existing design (OIDC users, lockout state, MFA required banner, reset-password checklist, notification emits for security events)

The result is a tiered sub-project: Tier 0 critical bug fixes, Tier 1 polish + TODO closure, Tier 2 feature-level gaps with ready backends. All tiers ship in the same commit series.

**Scope:** 18 tasks, ~13–16h, 17–18 commits, +23 backend tests + 8 frontend unit tests + 10 E2E tests.

## Goals

1. Close the TODO at `security-page.tsx:30` by reading MFA state from the real user profile
2. Fix the broken MFA login flow (field name mismatch) blocking any user with MFA enabled
3. Close the impersonation privilege escalation vulnerability (admin can reset any user's MFA/password while impersonating)
4. Honor tenant `MfaPolicy` in `MfaDisable` (backend bypass bug)
5. Make `security-page.tsx` enterprise-grade with sessions management, recovery codes regeneration, and live password policy validation
6. Ensure discoverability via user-menu link (page was only reachable via admin sidebar)
7. Complete i18n coverage (17+ missing keys currently use inline fallbacks)
8. Emit security notifications (MFA enabled/disabled, password changed) to the Notification Center that just shipped in Sub A
9. Normalize security-page.tsx to the codebase's TanStack Query pattern (away from direct `customFetch`)

## Non-Goals (deferred)

- `/profile/*` self-service layout restructure — deferred until multiple profile pages exist (v1.7.0+)
- Email verification flow (backend not implemented)
- Trusted devices / "remember this device for 30 days"
- Personal security audit event log (requires new user-scoped endpoint; medium effort, medium value)
- Password history & expiration (`PasswordExpirationDays`, `MaxRecentPasswordHistory` not in `TenantAuthConfig`)
- Forced MFA enrollment at login (backend bug, v1.7.0 scope)
- WebAuthn / passkeys
- Agent Assist admin page (aborted in Sub B — see `project_agent_assist_deferred.md`)

## Architecture Overview

### Repos touched

| Repo                              | Work                                                                               | Version bump                                      |
| --------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| `Verbara.Platform` (backend)      | New endpoints, middleware extension, policy enforcement, notification emits, tests | v1.5.0 → v1.5.1                                   |
| `Verbara.Platform.Web` (frontend) | New hooks, page rewrite, user-menu link, i18n, tests                               | No bump yet (→1.6.0 after all Sub C/D/E complete) |

**No SDK changes.** `Verbara.Sdk` and `Verbara.Sdk.Pro` are untouched. No NuGet repack.

### Execution order

Strict sequencing to prevent rework:

```
[Tier 0 — bugs/vulns first]
T0.1 → T0.2 → T0.5 → T0.3 → T0.4

[Tier 2 backend — endpoints ready before frontend consumes]
T2.1a → T2.2a → T2.3a → T2.4a

[Tier 1 frontend — foundation + refactor]
T1.1 → T1.2 → T1.3 → T1.4 → T1.5

[Tier 2 frontend — security-page rewrite consumes everything]
T2.5 → E2E updates → verification
```

**Parallelism:** T1.3 (i18n) and T1.4 (user-menu link) can run parallel to T1.2 (mutation refactor). Everything else is sequential.

### Commit style

- Sub C merges directly to `main` in both repos (pattern from v1.5.0 Web Sync + Sub A)
- No feature branch
- Conventional Commits: `fix(security): ...`, `feat(security): ...`, `refactor(security): ...`, `chore(i18n): ...`
- No `Co-Authored-By` trailer

## Tier 0 — Critical fixes (P0 bugs + security vuln)

Non-negotiable. These are bugs, not features.

### T0.1 — MFA login field name mismatch

**Severity:** P0 regression. Users with MFA enabled cannot log in.

**Location:**

- Backend: `AuthEndpoints.cs` — `MfaChallengeResponse` record
- Frontend: `login-page.tsx:125` — expects `{ requiresMfa, mfaToken }`

**Current state:**

```csharp
// backend
internal sealed record MfaChallengeResponse(bool MfaRequired, string ChallengeToken);
```

```tsx
// frontend login-page.tsx:125
if (data.requiresMfa && data.mfaToken) {
  /* show MFA step */
}
```

With default camelCase JSON policy, the backend ships `{mfaRequired, challengeToken}` but the frontend looks for `{requiresMfa, mfaToken}`. The condition is always false. Users silently bounce back to login.

**Fix:** Rename backend properties (fewer call sites than frontend):

```csharp
internal sealed record MfaChallengeResponse(bool RequiresMfa, string MfaToken);
```

Update `ApiJsonContext.cs` if explicitly registered. Single file, single record, zero risk.

**Test:** 1 new test — `Login_ShouldReturnMfaChallengeWithCorrectFields_WhenUserHasMfa` asserting serialized JSON has `requiresMfa` and `mfaToken` keys.

### T0.2 — Impersonation privilege escalation guard

**Severity:** P0 security vulnerability. Equivalent to Sprint 0 security fixes.

**Location:** `TenantResolutionMiddleware.cs` — `BlockedImpersonationPaths` static HashSet (line ~14-20)

**Current state:** An admin impersonating a tenant user can call:

- `POST /auth/mfa/setup` — create new MFA secret for the victim
- `POST /auth/mfa/confirm` — confirm it
- `DELETE /auth/mfa` — disable victim's MFA
- `POST /auth/change-password` — change victim's password

The middleware already has `BlockedImpersonationPaths` logic for management-API paths, but auth self-service paths are not included.

**Fix:** Extend `BlockedImpersonationPaths` (or add a new `SecurityCriticalPaths` HashSet checked in the same branch) with:

```
POST /api/v1/auth/mfa/setup
POST /api/v1/auth/mfa/confirm
DELETE /api/v1/auth/mfa
POST /api/v1/auth/mfa/recovery-codes/regenerate
POST /api/v1/auth/change-password
POST /api/v1/auth/sessions/revoke-others
DELETE /api/v1/auth/sessions/{id}
```

Both full impersonation AND read-only impersonation must block these (read-only already blocks DELETE/POST by default; full must opt in via the HashSet).

**Tests (7 new):**

- `ImpersonationMiddleware_ShouldBlock_MfaSetup_WhenImpersonating`
- `ImpersonationMiddleware_ShouldBlock_MfaConfirm_WhenImpersonating`
- `ImpersonationMiddleware_ShouldBlock_MfaDisable_WhenImpersonating`
- `ImpersonationMiddleware_ShouldBlock_RecoveryCodesRegenerate_WhenImpersonating`
- `ImpersonationMiddleware_ShouldBlock_ChangePassword_WhenImpersonating`
- `ImpersonationMiddleware_ShouldBlock_RevokeOtherSessions_WhenImpersonating`
- `ImpersonationMiddleware_ShouldBlock_RevokeSession_WhenImpersonating`

All return 403 with a clear error message.

### T0.5 — MfaDisable tenant policy enforcement bug

**Severity:** Security-policy bypass. A user can disable MFA even when tenant policy requires it.

**Location:** `AuthEndpoints.cs` — `MfaDisable` handler (line ~499-527)

**Current state:** The handler verifies the user's password and clears `User.MfaEnabled` + `User.MfaSecret` + `User.MfaRecoveryCodes`. It **does not** check `TenantAuthConfig.MfaPolicy` or `MfaRequiredRoles`.

**Fix:** Add policy check at top of handler:

```csharp
var authConfig = await tenantAuthConfigStore.GetAsync(tenantId, ct);
if (authConfig is not null)
{
    var isMfaRequired = authConfig.MfaPolicy switch
    {
        "required_all" => true,
        "required_for_roles" => authConfig.MfaRequiredRoles.Contains(user.Role),
        _ => false
    };
    if (isMfaRequired)
        return Results.Forbid(new ErrorResponse("MFA is required by your organization and cannot be disabled."));
}
```

Also apply to `MfaConfirm` (if MFA is disallowed by policy, e.g., policy="disabled", prevent enrollment — this is a minor case but same pattern).

**Tests (3 new):**

- `MfaDisable_ShouldReturn403_WhenTenantPolicyRequiresMfaAll`
- `MfaDisable_ShouldReturn403_WhenUserRoleIsInMfaRequiredRoles`
- `MfaDisable_ShouldSucceed_WhenTenantPolicyIsOptional`

### T0.3 — `mfa-verify.tsx` error handling

**Severity:** P1 UX bug.

**Location:** `src/core/auth/mfa-verify.tsx`

**Current state:**

- No handling of HTTP 429 (rate limit) — shown as "Invalid code"
- No handling of expired challenge token — shown as "Invalid code"
- Recovery code entry UI exists but is untested

**Fix:**

- Add `if (response.status === 429)` branch showing "Too many attempts. Please wait and try again."
- Add `if (error.code === 'CHALLENGE_EXPIRED')` branch showing "Session expired. Please log in again." with a "Return to login" button
- (Backend optionally returns `{ code, message }` in error body — standardize if not already)

**Tests:** Covered in T0.4.

### T0.4 — E2E recovery code login path

**Severity:** P1. Recovery code path has never been tested end-to-end.

**Location:** `tests/e2e/tests/platform-admin/login.spec.ts`

**Current state:** `login.spec.ts` tests regular login and MFA code entry, but not recovery code entry.

**Fix:** Add 1 new E2E test:

```
test('should accept recovery code instead of TOTP during MFA verify', async ({ ... }) => {
  await apiHelper.setupTestUserWithMfa('test-user@...');
  await loginAs('test-user@...');
  // MFA step appears
  await page.getByTestId('login-mfa-use-recovery').click();
  await page.getByTestId('login-mfa-recovery-input').fill(RECOVERY_CODE_FIXTURE);
  await page.getByTestId('login-mfa-submit').click();
  await expect(page).toHaveURL(/\/admin/);
});
```

Requires a new `ApiHelper` method `setupTestUserWithMfa(email)` that enables MFA for a test user via API and returns the recovery codes.

## Tier 2 backend — Ready-for-frontend endpoints

Shipped before Tier 1 frontend so hooks can consume them directly without rework.

### T2.1a — User-scoped sessions endpoints

**Location:** `AuthEndpoints.cs`

**New endpoints:**

| Method   | Path                           | Auth                     | Handler               |
| -------- | ------------------------------ | ------------------------ | --------------------- |
| `GET`    | `/auth/sessions`               | `RequireAuthorization()` | `GetOwnSessions`      |
| `DELETE` | `/auth/sessions/{tokenId}`     | `RequireAuthorization()` | `RevokeOwnSession`    |
| `POST`   | `/auth/sessions/revoke-others` | `RequireAuthorization()` | `RevokeOtherSessions` |

**Difference from admin endpoints:** `/admin/auth/sessions?userId=X` exists for admins to view any user's sessions. The new `/auth/sessions` (no admin gate) always filters by the JWT's user claim and ignores any query parameter attempting to specify a different userId.

**DTO:**

```csharp
internal sealed record ActiveSessionDto(
    string TokenId,
    string? UserAgent,
    string? IpAddress,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    bool IsCurrentSession);
```

`IsCurrentSession` is computed by comparing `TokenId` against the current refresh token chain.

**Implementation:**

- `GetOwnSessions`: reuse `ISessionStore.ListByUserAsync(tenantId, userId)` or add if missing
- `RevokeOwnSession`: validate `session.UserId == currentUserId` before revoking; return 404 (not 403) if not found to avoid user-id existence leaks
- `RevokeOtherSessions`: list all, filter out current token, revoke each in a loop

**Tests (5 new):**

- `GetOwnSessions_ShouldReturnOnlyCurrentUserSessions_WhenCalled`
- `GetOwnSessions_ShouldIgnoreUserIdQueryParam_WhenProvided`
- `RevokeOwnSession_ShouldReturn404_WhenTokenBelongsToOtherUser`
- `RevokeOwnSession_ShouldSucceed_WhenTokenBelongsToCurrentUser`
- `RevokeOtherSessions_ShouldPreserveCurrentSession_WhenCalled`

### T2.2a — Recovery codes regenerate endpoint

**Location:** `AuthEndpoints.cs`

**New endpoint:**

| Method | Path                                  | Auth                     | Handler                   |
| ------ | ------------------------------------- | ------------------------ | ------------------------- |
| `POST` | `/auth/mfa/recovery-codes/regenerate` | `RequireAuthorization()` | `RegenerateRecoveryCodes` |

**Implementation:**

- Require current password in body (`{password: string}`) to confirm identity
- Require `user.MfaEnabled == true` — return 400 otherwise
- Call existing `GenerateRecoveryCodes()` helper (already used in setup flow)
- Overwrite `user.MfaRecoveryCodes` with fresh set
- Return `{recoveryCodes: string[]}` (10 codes, viewable once)
- Log auth event `RecoveryCodesRegenerated`

**DTO:**

```csharp
internal sealed record RegenerateRecoveryCodesRequest(string Password);
internal sealed record RecoveryCodesResponse(string[] RecoveryCodes);
```

**Tests (2 new):**

- `RegenerateRecoveryCodes_ShouldReturn10Codes_WhenMfaEnabledAndPasswordCorrect`
- `RegenerateRecoveryCodes_ShouldReturn400_WhenMfaNotEnabled`

### T2.3a — Password policy GET endpoint

**Location:** `AuthEndpoints.cs`

**New endpoint:**

| Method | Path                    | Auth                     | Handler             |
| ------ | ----------------------- | ------------------------ | ------------------- |
| `GET`  | `/auth/password-policy` | `RequireAuthorization()` | `GetPasswordPolicy` |

**Implementation:**

- Read `TenantAuthConfig` for current tenant
- Return subset DTO — NOT the full config (which contains OIDC secrets, lockout config, etc.)
- Fallback to platform default if tenant has no custom policy

**DTO:**

```csharp
internal sealed record PasswordPolicyDto(
    int MinLength,
    bool RequireUppercase,
    bool RequireLowercase,
    bool RequireNumber,
    bool RequireSpecial);
```

Note: `PasswordRequireLowercase` does not currently exist in `TenantAuthConfig`. Add it as a field (default true) OR compute it from an implicit rule. Decide in plan task.

**Tests (2 new):**

- `GetPasswordPolicy_ShouldReturnTenantPolicy_WhenCalled`
- `GetPasswordPolicy_ShouldNotLeakSecrets_WhenCalled` (asserts DTO only contains the 5 password fields, no OIDC/lockout fields)

### T2.4a — Security notification emits

**Location:** `NotificationTypeRegistry.cs` + `AuthEndpoints.cs`

**New notification types:**

```csharp
["security.mfa_enabled"] = new(
    "security.mfa_enabled",
    NotificationCategory.Security,
    NotificationSeverity.Info,
    new[] { "self", "admin", "system_admin" }),
["security.mfa_disabled"] = new(
    "security.mfa_disabled",
    NotificationCategory.Security,
    NotificationSeverity.Warning,
    new[] { "self", "admin", "system_admin" }),
["security.password_changed"] = new(
    "security.password_changed",
    NotificationCategory.Security,
    NotificationSeverity.Info,
    new[] { "self", "admin", "system_admin" }),
```

Note: `"self"` is a sentinel indicating "the user performing the action receives their own notification." If the registry does not support this pattern, extend routing logic or omit and let the admin propagation cover the user via their role.

**Handler injection:**

- Add `[FromServices] INotificationService notifications` parameter to:
  - `MfaConfirm`
  - `MfaDisable`
  - `ChangePassword`
- After the success path, call `await notifications.CreateAsync(tenantId, "security.mfa_enabled", title, body, actionUrl: "/admin/security", ct)`
- Localized titles/bodies should use the tenant's default language or fall back to English (dedup window: 5 min already handled by service)

**Tests (3 new):**

- `MfaConfirm_ShouldEmitNotification_WhenSucceeds`
- `MfaDisable_ShouldEmitNotification_WhenSucceeds`
- `ChangePassword_ShouldEmitNotification_WhenSucceeds`

## Tier 1 — Frontend foundation

### T1.1 — `useMe` hook with full typed return

**Location:** `src/core/api/hooks/use-me.ts` (new file)

**Type:**

```ts
export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: string;
  mfaEnabled: boolean;
  mfaConfirmedAt: string | null;
  authProvider: 'local' | 'oidc' | 'apikey';
  lockedUntil: string | null;
  failedLoginAttempts: number;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  emailVerified: boolean;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => customFetch<Me>({ url: '/api/v1/users/me', method: 'GET' }),
    staleTime: 60_000, // 1 min — profile data doesn't change often
  });
}
```

**Tests (3 new):** basic fetch, cache, invalidation after mutation.

### T1.2 — Refactor `customFetch` to mutations in `use-auth-admin.ts`

**Location:** `src/core/api/hooks/use-auth-admin.ts`

**New mutations:**

```ts
useSetupMfa(); // POST /auth/mfa/setup → returns MfaSetupResponse
useConfirmMfa(); // POST /auth/mfa/confirm, invalidates ['me']
useDisableMfa(); // DELETE /auth/mfa, invalidates ['me']
useChangePassword(); // POST /auth/change-password
useMySessions(); // GET /auth/sessions → ActiveSession[]
useRevokeSession(); // DELETE /auth/sessions/{id}, invalidates ['auth','sessions','me']
useRevokeOtherSessions(); // POST /auth/sessions/revoke-others, same invalidation
useRegenerateRecoveryCodes(); // POST /auth/mfa/recovery-codes/regenerate
usePasswordPolicy(); // GET /auth/password-policy, staleTime: Infinity
```

All follow the existing `use-auth-admin.ts` pattern. Each mutation has typed input/output, toast on success/error, narrow query invalidation.

**Query keys:**

- `['me']` — current user profile
- `['auth', 'sessions', 'me']` — own sessions list
- `['auth', 'password-policy']` — tenant password policy (cache infinite)

**Tests (5 new):** invalidation assertions for each mutation.

### T1.3 — i18n completion

**Location:** `public/locales/{es-419,en-US,pt-BR}/admin.json` + `common.json`

**Missing keys identified by audit:**

`admin.json` — add `security.*` subtree (17 keys):

```json
"security": {
  "title": "Security",
  "mfa": "Two-Factor Authentication",
  "mfa_description": "...",
  "enable_mfa": "Enable MFA",
  "disable_mfa": "Disable MFA",
  "scan_qr": "...",
  "manual_key": "...",
  "enter_code": "...",
  "change_password": "Change Password",
  "confirm_password_to_disable": "...",
  "save_recovery_codes": "...",
  "regenerate_recovery_codes": "Regenerate Recovery Codes",
  "regenerate_confirm": "...",
  "mfa_required_banner": "Your organization requires MFA...",
  "mfa_cannot_disable": "MFA is required...",
  "oidc_badge": "Federated Identity (OIDC)",
  "active_sessions": "Active Sessions",
  "this_session": "This session",
  "revoke_session": "Revoke",
  "sign_out_others": "Sign out all other devices",
  "sessions_timeout_note": "Sessions expire after...",
  "account_locked": "Account locked until {{time}}",
  "password_policy_title": "Password requirements",
  "password_too_short": "At least {{n}} characters",
  "password_needs_uppercase": "One uppercase letter",
  "password_needs_lowercase": "One lowercase letter",
  "password_needs_number": "One number",
  "password_needs_special": "One special character"
}
```

`common.json` — add missing keys:

```json
"status": { "enabled": "Enabled", "disabled": "Disabled" },
"actions": { "copy": "Copy", "download": "Download", "done": "Done", "next": "Next" }
```

Also `admin.sidebar.security` key (currently falls back to "Security").

Total across 3 locales: ~60–75 strings. Mechanical task.

### T1.4 — User-menu "Security" link

**Location:** `src/shell/user-menu.tsx`

**Change:** Add `<DropdownMenuItem>` between Theme submenu and Logout:

```tsx
<DropdownMenuItem onClick={() => navigate('/admin/security')}>
  <Lock className="mr-2 h-4 w-4" />
  {t('nav.security', 'Security')}
</DropdownMenuItem>
```

No permission gate — `/admin/security` is already reachable by any authenticated user (the route has no PermissionGuard, confirmed by audit).

### T1.5 — Apply `usePasswordPolicy` to `reset-password-page.tsx`

**Location:** `src/core/auth/reset-password-page.tsx`

**Current state:** Hardcoded password checks (length ≥ 12, uppercase, number, special) that may or may not match the tenant's actual policy.

**Fix:** Replace hardcoded checks with `usePasswordPolicy()` hook. Render the same live checklist component used in `security-page.tsx`. Fallback to hardcoded values if the hook errors (defensive — the page must still function).

## Tier 2 — Frontend feature cards (security-page rewrite)

### T2.5 — Rewrite `security-page.tsx`

**Location:** `src/admin/profile/security-page.tsx`

**Rationale for rewrite (not incremental):** 324 lines of mixed state + fetch + UI, 4 `customFetch` calls to refactor, 3 new cards to add, 3 new edge-case handlers. Incremental refactor leaves the file in inconsistent intermediate states. Clean rewrite is lower-risk.

**New layout:**

```
┌─────────────────────────────────────────┐
│ Page header: "Security"                 │
│ [OIDC badge if applicable]              │
├─────────────────────────────────────────┤
│ [Lockout banner if user.lockedUntil]    │  ← conditional
│ [MFA required banner if tenant policy]  │  ← conditional
├─────────────────────────────────────────┤
│ Card 1: Two-Factor Authentication       │
│   - Status badge (from useMe)           │
│   - If !enabled: Setup flow (QR/verify) │
│   - If enabled:                         │
│     - Disable button (hidden if policy) │
│     - Regenerate recovery codes button  │
├─────────────────────────────────────────┤
│ Card 2: Change Password                 │  ← hidden if authProvider=oidc
│   - Current/New/Confirm inputs          │
│   - Live policy checklist (T2.3)        │
│   - Submit disabled until all pass      │
├─────────────────────────────────────────┤
│ Card 3: Active Sessions                 │  ← new (T2.1)
│   - Table: Device / IP / Last activity  │
│   - Per-row Revoke (disabled on current)│
│   - "Sign out all other devices" button │
│   - Session timeout info (read-only)    │
└─────────────────────────────────────────┘
```

**Edge-case handlers:**

1. **Lockout state** (`user.lockedUntil > now`):
   - Show banner "Account locked until {time}. Use forgot-password to regain access."
   - Disable all action buttons
   - Still show cards (read-only)

2. **MFA policy = required_all OR user role in MfaRequiredRoles:**
   - Info banner: "Your organization requires MFA."
   - If user has not enrolled: banner variant "Please enable MFA below" (amber)
   - If enabled: hide the "Disable MFA" button entirely (backend will also 403, but UI should not offer the action)

3. **OIDC users** (`authProvider === 'oidc'`):
   - Show "Federated Identity (OIDC)" badge in page header
   - Hide "Change Password" card entirely
   - Optionally show informational note: "Your password is managed by your identity provider."

4. **Password policy display:**
   - Live checklist under new-password input
   - Each check evaluates in real time (`watch('newPassword')`)
   - Submit disabled until all pass
   - Fallback to hardcoded values if `usePasswordPolicy` errors

5. **Sessions current highlight:**
   - The current session (detected by `IsCurrentSession` from backend) shows a green badge "This session"
   - Its "Revoke" button is disabled with a hint — "Use Logout to end this session"

**Recovery codes regeneration:**

- Button appears only when `mfaEnabled === true`
- Click opens a confirm dialog: "This will invalidate your existing recovery codes. Enter your password to confirm."
- On success, shows the 10 new codes in a modal with Copy + Download buttons (same component as initial setup)

**Delete confirmations:**

- "Sign out all other devices": 3-second delay confirmation (following codebase pattern)
- "Revoke session" (individual): instant confirmation (minor impact)
- "Disable MFA": password-gated dialog (existing pattern)
- "Regenerate recovery codes": password-gated dialog

## E2E testing

### Updates to existing tests

**`security.spec.ts`** — existing 6 tests need updates:

- Change setup to pre-configure MFA state via new `apiHelper.setupTestUserWithMfa()` helper
- Assert initial badge reflects real state from `/users/me`

### New E2E tests

**`security.spec.ts`** — 4 new tests:

- `should show MFA enabled when user has MFA configured`
- `should block MFA disable when tenant policy requires MFA` (uses tenant with policy)
- `should regenerate recovery codes and show new codes`
- `should display password policy checklist with live validation`

**`sessions.spec.ts`** (new file) — 2 tests:

- `should list active sessions for current user`
- `should revoke other sessions and preserve current session`

**`login.spec.ts`** — 1 new test (T0.4):

- `should accept recovery code instead of TOTP during MFA verify`

**Total new E2E:** 7 tests + 6 updated = 13 tests touching security/MFA.

### `ApiHelper` extensions

- `setupTestUserWithMfa(email): Promise<{recoveryCodes: string[]}>` — enable MFA via API, return codes for recovery code login test
- `setTenantMfaPolicy(tenantId, policy): Promise<void>` — set `MfaPolicy="required_all"` for policy-enforcement tests
- `getUserSessions(userId): Promise<ActiveSession[]>` — via admin endpoint, verify sessions state
- `getPasswordPolicy(): Promise<PasswordPolicyDto>` — for hook behavior verification

## Task breakdown

18 tasks. See execution order in Architecture Overview.

| #   | Task                                                   | Tier  | Primary file(s)                                   | Tests  |
| --- | ------------------------------------------------------ | ----- | ------------------------------------------------- | ------ |
| 1   | **T0.2** Extend `BlockedImpersonationPaths` middleware | T0    | `TenantResolutionMiddleware.cs`                   | 7      |
| 2   | **T0.1** Rename `MfaChallengeResponse` fields          | T0    | `AuthEndpoints.cs`, `ApiJsonContext.cs`           | 1      |
| 3   | **T0.5** `MfaDisable`/`MfaConfirm` policy enforcement  | T0    | `AuthEndpoints.cs`                                | 3      |
| 4   | **T0.3** `mfa-verify.tsx` error handling               | T0    | `mfa-verify.tsx`                                  | —      |
| 5   | **T0.4** E2E recovery code login test                  | T0    | `login.spec.ts`, `api-helper.ts`                  | +1 E2E |
| 6   | **T2.1a** 3 user-scoped sessions endpoints             | T2-be | `AuthEndpoints.cs`                                | 5      |
| 7   | **T2.2a** Recovery codes regenerate endpoint           | T2-be | `AuthEndpoints.cs`                                | 2      |
| 8   | **T2.3a** Password policy GET endpoint                 | T2-be | `AuthEndpoints.cs`, `ApiJsonContext.cs`           | 2      |
| 9   | **T2.4a** Security notification types + emits          | T2-be | `NotificationTypeRegistry.cs`, `AuthEndpoints.cs` | 3      |
| 10  | **T1.1** `useMe` hook + typed `Me` interface           | T1    | `use-me.ts`                                       | 3      |
| 11  | **T1.2** Refactor to mutations in `use-auth-admin.ts`  | T1    | `use-auth-admin.ts`                               | 5      |
| 12  | **T1.3** i18n completion (17+ keys × 3 locales)        | T1    | `admin.json`, `common.json` ×3                    | —      |
| 13  | **T1.4** User-menu "Security" link                     | T1    | `user-menu.tsx`                                   | —      |
| 14  | **T1.5** `reset-password-page.tsx` live checklist      | T1    | `reset-password-page.tsx`                         | —      |
| 15  | **T2.5** Rewrite `security-page.tsx`                   | T2-fe | `security-page.tsx`                               | —      |
| 16  | Update `security.spec.ts` + 4 new tests                | E2E   | `security.spec.ts`, `api-helper.ts`               | +4 E2E |
| 17  | Add `sessions.spec.ts` (2 tests)                       | E2E   | `sessions.spec.ts`                                | +2 E2E |
| 18  | Final verification (build/test/lint/manual)            | —     | —                                                 | —      |

**Totals:**

- Platform backend tests: **+23** (1627 → ~1650)
- Platform.Web unit tests: **+8** (36 → ~44)
- Platform.Web E2E tests: **+7 new + 6 updated** (253 → ~260, 13 spec files touched)

## Manual verification checklist (post-implementation)

- [ ] Login with user with MFA → enter code → dashboard loads
- [ ] Login with user with MFA → use recovery code → dashboard loads
- [ ] Login with user without MFA → dashboard loads directly
- [ ] Login with user with expired challenge token → clear error message + return to login
- [ ] Login with user getting rate-limited → clear 429 message
- [ ] Open user-menu → see "Security" entry → click → page loads
- [ ] Enable MFA → scan QR → verify → see recovery codes → badge changes to "Enabled"
- [ ] Regenerate recovery codes → enter password → see 10 new codes → old codes invalidated
- [ ] Disable MFA with password → badge changes to "Disabled"
- [ ] With tenant `MfaPolicy=required_all`, Disable button is hidden + banner visible
- [ ] With OIDC user, Change Password card hidden + OIDC badge visible
- [ ] With locked account, banner visible + all actions disabled
- [ ] Change password → live checklist → submit → success
- [ ] Change password with missing requirement → submit disabled
- [ ] Open sessions card → see at least 1 session (current) → current highlighted → revoke disabled
- [ ] Open second browser → second session appears → revoke the other → second browser forced to login
- [ ] "Sign out all other devices" → 3s confirm → only current session remains
- [ ] Impersonate user → navigate security page → MFA actions return 403 or are blocked by middleware
- [ ] Receive notification in bell when MFA enabled/disabled/password changed (Sub A integration)

## Risks and mitigations

| Risk                                                                              | Likelihood | Impact | Mitigation                                                                      |
| --------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------- |
| Rewrite of security-page introduces regression in existing recovery-codes display | Medium     | High   | Comprehensive E2E updates before merge; side-by-side visual diff during rewrite |
| Backend `MfaChallengeResponse` rename breaks existing test fixtures               | Low        | Medium | Grep for `MfaRequired`/`ChallengeToken` before merge; update any callers        |
| Notification emit loops if Notification Center consumer triggers re-emit          | Low        | Medium | `CreateAsync` has 5-min dedup window; tests should verify dedup behavior        |
| `TenantAuthConfig.MfaPolicy` values inconsistent across tests                     | Medium     | Low    | Add fixture builder for `TenantAuthConfig` with common policy presets           |
| `AuthProvider` field missing from `User` entity (if assumption wrong)             | Low        | High   | Task 1 of plan verifies actual User entity shape before writing `useMe` type    |
| OIDC users with local MFA fallback (hybrid auth) lose access                      | Very low   | High   | Audit found no hybrid support; explicit non-goal in this spec                   |

## Open questions (answer in plan)

1. **`AuthProvider` field naming:** verify actual property name in `User` entity — may be `AuthProvider`, `IdentityProvider`, or inferred from `OidcSubject != null`. Plan task 1 confirms.
2. **`PasswordRequireLowercase`:** does the field exist in `TenantAuthConfig`? If not, add it with default `true` or compute implicitly. Plan task 8 decides.
3. **`RecoveryCodesRegenerated` auth event type:** does it already exist in `AuthEventTypes`? If not, add it.
4. **`"self"` role routing in notifications:** does the registry already support "self" sentinel for recipient? If not, the simpler path is to include `admin`/`system_admin` and let propagation cover the actor indirectly.
5. **Session `LastActivityAt`:** does the backend track this? If only `CreatedAt`/`ExpiresAt` are available, the "Last activity" column shows `CreatedAt` as fallback.
6. **`usePasswordPolicy` cache TTL:** spec says `staleTime: Infinity`. Confirm that logout + login cycle invalidates the cache (QueryClient reset or unmount).

## Definition of Done

- [ ] All 18 tasks complete with approved reviews
- [ ] Platform backend build passes, 0 warnings, 0 test failures, +22 new tests passing
- [ ] Platform.Web build passes, 0 TS errors, +8 unit tests passing, +7/6 E2E tests passing (where demo env available)
- [ ] Manual verification checklist completed (sections that don't require specific tenant setup)
- [ ] No regressions in existing security/login flows
- [ ] Backend version bumped to v1.5.1 in `Directory.Build.props`
- [ ] Frontend version NOT bumped yet (stays at 1.5.0 until all v1.6.0 sub-projects complete)
- [ ] Commits pushed to both repos' `main` branches
- [ ] Memory updated: mark Sub C complete in `project_v160_production_polish.md`, update `MEMORY.md` Current Position
- [ ] No pending TODO comments referencing this sub-project

## References

- Parent: `memory/project_v160_production_polish.md`
- Predecessor: Sub A Notification Center (Plan 34, complete)
- Cross-reference: `memory/project_agent_assist_deferred.md` (explains why Sub B was aborted)
- Related backend: Sprint 1 (sessions, password policies), Sprint 4 (notifications, TenantAuthConfig extension), Sprint 5 (impersonation read-only)
- Related frontend: Sub A (Notification Center SSE consumer)
- Convention source: `CLAUDE.md` (both repos)
