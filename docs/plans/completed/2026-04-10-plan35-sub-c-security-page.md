# Plan 35: v1.6.0 Sub C — Security Page Polish + Critical Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the `security-page.tsx:30` TODO plus 2 P0 bugs (broken MFA login, impersonation privilege escalation), 1 security-policy bypass (MfaDisable ignores tenant MfaPolicy), and 3 adjacent gaps with shipped backends (sessions management, recovery codes regeneration, password policy display). Also integrate with the Notification Center (Sub A, shipped) for security events.

**Architecture:** Dual-repo change. Backend (`Asterisk.Platform`) gains 4 new auth endpoints, extends impersonation middleware, adds tenant policy enforcement in MfaDisable, and emits 3 new security notification types. Frontend (`Asterisk.Platform.Web`) adds `useMe` hook, refactors `security-page.tsx` direct `customFetch` calls to TanStack mutations, rewrites the page with 3 cards (MFA / password / sessions) + 5 edge-case handlers (OIDC detection, lockout banner, MFA required banner, live policy checklist, current session highlight), closes i18n debt, and adds user-menu discoverability.

**Tech Stack:** .NET 10 Native AOT, Minimal APIs, Dapper + Postgres, xunit + NSubstitute + FluentAssertions (backend); React 19, TanStack Query 5, Zustand 5, base-ui, Vitest, Playwright (frontend); i18next locale JSON.

**Related files:**
- Spec: `docs/superpowers/specs/2026-04-10-v160-sub-c-security-page-design.md`
- Parent memory: `memory/project_v160_production_polish.md`
- Predecessor: Plan 34 (Sub A Notification Center — complete)

**Versioning:**
- Backend `Asterisk.Platform`: v1.5.0 → v1.5.1 (bumped in task 18)
- Frontend `Asterisk.Platform.Web`: stays 1.5.0 (will bump to 1.6.0 after all v1.6.0 sub-projects complete)

**Repos and working directories:**
- Backend: `/media/Data/Source/IPcom/Asterisk.Platform`
- Frontend: `/media/Data/Source/IPcom/Asterisk.Platform.Web`

**Execution conventions (from CLAUDE.md):**
- Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`)
- No `Co-Authored-By` trailer
- Merge direct to `main` in both repos (no feature branch)
- Test naming: `Method_ShouldExpected_WhenCondition`
- Backend: AOT-first, no reflection, `[JsonSerializable]` for new DTOs
- Frontend: TanStack Query hooks for all network I/O, base-ui `render` prop (not Radix `asChild`)

---

## Task Dependency Graph

```
  [1] T0.2 middleware
        │
        ▼
  [2] T0.1 MfaChallengeResponse rename
        │
        ▼
  [3] T0.5 MfaDisable policy enforcement
        │
        ▼
  [4] T0.3 mfa-verify error handling ─── [5] T0.4 recovery E2E test
        │                                      │
        ▼                                      │
  [6] T2.1a sessions endpoints                 │
        │                                      │
        ▼                                      │
  [7] T2.2a recovery regen endpoint            │
        │                                      │
        ▼                                      │
  [8] T2.3a password policy endpoint           │
        │                                      │
        ▼                                      │
  [9] T2.4a notification emits                 │
        │                                      │
        ▼                                      │
  [10] T1.1 useMe hook ◄───────────────────────┘
        │
        ▼
  [11] T1.2 auth-admin mutations ─── [12] T1.3 i18n ─── [13] T1.4 user-menu link
        │                                                      │
        ▼                                                      │
  [14] T1.5 reset-password checklist                           │
        │                                                      │
        ▼                                                      │
  [15] T2.5 security-page rewrite ◄──────────────────────────┘
        │
        ▼
  [16] E2E security.spec.ts updates
        │
        ▼
  [17] E2E sessions.spec.ts new
        │
        ▼
  [18] Final verification + version bump
```

Parallelism: Tasks 12, 13 (i18n + user-menu link) can run in parallel with task 11. Everything else is sequential.

---

## Task 1: T0.2 — Extend impersonation middleware with security-critical auth paths

**Files:**
- Modify: `src/Asterisk.Platform.Api/Middleware/TenantResolutionMiddleware.cs`
- Modify: `tests/Asterisk.Platform.Api.Tests/Middleware/TenantResolutionMiddlewareTests.cs` (create if absent)

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform`

- [ ] **Step 1: Locate the existing test file for the middleware**

```bash
find tests -name "TenantResolutionMiddleware*Tests*" 2>/dev/null
```

Expected: one file path, or none (create in next step).

- [ ] **Step 2: Write 7 failing tests for the new blocked paths**

If the test file exists, add these tests. Otherwise create `tests/Asterisk.Platform.Api.Tests/Middleware/TenantResolutionMiddlewareTests.cs` with the necessary setup:

```csharp
using System.Net;
using System.Security.Claims;
using Asterisk.Platform.Api.Middleware;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace Asterisk.Platform.Api.Tests.Middleware;

public class TenantResolutionMiddlewareImpersonationTests
{
    private static HttpContext BuildContextWithImpersonation(string method, string path, bool readOnly = false)
    {
        var ctx = new DefaultHttpContext();
        ctx.Request.Method = method;
        ctx.Request.Path = path;
        ctx.Request.Host = new HostString("localhost");

        var claims = new List<Claim>
        {
            new("impersonation", "true"),
            new("tid", "tenant1"),
            new("sub", "user1"),
        };
        if (readOnly)
            claims.Add(new Claim("readonly", "true"));

        var identity = new ClaimsIdentity(claims, "TestScheme");
        ctx.User = new ClaimsPrincipal(identity);
        ctx.Response.Body = new MemoryStream();
        return ctx;
    }

    private static async Task<int> RunMiddlewareAsync(HttpContext ctx)
    {
        var called = false;
        var middleware = new TenantResolutionMiddleware(_ =>
        {
            called = true;
            return Task.CompletedTask;
        });
        await middleware.InvokeAsync(ctx);
        return called ? 0 : ctx.Response.StatusCode;
    }

    [Fact]
    public async Task ImpersonationMiddleware_ShouldBlock_MfaSetup_WhenImpersonating()
    {
        var ctx = BuildContextWithImpersonation("POST", "/api/v1/auth/mfa/setup");
        var status = await RunMiddlewareAsync(ctx);
        status.Should().Be(403);
    }

    [Fact]
    public async Task ImpersonationMiddleware_ShouldBlock_MfaConfirm_WhenImpersonating()
    {
        var ctx = BuildContextWithImpersonation("POST", "/api/v1/auth/mfa/confirm");
        var status = await RunMiddlewareAsync(ctx);
        status.Should().Be(403);
    }

    [Fact]
    public async Task ImpersonationMiddleware_ShouldBlock_MfaDisable_WhenImpersonating()
    {
        var ctx = BuildContextWithImpersonation("DELETE", "/api/v1/auth/mfa");
        var status = await RunMiddlewareAsync(ctx);
        status.Should().Be(403);
    }

    [Fact]
    public async Task ImpersonationMiddleware_ShouldBlock_RecoveryCodesRegenerate_WhenImpersonating()
    {
        var ctx = BuildContextWithImpersonation("POST", "/api/v1/auth/mfa/recovery-codes/regenerate");
        var status = await RunMiddlewareAsync(ctx);
        status.Should().Be(403);
    }

    [Fact]
    public async Task ImpersonationMiddleware_ShouldBlock_ChangePassword_WhenImpersonating()
    {
        var ctx = BuildContextWithImpersonation("POST", "/api/v1/auth/change-password");
        var status = await RunMiddlewareAsync(ctx);
        status.Should().Be(403);
    }

    [Fact]
    public async Task ImpersonationMiddleware_ShouldBlock_RevokeOtherSessions_WhenImpersonating()
    {
        var ctx = BuildContextWithImpersonation("POST", "/api/v1/auth/sessions/revoke-others");
        var status = await RunMiddlewareAsync(ctx);
        status.Should().Be(403);
    }

    [Fact]
    public async Task ImpersonationMiddleware_ShouldBlock_RevokeSession_WhenImpersonating()
    {
        var ctx = BuildContextWithImpersonation("DELETE", "/api/v1/auth/sessions/token-123");
        var status = await RunMiddlewareAsync(ctx);
        status.Should().Be(403);
    }
}
```

- [ ] **Step 3: Run the new tests and verify they FAIL**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "FullyQualifiedName~TenantResolutionMiddlewareImpersonationTests" -v q
```

Expected: 7 FAIL (middleware currently allows these paths through).

- [ ] **Step 4: Extend `BlockedImpersonationPaths` HashSet + add DELETE handling**

In `src/Asterisk.Platform.Api/Middleware/TenantResolutionMiddleware.cs`, update the HashSet (lines 14-20):

```csharp
private static readonly HashSet<string> BlockedImpersonationPaths = new(StringComparer.OrdinalIgnoreCase)
{
    "/api/management/impersonate",
    "/api/setup",
    "/api/v1/management/impersonate",
    "/api/v1/setup",
    // Security-critical auth operations (Sub C T0.2)
    "/api/v1/auth/mfa/setup",
    "/api/v1/auth/mfa/confirm",
    "/api/v1/auth/mfa/recovery-codes/regenerate",
    "/api/v1/auth/change-password",
    "/api/v1/auth/sessions/revoke-others",
};
```

Then update `IsBlockedDuringImpersonation` (starting around line 113) to add handling for DELETE on auth paths:

```csharp
private static bool IsBlockedDuringImpersonation(HttpContext context)
{
    var path = context.Request.Path.Value ?? "";
    var method = context.Request.Method;

    // POST to any path in the static blocked list
    if (string.Equals(method, "POST", StringComparison.OrdinalIgnoreCase)
        && BlockedImpersonationPaths.Contains(path))
    {
        return true;
    }

    // DELETE /api/v1/management/tenants/*
    if (string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase)
        && (path.StartsWith("/api/management/tenants/", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/management/tenants/", StringComparison.OrdinalIgnoreCase)))
    {
        return true;
    }

    // PUT /api/v1/management/system/*
    if (string.Equals(method, "PUT", StringComparison.OrdinalIgnoreCase)
        && (path.StartsWith("/api/management/system/", StringComparison.OrdinalIgnoreCase)
            || path.StartsWith("/api/v1/management/system/", StringComparison.OrdinalIgnoreCase)))
    {
        return true;
    }

    // Sub C T0.2: DELETE security-critical auth paths
    // DELETE /api/v1/auth/mfa (disable MFA)
    if (string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase)
        && path.Equals("/api/v1/auth/mfa", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    // DELETE /api/v1/auth/sessions/{tokenId}
    if (string.Equals(method, "DELETE", StringComparison.OrdinalIgnoreCase)
        && path.StartsWith("/api/v1/auth/sessions/", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    return false;
}
```

- [ ] **Step 5: Run the tests and verify they PASS**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "FullyQualifiedName~TenantResolutionMiddlewareImpersonationTests" -v q
```

Expected: 7 PASS.

- [ ] **Step 6: Run the full middleware test suite to ensure no regression**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "FullyQualifiedName~TenantResolutionMiddleware" -v q
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform
git add src/Asterisk.Platform.Api/Middleware/TenantResolutionMiddleware.cs tests/Asterisk.Platform.Api.Tests/Middleware/TenantResolutionMiddlewareImpersonationTests.cs
git commit -m "fix(auth): block security-critical operations during impersonation

Extends BlockedImpersonationPaths with auth endpoints that could otherwise
allow an impersonator to reset MFA or change the victim's password:
- POST /auth/mfa/{setup,confirm,recovery-codes/regenerate}
- POST /auth/change-password
- POST /auth/sessions/revoke-others
- DELETE /auth/mfa
- DELETE /auth/sessions/{tokenId}

Sub C T0.2 — closes a privilege escalation vulnerability discovered during
security-page audit. Applies to both full and read-only impersonation modes."
```

---

## Task 2: T0.1 — Fix MfaChallengeResponse field name mismatch

**Files:**
- Modify: `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs:703`
- Modify: `src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs` (if `MfaChallengeResponse` is registered)

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform`

- [ ] **Step 1: Verify current state of the record**

```bash
grep -n "MfaChallengeResponse" src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs
```

Expected: shows `record MfaChallengeResponse(bool MfaRequired, string ChallengeToken)` at line ~703 and its usage at line ~110.

- [ ] **Step 2: Write a failing test asserting JSON camelCase shape**

Add to `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs` (create nested class if needed):

```csharp
[Fact]
public void MfaChallengeResponse_ShouldSerializeWithFrontendFieldNames_WhenSerialized()
{
    var response = new MfaChallengeResponse(true, "abc123");
    var json = JsonSerializer.Serialize(response, ApiJsonContext.Default.MfaChallengeResponse);
    json.Should().Contain("\"requiresMfa\":true");
    json.Should().Contain("\"mfaToken\":\"abc123\"");
}
```

Note: `MfaChallengeResponse` is `internal` — if the test project does not have `InternalsVisibleTo`, move the test into `Asterisk.Platform.Api.Tests` and add `[assembly: InternalsVisibleTo("Asterisk.Platform.Api.Tests")]` to `Asterisk.Platform.Api.csproj` (usually already present).

- [ ] **Step 3: Run the test and verify it FAILS**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "MfaChallengeResponse_ShouldSerializeWithFrontendFieldNames" -v q
```

Expected: FAIL — current JSON has `mfaRequired` and `challengeToken`.

- [ ] **Step 4: Rename the record properties**

In `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs`, change line ~703:

```csharp
internal sealed record MfaChallengeResponse(bool RequiresMfa, string MfaToken);
```

Also update the single call site at line ~110:

```csharp
return Results.Ok(new MfaChallengeResponse(true, challengeToken));
```

`challengeToken` is still the local variable name — that is fine because only the record property name matters for serialization.

- [ ] **Step 5: Run the test and verify it PASSES**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "MfaChallengeResponse_ShouldSerializeWithFrontendFieldNames" -v q
```

Expected: PASS.

- [ ] **Step 6: Run all AuthEndpoints tests to catch regressions**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "FullyQualifiedName~AuthEndpointsTests" -v q
```

Expected: all pass. Any test referencing `MfaRequired` or `ChallengeToken` as property names must be updated to the new names.

- [ ] **Step 7: Commit**

```bash
git add src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs
git commit -m "fix(auth): rename MfaChallengeResponse to match frontend contract

Backend was shipping {mfaRequired, challengeToken} but frontend login-page.tsx
expects {requiresMfa, mfaToken}. Users with MFA enabled could not log in
because the frontend branch never matched.

Sub C T0.1 — regression fix. Field name change only; no behavior change."
```

---

## Task 3: T0.5 — MfaDisable/MfaConfirm tenant policy enforcement

**Files:**
- Modify: `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs` (MfaDisable handler ~line 499)
- Modify: `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform`

- [ ] **Step 1: Inspect the current MfaDisable handler**

```bash
grep -n "MfaDisable\|DeleteMfa\|MapDelete.*mfa" src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs | head -5
```

Read lines 499-527 (or wherever `MfaDisable` is defined). Confirm: it takes `[FromServices] IUserStore`, verifies password, clears MFA fields. It does NOT read `TenantAuthConfig`.

- [ ] **Step 2: Write 3 failing tests**

Add to `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`:

```csharp
[Fact]
public async Task MfaDisable_ShouldReturn403_WhenTenantPolicyRequiresMfaAll()
{
    var userStore = Substitute.For<IUserStore>();
    var tenantAuthConfigStore = Substitute.For<ITenantAuthConfigStore>();
    // ... build a User with MfaEnabled=true, role=Agent
    var user = BuildUser(mfaEnabled: true, role: UserRole.Agent);
    userStore.GetByIdAsync(Arg.Any<TenantId>(), Arg.Any<EntityId>(), Arg.Any<CancellationToken>())
        .Returns(user);

    var authConfig = new TenantAuthConfig
    {
        TenantId = "tenant1",
        MfaPolicy = "required_all",
    };
    tenantAuthConfigStore.GetAsync(Arg.Any<TenantId>(), Arg.Any<CancellationToken>())
        .Returns(authConfig);

    var request = new MfaDisableRequest("CurrentPassword123!");
    var result = await AuthEndpoints.MfaDisable(
        request, BuildHttpContext(), userStore, tenantAuthConfigStore,
        BuildPasswordService(), BuildAuthEventStore(), CancellationToken.None);

    result.Should().BeOfType<ForbidHttpResult>();
}

[Fact]
public async Task MfaDisable_ShouldReturn403_WhenUserRoleIsInMfaRequiredRoles()
{
    var userStore = Substitute.For<IUserStore>();
    var tenantAuthConfigStore = Substitute.For<ITenantAuthConfigStore>();
    var user = BuildUser(mfaEnabled: true, role: UserRole.Admin);
    userStore.GetByIdAsync(Arg.Any<TenantId>(), Arg.Any<EntityId>(), Arg.Any<CancellationToken>())
        .Returns(user);

    var authConfig = new TenantAuthConfig
    {
        TenantId = "tenant1",
        MfaPolicy = "required_for_roles",
        MfaRequiredRoles = new[] { "Admin", "Supervisor" },
    };
    tenantAuthConfigStore.GetAsync(Arg.Any<TenantId>(), Arg.Any<CancellationToken>())
        .Returns(authConfig);

    var request = new MfaDisableRequest("CurrentPassword123!");
    var result = await AuthEndpoints.MfaDisable(
        request, BuildHttpContext(), userStore, tenantAuthConfigStore,
        BuildPasswordService(), BuildAuthEventStore(), CancellationToken.None);

    result.Should().BeOfType<ForbidHttpResult>();
}

[Fact]
public async Task MfaDisable_ShouldSucceed_WhenTenantPolicyIsOptional()
{
    var userStore = Substitute.For<IUserStore>();
    var tenantAuthConfigStore = Substitute.For<ITenantAuthConfigStore>();
    var passwordService = BuildPasswordService(verifyResult: true);
    var user = BuildUser(mfaEnabled: true, role: UserRole.Agent);
    userStore.GetByIdAsync(Arg.Any<TenantId>(), Arg.Any<EntityId>(), Arg.Any<CancellationToken>())
        .Returns(user);

    var authConfig = new TenantAuthConfig
    {
        TenantId = "tenant1",
        MfaPolicy = "optional",
    };
    tenantAuthConfigStore.GetAsync(Arg.Any<TenantId>(), Arg.Any<CancellationToken>())
        .Returns(authConfig);

    var request = new MfaDisableRequest("CurrentPassword123!");
    var result = await AuthEndpoints.MfaDisable(
        request, BuildHttpContext(), userStore, tenantAuthConfigStore,
        passwordService, BuildAuthEventStore(), CancellationToken.None);

    result.Should().BeOfType<Ok>();
    user.MfaEnabled.Should().BeFalse();
}
```

Note: helper builders (`BuildUser`, `BuildHttpContext`, `BuildPasswordService`, `BuildAuthEventStore`) should already exist in the test file; if not, copy the pattern from nearby existing tests.

- [ ] **Step 3: Run the tests and verify they FAIL**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "MfaDisable_Should" -v q
```

Expected: 3 FAIL (policy check doesn't exist yet).

- [ ] **Step 4: Add policy enforcement to `MfaDisable` handler**

Modify the `MfaDisable` handler signature to accept `ITenantAuthConfigStore`:

```csharp
private static async Task<IResult> MfaDisable(
    MfaDisableRequest request,
    HttpContext context,
    [FromServices] IUserStore userStore,
    [FromServices] ITenantAuthConfigStore tenantAuthConfigStore,
    [FromServices] PasswordService passwordService,
    [FromServices] IAuthEventStore authEvents,
    CancellationToken ct)
{
    var claims = GetAuthClaims(context);
    var user = await userStore.GetByIdAsync(claims.TenantId, claims.UserId, ct);
    if (user is null)
        return Results.Unauthorized();

    // Sub C T0.5: enforce tenant MFA policy
    var authConfig = await tenantAuthConfigStore.GetAsync(claims.TenantId, ct);
    if (authConfig is not null && authConfig.IsMfaRequiredForRole(user.Role.ToString()))
    {
        return Results.Json(
            new ErrorResponse("MFA is required by your organization and cannot be disabled."),
            ApiJsonContext.Default.ErrorResponse,
            statusCode: 403);
    }

    if (!passwordService.VerifyPassword(request.Password, user.PasswordHash ?? ""))
        return Results.Unauthorized();

    user.MfaEnabled = false;
    user.MfaSecret = null;
    user.MfaRecoveryCodes = null;
    user.MfaConfirmedAt = null;
    user.UpdatedAt = DateTimeOffset.UtcNow;
    await userStore.UpdateAsync(user, ct);

    await authEvents.LogAsync(new AuthEvent
    {
        EventId = Guid.NewGuid().ToString(),
        TenantId = claims.TenantId.Value,
        UserId = claims.UserId.Value,
        EventType = AuthEventTypes.MfaDisable,
        CreatedAt = DateTimeOffset.UtcNow,
    }, ct);

    return Results.Ok();
}
```

**Important:** The `User.Role` property is of type `UserRole` (enum), but `TenantAuthConfig.MfaRequiredRoles` is `IReadOnlyList<string>`. The comparison in `IsMfaRequiredForRole` uses `StringComparer.OrdinalIgnoreCase`, so passing `user.Role.ToString()` produces e.g. `"Agent"`, matching the registry convention.

- [ ] **Step 5: Run the 3 tests and verify they PASS**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "MfaDisable_Should" -v q
```

Expected: 3 PASS.

- [ ] **Step 6: Run the full AuthEndpoints test suite**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "FullyQualifiedName~AuthEndpointsTests" -v q
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs
git commit -m "fix(auth): enforce tenant MFA policy in MfaDisable handler

MfaDisable previously accepted any authenticated user with a valid password
and cleared the MFA fields, regardless of tenant policy. A user with role X
in a tenant with MfaPolicy=required_all or MfaRequiredRoles containing X
could bypass the policy via direct API call.

Handler now injects ITenantAuthConfigStore, reads the policy, and returns
403 with a user-friendly error message if the disable is not allowed.

Sub C T0.5 — security policy bypass fix, equivalent in severity to Sprint 0
multi-tenant security fixes."
```

---

## Task 4: T0.3 — mfa-verify.tsx 429 + expired token error handling

**Files:**
- Modify: `src/core/auth/mfa-verify.tsx`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Read current mfa-verify.tsx lines 20-80**

```bash
sed -n '20,80p' src/core/auth/mfa-verify.tsx
```

Locate the verify function (around line 39-50). It currently shows `t('auth.mfa_invalid_code', 'Invalid verification code')` on any error.

- [ ] **Step 2: Update the catch block to distinguish error types**

Find the `handleVerify` (or equivalent) function and update the catch block:

```tsx
try {
  // ... existing fetch call to /api/v1/auth/mfa/verify
} catch (err) {
  // Sub C T0.3: distinguish error types
  if (err instanceof Error && err.message.includes('429')) {
    setError(t('auth.mfa_rate_limited', 'Too many attempts. Please wait a few minutes and try again.'));
  } else if (err instanceof Error && err.message.includes('CHALLENGE_EXPIRED')) {
    setError(t('auth.mfa_challenge_expired', 'Your session expired. Please log in again.'));
    // After 3 seconds, redirect to login
    setTimeout(() => {
      useAuthStore.getState().clearMfaPending();
      navigate('/login');
    }, 3000);
  } else {
    setError(t('auth.mfa_invalid_code', 'Invalid verification code'));
  }
}
```

Note: the exact shape of `err` depends on `customFetch` in `src/core/api/client.ts`. Read that file first if the error shape is unclear. If `customFetch` throws `Error` objects with a `status` property, use `err.status === 429` instead of `err.message.includes('429')`.

- [ ] **Step 3: Verify `customFetch` error shape**

```bash
grep -n "throw.*new Error\|throw.*Error\|status:" src/core/api/client.ts
```

If you find `throw new Error(...)` with status codes embedded differently, adjust the check accordingly. Common pattern:

```tsx
} catch (err) {
  const status = (err as { status?: number })?.status;
  if (status === 429) { ... }
  else if (status === 400) { ... } // CHALLENGE_EXPIRED likely comes as 400
}
```

- [ ] **Step 4: Add the i18n strings to `public/locales/en-US/common.json` (and es-419, pt-BR)**

Add under the `auth` subtree (create if absent). Exact strings for en-US:

```json
"mfa_rate_limited": "Too many attempts. Please wait a few minutes and try again.",
"mfa_challenge_expired": "Your session expired. Please log in again."
```

Spanish (es-419):
```json
"mfa_rate_limited": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
"mfa_challenge_expired": "Tu sesión expiró. Por favor, inicia sesión de nuevo."
```

Portuguese (pt-BR):
```json
"mfa_rate_limited": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
"mfa_challenge_expired": "Sua sessão expirou. Por favor, faça login novamente."
```

- [ ] **Step 5: Typecheck**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform.Web
npm run build 2>&1 | tail -8
```

Expected: 0 TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/auth/mfa-verify.tsx public/locales/en-US/common.json public/locales/es-419/common.json public/locales/pt-BR/common.json
git commit -m "fix(auth): distinguish rate-limit and expired-token errors in MFA verify

Previously, any 4xx response from /auth/mfa/verify showed the generic
'Invalid verification code' message. Users who hit rate limits or whose
5-minute challenge token expired would see the same confusing error.

Now distinguishes 429 (rate limit) and challenge expiry, with a 3-second
auto-redirect to /login on expiry.

Sub C T0.3 — UX polish for MFA login flow."
```

---

## Task 5: T0.4 — E2E recovery code login path test

**Files:**
- Modify: `tests/e2e/tests/platform-admin/login.spec.ts`
- Modify: `tests/e2e/fixtures/api-helper.ts` (add `setupTestUserWithMfa` method)

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Read the existing login.spec.ts structure**

```bash
head -60 tests/e2e/tests/platform-admin/login.spec.ts
```

Identify the `test.describe` block, the fixture usage, and the naming convention for tests.

- [ ] **Step 2: Add `setupTestUserWithMfa` helper to api-helper.ts**

In `tests/e2e/fixtures/api-helper.ts`, add a method inside the `ApiHelper` class:

```ts
async setupTestUserWithMfa(email: string, password: string): Promise<{ recoveryCodes: string[] }> {
  // Create a user with known credentials
  await this.createUser({ email, password, displayName: email, role: 'Agent' });

  // Log in to get a JWT for the next step
  const loginRes = await this.request.post('/api/v1/auth/login', {
    data: { email, password, tenantId: this.tenantId },
  });
  const { accessToken } = await loginRes.json();

  // Set up MFA
  const setupRes = await this.request.post('/api/v1/auth/mfa/setup', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const { secret, recoveryCodes } = await setupRes.json();

  // Generate a valid TOTP code from the secret using a test library
  // The simplest approach: call a backend test-only endpoint that accepts
  // the secret and returns a current code. If that does not exist, use
  // an OTP library available in the test harness. For this plan, assume
  // the helper has access to a `generateTotpCode(secret)` utility.
  const code = generateTotpCode(secret);

  await this.request.post('/api/v1/auth/mfa/confirm', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { code },
  });

  return { recoveryCodes };
}
```

**Note:** `generateTotpCode` may not exist in the fixture. Check if `otplib` is installed (`grep otplib package.json`). If yes, import and use:

```ts
import { authenticator } from 'otplib';
const code = authenticator.generate(secret);
```

If `otplib` is NOT installed, add it to `devDependencies`:

```bash
npm install --save-dev otplib
```

- [ ] **Step 3: Add the failing E2E test**

Append to `tests/e2e/tests/platform-admin/login.spec.ts`:

```ts
test('should accept recovery code instead of TOTP during MFA verify', async ({ page, apiHelper }) => {
  const email = `mfa-recovery-${Date.now()}@test.local`;
  const password = 'TestPassword123!';
  const { recoveryCodes } = await apiHelper.setupTestUserWithMfa(email, password);

  await page.goto('/login');
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();

  // MFA step should appear
  await expect(page.getByTestId('login-mfa-section')).toBeVisible();

  // Toggle to recovery code mode
  await page.getByTestId('login-mfa-use-recovery').click();
  await page.getByTestId('login-mfa-recovery-input').fill(recoveryCodes[0]);
  await page.getByTestId('login-mfa-submit').click();

  // Should reach the authenticated app
  await expect(page).toHaveURL(/\/admin|\/agent|\/operations/);
});
```

- [ ] **Step 4: Run the test (demo env required)**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform.Web
npx playwright test tests/e2e/tests/platform-admin/login.spec.ts --grep "recovery code"
```

If demo env is NOT running, the test will be deferred to Task 18 (final verification). Note the status in the commit message.

- [ ] **Step 5: Also add data-testids to mfa-verify.tsx if missing**

Re-read `src/core/auth/mfa-verify.tsx` and ensure these data-testids exist:
- `login-mfa-section` (wrapping div)
- `login-mfa-use-recovery` (toggle button to recovery mode)
- `login-mfa-recovery-input` (text input in recovery mode)
- `login-mfa-submit` (submit button)

Add any missing ones.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/tests/platform-admin/login.spec.ts tests/e2e/fixtures/api-helper.ts src/core/auth/mfa-verify.tsx package.json package-lock.json
git commit -m "test(auth): add E2E coverage for MFA recovery code login path

Recovery code entry during login was previously untested end-to-end. Added:
- ApiHelper.setupTestUserWithMfa() helper using otplib for valid TOTP codes
- Playwright test covering the recovery code login path
- Missing data-testids on mfa-verify.tsx for test selectors

Sub C T0.4 — closes recovery code fallback testing gap."
```

---

## Task 6: T2.1a — User-scoped sessions endpoints

**Files:**
- Modify: `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs`
- Modify: `src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs` (register new DTOs)
- Modify: `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform`

- [ ] **Step 1: Write 5 failing tests for the new endpoints**

Add to `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`:

```csharp
[Fact]
public async Task GetOwnSessions_ShouldReturnOnlyCurrentUserSessions_WhenCalled()
{
    var refreshTokenStore = Substitute.For<IRefreshTokenStore>();
    var tokens = new List<RefreshToken>
    {
        new() { TokenId = "t1", UserId = "user1", TenantId = "tenant1", TokenHash = "h1",
                CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddHours(1),
                IpAddress = "1.2.3.4", UserAgent = "Chrome" },
            new() { TokenId = "t2", UserId = "user1", TenantId = "tenant1", TokenHash = "h2",
                CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddHours(1),
                IpAddress = "5.6.7.8", UserAgent = "Firefox" },
    };
    refreshTokenStore.GetActiveByUserAsync("tenant1", "user1", Arg.Any<CancellationToken>())
        .Returns(tokens);

    var result = await AuthEndpoints.GetOwnSessions(
        BuildHttpContextWithClaims("tenant1", "user1"),
        refreshTokenStore,
        CancellationToken.None);

    result.Should().BeOfType<Ok<ActiveSessionDto[]>>();
    var dtos = ((Ok<ActiveSessionDto[]>)result).Value!;
    dtos.Should().HaveCount(2);
    dtos.Select(d => d.TokenId).Should().BeEquivalentTo(new[] { "t1", "t2" });
}

[Fact]
public async Task GetOwnSessions_ShouldIgnoreUserIdQueryParam_WhenProvided()
{
    // The endpoint does not accept userId from query; it always uses JWT claim.
    // This test asserts the handler signature does NOT have a userId parameter.
    var method = typeof(AuthEndpoints).GetMethod("GetOwnSessions",
        System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static);
    method.Should().NotBeNull();
    method!.GetParameters().Select(p => p.Name).Should().NotContain("userId");
}

[Fact]
public async Task RevokeOwnSession_ShouldReturn404_WhenTokenBelongsToOtherUser()
{
    var refreshTokenStore = Substitute.For<IRefreshTokenStore>();
    var otherUserToken = new RefreshToken
    {
        TokenId = "t1", UserId = "other-user", TenantId = "tenant1",
        TokenHash = "h1", CreatedAt = DateTimeOffset.UtcNow,
        ExpiresAt = DateTimeOffset.UtcNow.AddHours(1),
    };
    refreshTokenStore.GetActiveByUserAsync("tenant1", "user1", Arg.Any<CancellationToken>())
        .Returns(new List<RefreshToken>()); // empty — user1 has no sessions
    // No matching token found under current user's list

    var result = await AuthEndpoints.RevokeOwnSession(
        "t1",
        BuildHttpContextWithClaims("tenant1", "user1"),
        refreshTokenStore,
        CancellationToken.None);

    result.Should().BeOfType<NotFound>();
}

[Fact]
public async Task RevokeOwnSession_ShouldSucceed_WhenTokenBelongsToCurrentUser()
{
    var refreshTokenStore = Substitute.For<IRefreshTokenStore>();
    var ownToken = new RefreshToken
    {
        TokenId = "t1", UserId = "user1", TenantId = "tenant1",
        TokenHash = "h1", CreatedAt = DateTimeOffset.UtcNow,
        ExpiresAt = DateTimeOffset.UtcNow.AddHours(1),
    };
    refreshTokenStore.GetActiveByUserAsync("tenant1", "user1", Arg.Any<CancellationToken>())
        .Returns(new List<RefreshToken> { ownToken });

    var result = await AuthEndpoints.RevokeOwnSession(
        "t1",
        BuildHttpContextWithClaims("tenant1", "user1"),
        refreshTokenStore,
        CancellationToken.None);

    result.Should().BeOfType<Ok>();
    await refreshTokenStore.Received(1).RevokeAsync("t1", Arg.Any<DateTimeOffset>(), null, Arg.Any<CancellationToken>());
}

[Fact]
public async Task RevokeOtherSessions_ShouldPreserveCurrentSession_WhenCalled()
{
    var refreshTokenStore = Substitute.For<IRefreshTokenStore>();
    var tokens = new List<RefreshToken>
    {
        new() { TokenId = "current", UserId = "user1", TenantId = "tenant1", TokenHash = "h1",
                CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddHours(1) },
        new() { TokenId = "other-1", UserId = "user1", TenantId = "tenant1", TokenHash = "h2",
                CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddHours(1) },
        new() { TokenId = "other-2", UserId = "user1", TenantId = "tenant1", TokenHash = "h3",
                CreatedAt = DateTimeOffset.UtcNow, ExpiresAt = DateTimeOffset.UtcNow.AddHours(1) },
    };
    refreshTokenStore.GetActiveByUserAsync("tenant1", "user1", Arg.Any<CancellationToken>())
        .Returns(tokens);

    var result = await AuthEndpoints.RevokeOtherSessions(
        BuildHttpContextWithClaimsAndToken("tenant1", "user1", currentTokenId: "current"),
        refreshTokenStore,
        CancellationToken.None);

    result.Should().BeOfType<Ok>();
    await refreshTokenStore.DidNotReceive().RevokeAsync("current", Arg.Any<DateTimeOffset>(), null, Arg.Any<CancellationToken>());
    await refreshTokenStore.Received(1).RevokeAsync("other-1", Arg.Any<DateTimeOffset>(), null, Arg.Any<CancellationToken>());
    await refreshTokenStore.Received(1).RevokeAsync("other-2", Arg.Any<DateTimeOffset>(), null, Arg.Any<CancellationToken>());
}
```

**Note on `BuildHttpContextWithClaimsAndToken`:** this helper needs to build an HttpContext where the handler can identify the current refresh token. The current JWT does not carry the `tokenId` claim directly; it's the refresh token hash that identifies. For simplicity, the handler will accept the current token via a "bearer resolver" utility that reads the current JWT's `sub` + creation time to match against the active tokens list.

**Alternative approach:** include `tokenId` as a claim in the JWT at login time. Since this is a Sprint-0-style change, prefer the simpler path: pass the current token's hash via a new `IRefreshTokenContextAccessor` or reconstruct from the `Authorization` header cookie/bearer. **Decision:** read the refresh token from a cookie (the login flow sets `refresh_token` as an HttpOnly cookie). The handler hashes it and looks up `TokenId` via `GetByHashAsync`.

Update the test builder accordingly:

```csharp
private static HttpContext BuildHttpContextWithClaimsAndToken(string tenantId, string userId, string currentTokenId)
{
    var ctx = BuildHttpContextWithClaims(tenantId, userId);
    // Simulate the cookie that the login flow would set
    ctx.Request.Headers.Cookie = $"refresh_token=hash-of-{currentTokenId}";
    return ctx;
}
```

And in `RevokeOtherSessions`, use `IRefreshTokenStore.GetByHashAsync("hash-of-" + tokenIdFromCookie)` to find the current token.

- [ ] **Step 2: Run the tests and verify they FAIL**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "GetOwnSessions_Should|RevokeOwnSession_Should|RevokeOtherSessions_Should" -v q
```

Expected: 5 FAIL (methods don't exist yet).

- [ ] **Step 3: Implement the 3 handlers and the DTO**

In `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs`, add the DTO at the bottom of the file (near the other records):

```csharp
internal sealed record ActiveSessionDto(
    string TokenId,
    string? UserAgent,
    string? IpAddress,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    bool IsCurrentSession);
```

Then register the map endpoints inside the route group (in the same file, inside `MapAuthEndpoints`):

```csharp
// Sub C T2.1a: user-scoped sessions management
group.MapGet("/sessions", GetOwnSessions).RequireAuthorization();
group.MapDelete("/sessions/{tokenId}", RevokeOwnSession).RequireAuthorization();
group.MapPost("/sessions/revoke-others", RevokeOtherSessions).RequireAuthorization();
```

Add the handler methods:

```csharp
private static async Task<IResult> GetOwnSessions(
    HttpContext context,
    [FromServices] IRefreshTokenStore refreshTokenStore,
    CancellationToken ct)
{
    var claims = GetAuthClaims(context);
    var tokens = await refreshTokenStore.GetActiveByUserAsync(
        claims.TenantId.Value, claims.UserId.Value, ct);

    var currentTokenId = await TryGetCurrentTokenIdAsync(context, refreshTokenStore, ct);

    var dtos = tokens
        .Select(t => new ActiveSessionDto(
            t.TokenId,
            t.UserAgent,
            t.IpAddress,
            t.CreatedAt,
            t.ExpiresAt,
            IsCurrentSession: t.TokenId == currentTokenId))
        .ToArray();

    return Results.Ok(dtos);
}

private static async Task<IResult> RevokeOwnSession(
    string tokenId,
    HttpContext context,
    [FromServices] IRefreshTokenStore refreshTokenStore,
    CancellationToken ct)
{
    var claims = GetAuthClaims(context);
    var tokens = await refreshTokenStore.GetActiveByUserAsync(
        claims.TenantId.Value, claims.UserId.Value, ct);

    var target = tokens.FirstOrDefault(t => t.TokenId == tokenId);
    if (target is null)
        return Results.NotFound();

    await refreshTokenStore.RevokeAsync(tokenId, DateTimeOffset.UtcNow, null, ct);
    return Results.Ok();
}

private static async Task<IResult> RevokeOtherSessions(
    HttpContext context,
    [FromServices] IRefreshTokenStore refreshTokenStore,
    CancellationToken ct)
{
    var claims = GetAuthClaims(context);
    var currentTokenId = await TryGetCurrentTokenIdAsync(context, refreshTokenStore, ct);

    var tokens = await refreshTokenStore.GetActiveByUserAsync(
        claims.TenantId.Value, claims.UserId.Value, ct);

    var now = DateTimeOffset.UtcNow;
    foreach (var token in tokens)
    {
        if (token.TokenId == currentTokenId)
            continue;
        await refreshTokenStore.RevokeAsync(token.TokenId, now, null, ct);
    }

    return Results.Ok();
}

private static async Task<string?> TryGetCurrentTokenIdAsync(
    HttpContext context,
    IRefreshTokenStore refreshTokenStore,
    CancellationToken ct)
{
    if (!context.Request.Cookies.TryGetValue("refresh_token", out var refreshToken) ||
        string.IsNullOrEmpty(refreshToken))
        return null;

    var hash = HashToken(refreshToken);
    var stored = await refreshTokenStore.GetByHashAsync(hash, ct);
    return stored?.TokenId;
}

// HashToken helper should already exist somewhere in AuthEndpoints.cs
// (used by Login/Refresh). If not, copy from wherever refresh tokens are hashed.
```

**Important:** If `HashToken` does not exist as a shared helper, locate how `Login` hashes the token before calling `SaveAsync`, and reuse that logic. Typically it's `SHA256` + base64.

- [ ] **Step 4: Register `ActiveSessionDto` in `ApiJsonContext.cs` for AOT serialization**

```csharp
[JsonSerializable(typeof(ActiveSessionDto))]
[JsonSerializable(typeof(ActiveSessionDto[]))]
// ... other existing types
```

- [ ] **Step 5: Run the tests and verify they PASS**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "GetOwnSessions_Should|RevokeOwnSession_Should|RevokeOtherSessions_Should" -v q
```

Expected: 5 PASS.

- [ ] **Step 6: Run the full test suite to catch regressions**

```bash
dotnet test Asterisk.Platform.slnx -v q 2>&1 | tail -20
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs
git commit -m "feat(auth): add user-scoped sessions management endpoints

Adds 3 new endpoints for self-service session management:
- GET /auth/sessions — list user's own active refresh tokens
- DELETE /auth/sessions/{tokenId} — revoke one of your own sessions
- POST /auth/sessions/revoke-others — revoke all except current

Uses IRefreshTokenStore.GetActiveByUserAsync for listing. Current session
detection reads the refresh_token cookie and hashes it to find a match in
the active tokens list. Ownership is enforced by only listing tokens whose
UserId matches the JWT sub claim.

Sub C T2.1a — closes 'Sign out other devices' feature gap."
```

---

## Task 7: T2.2a — Recovery codes regenerate endpoint

**Files:**
- Modify: `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs`
- Modify: `src/Asterisk.Platform.Identity/AuthEvent.cs` (add new event type constant)
- Modify: `src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs`
- Modify: `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform`

- [ ] **Step 1: Add the new auth event type constant**

In `src/Asterisk.Platform.Identity/AuthEvent.cs`, add to the `AuthEventTypes` static class:

```csharp
public const string RecoveryCodesRegenerated = "recovery_codes_regenerated";
```

- [ ] **Step 2: Write 2 failing tests**

Add to `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`:

```csharp
[Fact]
public async Task RegenerateRecoveryCodes_ShouldReturn10Codes_WhenMfaEnabledAndPasswordCorrect()
{
    var userStore = Substitute.For<IUserStore>();
    var passwordService = BuildPasswordService(verifyResult: true);
    var user = BuildUser(mfaEnabled: true);
    user.MfaRecoveryCodes = new[] { "old1", "old2" };
    userStore.GetByIdAsync(Arg.Any<TenantId>(), Arg.Any<EntityId>(), Arg.Any<CancellationToken>())
        .Returns(user);

    var request = new RegenerateRecoveryCodesRequest("CorrectPassword123!");
    var result = await AuthEndpoints.RegenerateRecoveryCodes(
        request, BuildHttpContext(), userStore, passwordService,
        BuildAuthEventStore(), CancellationToken.None);

    result.Should().BeOfType<Ok<RecoveryCodesResponse>>();
    var response = ((Ok<RecoveryCodesResponse>)result).Value!;
    response.RecoveryCodes.Should().HaveCount(10);
    user.MfaRecoveryCodes.Should().NotContain("old1");
    user.MfaRecoveryCodes.Should().NotContain("old2");
}

[Fact]
public async Task RegenerateRecoveryCodes_ShouldReturn400_WhenMfaNotEnabled()
{
    var userStore = Substitute.For<IUserStore>();
    var passwordService = BuildPasswordService(verifyResult: true);
    var user = BuildUser(mfaEnabled: false);
    userStore.GetByIdAsync(Arg.Any<TenantId>(), Arg.Any<EntityId>(), Arg.Any<CancellationToken>())
        .Returns(user);

    var request = new RegenerateRecoveryCodesRequest("CorrectPassword123!");
    var result = await AuthEndpoints.RegenerateRecoveryCodes(
        request, BuildHttpContext(), userStore, passwordService,
        BuildAuthEventStore(), CancellationToken.None);

    result.Should().BeOfType<BadRequest<ErrorResponse>>();
}
```

- [ ] **Step 3: Run the tests and verify they FAIL**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "RegenerateRecoveryCodes_Should" -v q
```

Expected: 2 FAIL.

- [ ] **Step 4: Implement the endpoint**

In `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs`, add the DTOs:

```csharp
internal sealed record RegenerateRecoveryCodesRequest(string Password);
internal sealed record RecoveryCodesResponse(string[] RecoveryCodes);
```

Register the route inside `MapAuthEndpoints`:

```csharp
group.MapPost("/mfa/recovery-codes/regenerate", RegenerateRecoveryCodes).RequireAuthorization();
```

Add the handler:

```csharp
private static async Task<IResult> RegenerateRecoveryCodes(
    RegenerateRecoveryCodesRequest request,
    HttpContext context,
    [FromServices] IUserStore userStore,
    [FromServices] PasswordService passwordService,
    [FromServices] IAuthEventStore authEvents,
    CancellationToken ct)
{
    var claims = GetAuthClaims(context);
    var user = await userStore.GetByIdAsync(claims.TenantId, claims.UserId, ct);
    if (user is null)
        return Results.Unauthorized();

    if (!user.MfaEnabled)
        return Results.BadRequest(new ErrorResponse("MFA is not enabled for this user."));

    if (!passwordService.VerifyPassword(request.Password, user.PasswordHash ?? ""))
        return Results.Unauthorized();

    // Reuse the existing recovery codes generation helper (used in MfaSetup).
    // If it is a private method in this file, call it directly. If not,
    // copy the logic inline: generate 10 codes of format "XXXX-XXXX" using
    // RandomNumberGenerator.
    var newCodes = GenerateRecoveryCodes();
    user.MfaRecoveryCodes = newCodes;
    user.UpdatedAt = DateTimeOffset.UtcNow;
    await userStore.UpdateAsync(user, ct);

    await authEvents.LogAsync(new AuthEvent
    {
        EventId = Guid.NewGuid().ToString(),
        TenantId = claims.TenantId.Value,
        UserId = claims.UserId.Value,
        EventType = AuthEventTypes.RecoveryCodesRegenerated,
        CreatedAt = DateTimeOffset.UtcNow,
    }, ct);

    return Results.Ok(new RecoveryCodesResponse(newCodes.ToArray()));
}
```

**Note:** `GenerateRecoveryCodes()` likely exists as a private helper in AuthEndpoints.cs used by `MfaSetup`. Grep for it: `grep -n "GenerateRecoveryCodes\|recovery_codes" src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs`. If it exists as a method, call it directly. If the logic is inlined in MfaSetup, extract it into a private method so both handlers can reuse it.

- [ ] **Step 5: Register DTOs in ApiJsonContext.cs**

```csharp
[JsonSerializable(typeof(RegenerateRecoveryCodesRequest))]
[JsonSerializable(typeof(RecoveryCodesResponse))]
```

- [ ] **Step 6: Run the tests and verify they PASS**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "RegenerateRecoveryCodes_Should" -v q
```

Expected: 2 PASS.

- [ ] **Step 7: Commit**

```bash
git add src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs src/Asterisk.Platform.Identity/AuthEvent.cs src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs
git commit -m "feat(auth): add recovery codes regenerate endpoint

POST /auth/mfa/recovery-codes/regenerate (password-gated) generates 10 fresh
recovery codes, replacing any existing ones. Used for post-enrollment
refresh when a user has burned through most of their codes.

Guarded by GuardAgainstImpersonation middleware (Sub C T0.2). Requires
user.MfaEnabled=true; returns 400 otherwise.

Also adds AuthEventTypes.RecoveryCodesRegenerated for audit logging.

Sub C T2.2a — closes 'user locked out after burning all codes' gap."
```

---

## Task 8: T2.3a — Password policy GET endpoint

**Files:**
- Modify: `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs`
- Modify: `src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs`
- Modify: `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform`

- [ ] **Step 1: Write 2 failing tests**

```csharp
[Fact]
public async Task GetPasswordPolicy_ShouldReturnTenantPolicy_WhenCalled()
{
    var tenantAuthConfigStore = Substitute.For<ITenantAuthConfigStore>();
    var authConfig = new TenantAuthConfig
    {
        TenantId = "tenant1",
        PasswordMinLength = 14,
        PasswordRequireUppercase = true,
        PasswordRequireNumber = true,
        PasswordRequireSpecial = false,
    };
    tenantAuthConfigStore.GetAsync(Arg.Any<TenantId>(), Arg.Any<CancellationToken>())
        .Returns(authConfig);

    var result = await AuthEndpoints.GetPasswordPolicy(
        BuildHttpContextWithClaims("tenant1", "user1"),
        tenantAuthConfigStore,
        CancellationToken.None);

    result.Should().BeOfType<Ok<PasswordPolicyDto>>();
    var dto = ((Ok<PasswordPolicyDto>)result).Value!;
    dto.MinLength.Should().Be(14);
    dto.RequireUppercase.Should().BeTrue();
    dto.RequireNumber.Should().BeTrue();
    dto.RequireSpecial.Should().BeFalse();
}

[Fact]
public async Task GetPasswordPolicy_ShouldNotLeakSecrets_WhenCalled()
{
    // Verify the DTO shape via reflection — ensure only the 4 password-related
    // properties exist (no OIDC secrets, no lockout config, no MFA policy).
    var props = typeof(PasswordPolicyDto).GetProperties()
        .Select(p => p.Name)
        .ToHashSet();

    props.Should().BeEquivalentTo(new[]
    {
        "MinLength", "RequireUppercase", "RequireNumber", "RequireSpecial"
    });
}
```

**Design note:** `PasswordRequireLowercase` is NOT in `TenantAuthConfig` (verified during spec self-review). The DTO therefore has 4 properties, not 5. The frontend checklist will not show a "lowercase" check either.

- [ ] **Step 2: Run the tests and verify they FAIL**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "GetPasswordPolicy_Should" -v q
```

Expected: 2 FAIL.

- [ ] **Step 3: Implement the endpoint**

Add DTO to `AuthEndpoints.cs`:

```csharp
internal sealed record PasswordPolicyDto(
    int MinLength,
    bool RequireUppercase,
    bool RequireNumber,
    bool RequireSpecial);
```

Register route in `MapAuthEndpoints`:

```csharp
group.MapGet("/password-policy", GetPasswordPolicy).RequireAuthorization();
```

Add handler:

```csharp
private static async Task<IResult> GetPasswordPolicy(
    HttpContext context,
    [FromServices] ITenantAuthConfigStore tenantAuthConfigStore,
    CancellationToken ct)
{
    var claims = GetAuthClaims(context);
    var config = await tenantAuthConfigStore.GetAsync(claims.TenantId, ct);

    // Fallback to platform defaults if no tenant-specific config
    var dto = new PasswordPolicyDto(
        MinLength: config?.PasswordMinLength ?? 12,
        RequireUppercase: config?.PasswordRequireUppercase ?? true,
        RequireNumber: config?.PasswordRequireNumber ?? true,
        RequireSpecial: config?.PasswordRequireSpecial ?? false);

    return Results.Ok(dto);
}
```

- [ ] **Step 4: Register DTO in ApiJsonContext.cs**

```csharp
[JsonSerializable(typeof(PasswordPolicyDto))]
```

- [ ] **Step 5: Run the tests and verify they PASS**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "GetPasswordPolicy_Should" -v q
```

Expected: 2 PASS.

- [ ] **Step 6: Commit**

```bash
git add src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs
git commit -m "feat(auth): add user-scoped GET /auth/password-policy endpoint

Returns the tenant's password policy (min length + 3 flags) as a sanitized
DTO. Sanitized = only the 4 password-related fields, never OIDC secrets or
lockout config.

Used by security-page and reset-password-page for live validation checklist.
Falls back to platform defaults if the tenant has no custom config.

Note: PasswordRequireLowercase does not exist in TenantAuthConfig, so the
DTO has 4 fields not 5; the frontend checklist omits the lowercase check.

Sub C T2.3a — closes UX friction in password change forms."
```

---

## Task 9: T2.4a — Security notification emits

**Files:**
- Modify: `src/Asterisk.Platform.Core/Notifications/NotificationTypeRegistry.cs`
- Modify: `src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs` (inject + call)
- Modify: `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform`

- [ ] **Step 1: Add 3 new notification types to the registry**

In `src/Asterisk.Platform.Core/Notifications/NotificationTypeRegistry.cs`, add entries to the `s_types` dictionary:

```csharp
["security.mfa_enabled"] = new("security.mfa_enabled",
    NotificationCategory.Security, NotificationSeverity.Info,
    ["admin", "system_admin"]),

["security.mfa_disabled"] = new("security.mfa_disabled",
    NotificationCategory.Security, NotificationSeverity.Warning,
    ["admin", "system_admin"]),

["security.password_changed"] = new("security.password_changed",
    NotificationCategory.Security, NotificationSeverity.Info,
    ["admin", "system_admin"]),
```

Note: TargetRoles uses `["admin", "system_admin"]` only — matching the existing `security.account_locked` and `security.suspicious_login` pattern. The user performing the action does not need a self-notification; admin audit visibility is the goal.

- [ ] **Step 2: Write 3 failing tests**

Add to `tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs`:

```csharp
[Fact]
public async Task MfaConfirm_ShouldEmitNotification_WhenSucceeds()
{
    var userStore = Substitute.For<IUserStore>();
    var notifications = Substitute.For<INotificationService>();
    var user = BuildUser(mfaEnabled: false);
    user.MfaSecret = "JBSWY3DPEHPK3PXP";
    userStore.GetByIdAsync(Arg.Any<TenantId>(), Arg.Any<EntityId>(), Arg.Any<CancellationToken>())
        .Returns(user);

    var request = new MfaConfirmRequest("123456");
    // Assume MfaConfirm takes a stub TOTP validator that accepts "123456"
    var result = await AuthEndpoints.MfaConfirm(
        request, BuildHttpContext(), userStore, BuildTotpValidator(valid: true),
        BuildAuthEventStore(), notifications, CancellationToken.None);

    await notifications.Received(1).CreateAsync(
        Arg.Any<TenantId>(),
        "security.mfa_enabled",
        Arg.Any<string>(),
        Arg.Any<string>(),
        Arg.Any<string?>(),
        Arg.Any<CancellationToken>());
}

[Fact]
public async Task MfaDisable_ShouldEmitNotification_WhenSucceeds()
{
    var userStore = Substitute.For<IUserStore>();
    var notifications = Substitute.For<INotificationService>();
    var tenantAuthConfigStore = Substitute.For<ITenantAuthConfigStore>();
    var user = BuildUser(mfaEnabled: true);
    userStore.GetByIdAsync(Arg.Any<TenantId>(), Arg.Any<EntityId>(), Arg.Any<CancellationToken>())
        .Returns(user);
    tenantAuthConfigStore.GetAsync(Arg.Any<TenantId>(), Arg.Any<CancellationToken>())
        .Returns(new TenantAuthConfig { TenantId = "tenant1", MfaPolicy = "optional" });

    var request = new MfaDisableRequest("CorrectPassword123!");
    var result = await AuthEndpoints.MfaDisable(
        request, BuildHttpContext(), userStore, tenantAuthConfigStore,
        BuildPasswordService(verifyResult: true), BuildAuthEventStore(),
        notifications, CancellationToken.None);

    await notifications.Received(1).CreateAsync(
        Arg.Any<TenantId>(),
        "security.mfa_disabled",
        Arg.Any<string>(),
        Arg.Any<string>(),
        Arg.Any<string?>(),
        Arg.Any<CancellationToken>());
}

[Fact]
public async Task ChangePassword_ShouldEmitNotification_WhenSucceeds()
{
    var userStore = Substitute.For<IUserStore>();
    var notifications = Substitute.For<INotificationService>();
    var user = BuildUser();
    userStore.GetByIdAsync(Arg.Any<TenantId>(), Arg.Any<EntityId>(), Arg.Any<CancellationToken>())
        .Returns(user);

    var request = new ChangePasswordRequest("OldPassword123!", "NewPassword456!");
    var result = await AuthEndpoints.ChangePassword(
        request, BuildHttpContext(), userStore,
        BuildPasswordService(verifyResult: true),
        BuildAuthEventStore(), notifications, CancellationToken.None);

    await notifications.Received(1).CreateAsync(
        Arg.Any<TenantId>(),
        "security.password_changed",
        Arg.Any<string>(),
        Arg.Any<string>(),
        Arg.Any<string?>(),
        Arg.Any<CancellationToken>());
}
```

- [ ] **Step 3: Run the tests and verify they FAIL**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "ShouldEmitNotification_WhenSucceeds" -v q
```

Expected: 3 FAIL (handlers don't inject INotificationService yet).

- [ ] **Step 4: Inject INotificationService into 3 handlers and call CreateAsync**

Update `MfaConfirm`, `MfaDisable`, and `ChangePassword` to accept `[FromServices] INotificationService notifications` and add the emit call after success.

Example for `MfaConfirm`:

```csharp
private static async Task<IResult> MfaConfirm(
    MfaConfirmRequest request,
    HttpContext context,
    [FromServices] IUserStore userStore,
    [FromServices] TotpService totpService,   // or whatever the TOTP validator is called
    [FromServices] IAuthEventStore authEvents,
    [FromServices] INotificationService notifications,   // NEW
    CancellationToken ct)
{
    var claims = GetAuthClaims(context);
    var user = await userStore.GetByIdAsync(claims.TenantId, claims.UserId, ct);
    if (user is null || user.MfaSecret is null)
        return Results.Unauthorized();

    if (!totpService.Validate(user.MfaSecret, request.Code))
        return Results.BadRequest(new ErrorResponse("Invalid verification code"));

    user.MfaEnabled = true;
    user.MfaConfirmedAt = DateTimeOffset.UtcNow;
    user.UpdatedAt = DateTimeOffset.UtcNow;
    await userStore.UpdateAsync(user, ct);

    await authEvents.LogAsync(new AuthEvent
    {
        EventId = Guid.NewGuid().ToString(),
        TenantId = claims.TenantId.Value,
        UserId = claims.UserId.Value,
        EventType = AuthEventTypes.MfaEnroll,
        CreatedAt = DateTimeOffset.UtcNow,
    }, ct);

    // Sub C T2.4a: emit security notification
    await notifications.CreateAsync(
        claims.TenantId,
        "security.mfa_enabled",
        title: "Two-factor authentication enabled",
        body: $"User {user.Email} enabled MFA on their account.",
        actionUrl: "/admin/security",
        ct);

    return Results.Ok();
}
```

Apply the same pattern to `MfaDisable` (different type, different body) and `ChangePassword`. Do not localize the title/body strings at this layer — the notification center renders them as-is. Future localization can be done via a separate locale table if needed.

- [ ] **Step 5: Run the tests and verify they PASS**

```bash
dotnet test tests/Asterisk.Platform.Api.Tests/ --filter "ShouldEmitNotification_WhenSucceeds" -v q
```

Expected: 3 PASS.

- [ ] **Step 6: Run the full test suite**

```bash
dotnet test Asterisk.Platform.slnx -v q 2>&1 | tail -20
```

Expected: all pass. Note: earlier tests for MfaConfirm/MfaDisable/ChangePassword may need to be updated to inject `Substitute.For<INotificationService>()` into the handler calls. Fix any test failures caused by the new dependency.

- [ ] **Step 7: Commit**

```bash
git add src/Asterisk.Platform.Core/Notifications/NotificationTypeRegistry.cs src/Asterisk.Platform.Api/Endpoints/AuthEndpoints.cs tests/Asterisk.Platform.Api.Tests/Endpoints/AuthEndpointsTests.cs
git commit -m "feat(notifications): emit security events for MFA and password changes

Adds 3 new notification types to the registry:
- security.mfa_enabled (Info, admin/system_admin)
- security.mfa_disabled (Warning, admin/system_admin)
- security.password_changed (Info, admin/system_admin)

Injects INotificationService into MfaConfirm, MfaDisable, and ChangePassword
handlers. Admins now see these events in the Notification Center (Sub A).
Target roles only include admins — the user performing the action does not
need a self-notification.

Sub C T2.4a — cross-feature integration with Sub A Notification Center."
```

---

## Task 10: T1.1 — `useMe` hook with typed Me interface

**Files:**
- Create: `src/core/api/hooks/use-me.ts`
- Create: `src/core/api/hooks/use-me.test.tsx`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Verify `/users/me` endpoint response shape**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform
grep -n "GetCurrentUser\|UsersMeEndpoint" src/Asterisk.Platform.Api/Endpoints/UsersMeEndpoint.cs
```

Read the handler (from earlier audit, `GET /users/me` returns the full `User` entity). The JSON will be camelCase due to default policy. Field mapping:

| Backend `User` | Frontend `Me` |
|---|---|
| `UserId` (EntityId) | `id: string` |
| `Email` | `email: string` |
| `DisplayName` | `displayName: string` |
| `Role` (UserRole enum) | `role: string` (enum name as string) |
| `Status` (UserStatus enum) | `status: string` |
| `MfaEnabled` | `mfaEnabled: boolean` |
| `MfaConfirmedAt` | `mfaConfirmedAt: string \| null` |
| `EmailVerified` | `emailVerified: boolean` |
| `FailedLoginAttempts` | `failedLoginAttempts: number` |
| `LockedUntil` | `lockedUntil: string \| null` |
| `PasswordChangedAt` | `passwordChangedAt: string \| null` |
| `LastLoginAt` | `lastLoginAt: string \| null` |
| `AuthProvider` | `authProvider: 'local' \| 'oidc' \| 'apikey'` |
| `ExternalId` | `externalId: string \| null` |
| `OidcSubject` | `oidcSubject: string \| null` |

- [ ] **Step 2: Create the hook file**

Create `src/core/api/hooks/use-me.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  mfaConfirmedAt: string | null;
  emailVerified: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  authProvider: 'local' | 'oidc' | 'apikey';
  externalId: string | null;
  oidcSubject: string | null;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => customFetch<Me>({ url: '/api/v1/users/me', method: 'GET' }),
    staleTime: 60_000, // 1 minute
  });
}

export function isLockedOut(me: Me | undefined): boolean {
  if (!me?.lockedUntil) return false;
  return new Date(me.lockedUntil).getTime() > Date.now();
}
```

- [ ] **Step 3: Create the test file**

Create `src/core/api/hooks/use-me.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMe, isLockedOut, type Me } from './use-me';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleMe: Me = {
  id: 'user1',
  email: 'test@example.com',
  displayName: 'Test User',
  role: 'Agent',
  status: 'Active',
  mfaEnabled: true,
  mfaConfirmedAt: '2026-04-01T10:00:00Z',
  emailVerified: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  passwordChangedAt: '2026-03-15T08:00:00Z',
  lastLoginAt: '2026-04-10T09:30:00Z',
  authProvider: 'local',
  externalId: null,
  oidcSubject: null,
};

describe('useMe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch and return user when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleMe);
    const { result } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleMe);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/users/me',
      method: 'GET',
    });
  });

  it('should cache between renders when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleMe);
    const { result, rerender } = renderHook(() => useMe(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const firstData = result.current.data;
    rerender();
    expect(result.current.data).toBe(firstData); // same reference
  });

  it('should return isLockedOut=false when lockedUntil is null', () => {
    expect(isLockedOut({ ...sampleMe, lockedUntil: null })).toBe(false);
  });

  it('should return isLockedOut=true when lockedUntil is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isLockedOut({ ...sampleMe, lockedUntil: future })).toBe(true);
  });

  it('should return isLockedOut=false when lockedUntil is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isLockedOut({ ...sampleMe, lockedUntil: past })).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests and verify they PASS**

```bash
npm run test -- src/core/api/hooks/use-me.test.tsx
```

Expected: 5 PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run build 2>&1 | tail -8
```

Expected: 0 TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/api/hooks/use-me.ts src/core/api/hooks/use-me.test.tsx
git commit -m "feat(hooks): add useMe hook with typed Me interface

Creates a dedicated hook for fetching the current user's profile via
GET /users/me. Returns the full User entity from the backend, typed with
15 fields including mfaEnabled, authProvider, lockedUntil, and timestamps.

Also exports isLockedOut() helper for lockout state derivation.

Replaces the hardcoded 'mfaEnabled = false' useState in security-page.tsx
(line 30 TODO). Query key is ['me'] with 1-minute stale time.

Sub C T1.1 — closes the original TODO that triggered Sub C."
```

---

## Task 11: T1.2 — Refactor customFetch to mutations in use-auth-admin.ts

**Files:**
- Modify: `src/core/api/hooks/use-auth-admin.ts`
- Create or modify: `src/core/api/hooks/use-auth-admin.test.tsx`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Read the existing use-auth-admin.ts structure**

```bash
head -80 src/core/api/hooks/use-auth-admin.ts
```

Identify the existing hooks. The refactor adds new hooks without removing existing ones.

- [ ] **Step 2: Add the mutation hooks and query hooks**

Append to `src/core/api/hooks/use-auth-admin.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

// Sub C T1.2: MFA + password + sessions mutations

export interface MfaSetupResponse {
  secret: string;
  qrUri: string;
  recoveryCodes: string[];
}

export function useSetupMfa() {
  return useMutation({
    mutationFn: () =>
      customFetch<MfaSetupResponse>({
        url: '/api/v1/auth/mfa/setup',
        method: 'POST',
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useConfirmMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      customFetch<void>({
        url: '/api/v1/auth/mfa/confirm',
        method: 'POST',
        data: { code },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('MFA enabled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDisableMfa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      customFetch<void>({
        url: '/api/v1/auth/mfa',
        method: 'DELETE',
        data: { password },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.success('MFA disabled');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) =>
      customFetch<void>({
        url: '/api/v1/auth/change-password',
        method: 'POST',
        data,
      }),
    onSuccess: () => toast.success('Password changed'),
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface ActiveSession {
  tokenId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrentSession: boolean;
}

export function useMySessions() {
  return useQuery({
    queryKey: ['auth', 'sessions', 'me'],
    queryFn: () =>
      customFetch<ActiveSession[]>({
        url: '/api/v1/auth/sessions',
        method: 'GET',
      }),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) =>
      customFetch<void>({
        url: `/api/v1/auth/sessions/${tokenId}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'sessions', 'me'] });
      toast.success('Session revoked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<void>({
        url: '/api/v1/auth/sessions/revoke-others',
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auth', 'sessions', 'me'] });
      toast.success('All other sessions signed out');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface RecoveryCodesResponse {
  recoveryCodes: string[];
}

export function useRegenerateRecoveryCodes() {
  return useMutation({
    mutationFn: (password: string) =>
      customFetch<RecoveryCodesResponse>({
        url: '/api/v1/auth/mfa/recovery-codes/regenerate',
        method: 'POST',
        data: { password },
      }),
    onSuccess: () => toast.success('Recovery codes regenerated'),
    onError: (err: Error) => toast.error(err.message),
  });
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecial: boolean;
}

export function usePasswordPolicy() {
  return useQuery({
    queryKey: ['auth', 'password-policy'],
    queryFn: () =>
      customFetch<PasswordPolicy>({
        url: '/api/v1/auth/password-policy',
        method: 'GET',
      }),
    staleTime: Infinity,
  });
}
```

- [ ] **Step 3: Create test file with 5 invalidation assertions**

Create `src/core/api/hooks/use-auth-admin.test.tsx` (if it doesn't exist; otherwise append):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useConfirmMfa,
  useDisableMfa,
  useChangePassword,
  useRevokeSession,
  usePasswordPolicy,
} from './use-auth-admin';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

describe('use-auth-admin mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useConfirmMfa should invalidate me on success', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useConfirmMfa(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('123456');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me'] });
  });

  it('useDisableMfa should invalidate me on success', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDisableMfa(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('password');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['me'] });
  });

  it('useChangePassword should NOT invalidate me on success', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useChangePassword(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ oldPassword: 'a', newPassword: 'b' });
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['me'] });
  });

  it('useRevokeSession should invalidate sessions list on success', async () => {
    const { qc, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useRevokeSession(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('token-123');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['auth', 'sessions', 'me'] });
  });

  it('usePasswordPolicy should cache with infinite stale time on success', async () => {
    const { wrapper } = createWrapper();
    vi.mocked(client.customFetch).mockResolvedValue({
      minLength: 12, requireUppercase: true, requireNumber: true, requireSpecial: false,
    });

    const { result } = renderHook(() => usePasswordPolicy(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.minLength).toBe(12);
    // Verify staleTime: after initial fetch, data is never stale
    expect(result.current.isStale).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests and verify they PASS**

```bash
npm run test -- src/core/api/hooks/use-auth-admin.test.tsx
```

Expected: 5 PASS.

- [ ] **Step 5: Typecheck**

```bash
npm run build 2>&1 | tail -8
```

Expected: 0 TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/api/hooks/use-auth-admin.ts src/core/api/hooks/use-auth-admin.test.tsx
git commit -m "feat(hooks): add MFA, password, sessions mutations to use-auth-admin

Adds 9 new hooks consuming the auth endpoints:
- useSetupMfa, useConfirmMfa, useDisableMfa (MFA flow)
- useChangePassword
- useMySessions, useRevokeSession, useRevokeOtherSessions (T2.1)
- useRegenerateRecoveryCodes (T2.2)
- usePasswordPolicy (T2.3)

All mutations have narrow query invalidation: useConfirmMfa/useDisableMfa
invalidate ['me'], useRevokeSession/RevokeOtherSessions invalidate
['auth', 'sessions', 'me'], useChangePassword does not invalidate anything
(password shape isn't cached). usePasswordPolicy uses staleTime:Infinity
since the tenant policy doesn't change within a session.

Sub C T1.2 — normalizes security-page to codebase TanStack Query pattern."
```

---

## Task 12: T1.3 — i18n completion

**Files:**
- Modify: `public/locales/en-US/admin.json`
- Modify: `public/locales/es-419/admin.json`
- Modify: `public/locales/pt-BR/admin.json`
- Modify: `public/locales/en-US/common.json`
- Modify: `public/locales/es-419/common.json`
- Modify: `public/locales/pt-BR/common.json`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Add `security` subtree to en-US/admin.json**

Read current structure:

```bash
grep -n '"security"\|"sidebar"' public/locales/en-US/admin.json | head
```

Add the `security` subtree (merge into existing JSON — location order doesn't matter):

```json
"security": {
  "title": "Security",
  "mfa": "Two-Factor Authentication",
  "mfa_description": "Add an extra layer of security to your account",
  "enable_mfa": "Enable MFA",
  "disable_mfa": "Disable MFA",
  "scan_qr": "Scan this QR code with your authenticator app",
  "manual_key": "Or enter this key manually:",
  "enter_code": "Enter the 6-digit code from your authenticator app",
  "change_password": "Change Password",
  "confirm_password_to_disable": "Enter your password to confirm",
  "save_recovery_codes": "Save these recovery codes in a safe place. You will not be able to see them again.",
  "regenerate_recovery_codes": "Regenerate Recovery Codes",
  "regenerate_confirm": "This will invalidate your existing recovery codes. Enter your password to confirm.",
  "mfa_required_banner": "Your organization requires MFA.",
  "mfa_required_enroll": "Please enable MFA below to comply with your organization's policy.",
  "mfa_cannot_disable": "MFA is required by your organization and cannot be disabled.",
  "oidc_badge": "Federated Identity (OIDC)",
  "oidc_password_note": "Your password is managed by your identity provider.",
  "active_sessions": "Active Sessions",
  "this_session": "This session",
  "revoke_session": "Revoke",
  "sign_out_others": "Sign out all other devices",
  "sessions_timeout_note": "Sessions expire after {{idle}} minutes of inactivity or {{absolute}} hours total.",
  "account_locked": "Your account is locked until {{time}}. Use forgot-password to regain access.",
  "password_policy_title": "Password requirements",
  "password_too_short": "At least {{n}} characters",
  "password_needs_uppercase": "One uppercase letter",
  "password_needs_number": "One number",
  "password_needs_special": "One special character"
}
```

Also add under `sidebar`:

```json
"sidebar": {
  "security": "Security",
  ...existing keys...
}
```

- [ ] **Step 2: Add `status` and `actions` keys to en-US/common.json**

In `public/locales/en-US/common.json`, add:

```json
"status": {
  "enabled": "Enabled",
  "disabled": "Disabled",
  ...existing keys...
},
"actions": {
  "copy": "Copy",
  "download": "Download",
  "done": "Done",
  "next": "Next",
  ...existing keys...
},
"nav": {
  "security": "Security",
  ...existing nav keys...
}
```

Also add `auth.mfa_rate_limited` and `auth.mfa_challenge_expired` if not added in Task 4:

```json
"auth": {
  "mfa_rate_limited": "Too many attempts. Please wait a few minutes and try again.",
  "mfa_challenge_expired": "Your session expired. Please log in again.",
  ...existing auth keys...
}
```

- [ ] **Step 3: Repeat for es-419 (Spanish)**

Translate all the above for `public/locales/es-419/admin.json` and `common.json`. Key translations:

```json
"security": {
  "title": "Seguridad",
  "mfa": "Autenticación en dos pasos",
  "mfa_description": "Agrega una capa extra de seguridad a tu cuenta",
  "enable_mfa": "Habilitar MFA",
  "disable_mfa": "Deshabilitar MFA",
  "scan_qr": "Escanea este código QR con tu aplicación autenticadora",
  "manual_key": "O ingresa esta clave manualmente:",
  "enter_code": "Ingresa el código de 6 dígitos de tu aplicación autenticadora",
  "change_password": "Cambiar contraseña",
  "confirm_password_to_disable": "Ingresa tu contraseña para confirmar",
  "save_recovery_codes": "Guarda estos códigos de recuperación en un lugar seguro. No podrás verlos de nuevo.",
  "regenerate_recovery_codes": "Regenerar códigos de recuperación",
  "regenerate_confirm": "Esto invalidará tus códigos de recuperación existentes. Ingresa tu contraseña para confirmar.",
  "mfa_required_banner": "Tu organización requiere MFA.",
  "mfa_required_enroll": "Por favor habilita MFA abajo para cumplir con la política de tu organización.",
  "mfa_cannot_disable": "MFA es requerido por tu organización y no puede ser deshabilitado.",
  "oidc_badge": "Identidad Federada (OIDC)",
  "oidc_password_note": "Tu contraseña es gestionada por tu proveedor de identidad.",
  "active_sessions": "Sesiones Activas",
  "this_session": "Esta sesión",
  "revoke_session": "Revocar",
  "sign_out_others": "Cerrar todas las demás sesiones",
  "sessions_timeout_note": "Las sesiones expiran después de {{idle}} minutos de inactividad o {{absolute}} horas en total.",
  "account_locked": "Tu cuenta está bloqueada hasta {{time}}. Usa olvidé mi contraseña para recuperar acceso.",
  "password_policy_title": "Requisitos de contraseña",
  "password_too_short": "Al menos {{n}} caracteres",
  "password_needs_uppercase": "Una letra mayúscula",
  "password_needs_number": "Un número",
  "password_needs_special": "Un carácter especial"
}
```

es-419 common.json:
```json
"status": { "enabled": "Habilitado", "disabled": "Deshabilitado" },
"actions": { "copy": "Copiar", "download": "Descargar", "done": "Listo", "next": "Siguiente" },
"nav": { "security": "Seguridad" },
"auth": {
  "mfa_rate_limited": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  "mfa_challenge_expired": "Tu sesión expiró. Por favor, inicia sesión de nuevo."
}
```

- [ ] **Step 4: Repeat for pt-BR (Portuguese)**

pt-BR admin.json security subtree:

```json
"security": {
  "title": "Segurança",
  "mfa": "Autenticação em dois fatores",
  "mfa_description": "Adicione uma camada extra de segurança à sua conta",
  "enable_mfa": "Habilitar MFA",
  "disable_mfa": "Desabilitar MFA",
  "scan_qr": "Escaneie este código QR com seu aplicativo autenticador",
  "manual_key": "Ou digite esta chave manualmente:",
  "enter_code": "Digite o código de 6 dígitos do seu aplicativo autenticador",
  "change_password": "Alterar senha",
  "confirm_password_to_disable": "Digite sua senha para confirmar",
  "save_recovery_codes": "Guarde estes códigos de recuperação em um lugar seguro. Você não poderá vê-los novamente.",
  "regenerate_recovery_codes": "Regenerar códigos de recuperação",
  "regenerate_confirm": "Isto invalidará seus códigos de recuperação existentes. Digite sua senha para confirmar.",
  "mfa_required_banner": "Sua organização requer MFA.",
  "mfa_required_enroll": "Por favor, habilite MFA abaixo para cumprir com a política da sua organização.",
  "mfa_cannot_disable": "MFA é requerido pela sua organização e não pode ser desabilitado.",
  "oidc_badge": "Identidade Federada (OIDC)",
  "oidc_password_note": "Sua senha é gerenciada pelo seu provedor de identidade.",
  "active_sessions": "Sessões Ativas",
  "this_session": "Esta sessão",
  "revoke_session": "Revogar",
  "sign_out_others": "Sair de todos os outros dispositivos",
  "sessions_timeout_note": "As sessões expiram após {{idle}} minutos de inatividade ou {{absolute}} horas no total.",
  "account_locked": "Sua conta está bloqueada até {{time}}. Use esqueci minha senha para recuperar acesso.",
  "password_policy_title": "Requisitos de senha",
  "password_too_short": "Pelo menos {{n}} caracteres",
  "password_needs_uppercase": "Uma letra maiúscula",
  "password_needs_number": "Um número",
  "password_needs_special": "Um caractere especial"
}
```

pt-BR common.json:
```json
"status": { "enabled": "Habilitado", "disabled": "Desabilitado" },
"actions": { "copy": "Copiar", "download": "Baixar", "done": "Concluído", "next": "Próximo" },
"nav": { "security": "Segurança" },
"auth": {
  "mfa_rate_limited": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "mfa_challenge_expired": "Sua sessão expirou. Por favor, faça login novamente."
}
```

- [ ] **Step 5: Validate JSON syntax**

```bash
for f in public/locales/*/admin.json public/locales/*/common.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f', 'utf8'))" && echo "OK: $f" || echo "BAD: $f"
done
```

Expected: all "OK".

- [ ] **Step 6: Typecheck**

```bash
npm run build 2>&1 | tail -8
```

Expected: 0 TS errors.

- [ ] **Step 7: Commit**

```bash
git add public/locales/
git commit -m "chore(i18n): add security page translations for en-US, es-419, pt-BR

Closes i18n debt in security-page.tsx where 29 of 30 t() calls used inline
fallback strings. Adds admin:security.* subtree (30 keys) with translations
for:
- Two-factor authentication flow (enable/disable/regenerate)
- Password change + policy checklist (T2.3)
- Active sessions management (T2.1)
- Lockout banner
- MFA required banner (T0.5 enforcement)
- OIDC federated identity badge

Also adds missing status.enabled/disabled, actions.copy/download/done/next,
nav.security, and auth.mfa_rate_limited/mfa_challenge_expired keys to
common.json.

Sub C T1.3 — closes i18n debt."
```

---

## Task 13: T1.4 — User-menu "Security" link

**Files:**
- Modify: `src/shell/user-menu.tsx`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Read user-menu.tsx to understand the current structure**

```bash
cat src/shell/user-menu.tsx
```

Expected: base-ui `DropdownMenu` with theme submenu + logout button.

- [ ] **Step 2: Add the "Security" entry**

Add a new `<DropdownMenuItem>` between the Theme submenu and the Logout separator/button. Example diff:

```tsx
import { Lock, LogOut, Moon, Sun, Monitor } from 'lucide-react';  // add Lock
import { useNavigate } from 'react-router-dom';  // add if not present
// ... existing imports

export function UserMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();  // add
  // ... existing hooks

  return (
    <DropdownMenu>
      {/* existing trigger */}
      <DropdownMenuContent>
        {/* existing user label */}
        <DropdownMenuSeparator />
        {/* existing theme submenu */}
        <DropdownMenuItem
          onClick={() => navigate('/admin/security')}
          data-testid="user-menu-security"
        >
          <Lock className="mr-2 h-4 w-4" />
          {t('nav.security', 'Security')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* existing logout button */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

The exact structure depends on how base-ui's `DropdownMenu` is composed in this file. Follow the existing pattern — if Theme uses `DropdownMenuSub`, use `DropdownMenuItem` at the same level for Security.

- [ ] **Step 3: Typecheck**

```bash
npm run build 2>&1 | tail -8
```

Expected: 0 TS errors.

- [ ] **Step 4: Commit**

```bash
git add src/shell/user-menu.tsx
git commit -m "feat(shell): add Security link to user-menu dropdown

security-page was previously only reachable via the admin sidebar, which
required admin-level permissions to browse even though the route itself
has no PermissionGuard. Adding a user-menu entry makes self-service MFA
and password management discoverable to all authenticated users (agents,
supervisors, admins).

Sub C T1.4 — discoverability fix."
```

---

## Task 14: T1.5 — Apply usePasswordPolicy to reset-password-page.tsx

**Files:**
- Modify: `src/core/auth/reset-password-page.tsx`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Read the current reset-password-page.tsx**

```bash
cat src/core/auth/reset-password-page.tsx
```

Identify the hardcoded password checks (typically a block with `password.length >= 12`, `/[A-Z]/.test(password)`, etc.).

- [ ] **Step 2: Replace hardcoded checks with live policy checklist**

Import `usePasswordPolicy`:

```tsx
import { usePasswordPolicy } from '@/core/api/hooks/use-auth-admin';
```

Replace the hardcoded validation block with:

```tsx
const { data: policy } = usePasswordPolicy();
const effective = policy ?? {
  minLength: 12,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: false,
};

const checks = {
  length: newPassword.length >= effective.minLength,
  uppercase: !effective.requireUppercase || /[A-Z]/.test(newPassword),
  number: !effective.requireNumber || /[0-9]/.test(newPassword),
  special: !effective.requireSpecial || /[^a-zA-Z0-9]/.test(newPassword),
};
const allValid = Object.values(checks).every(Boolean);
```

Render the checklist (use the same strings as admin.json so keys can be reused):

```tsx
<ul className="space-y-1 text-sm">
  <li className={checks.length ? 'text-green-600' : 'text-muted-foreground'}>
    {checks.length ? '✓' : '○'} {t('admin:security.password_too_short', { n: effective.minLength })}
  </li>
  {effective.requireUppercase && (
    <li className={checks.uppercase ? 'text-green-600' : 'text-muted-foreground'}>
      {checks.uppercase ? '✓' : '○'} {t('admin:security.password_needs_uppercase')}
    </li>
  )}
  {effective.requireNumber && (
    <li className={checks.number ? 'text-green-600' : 'text-muted-foreground'}>
      {checks.number ? '✓' : '○'} {t('admin:security.password_needs_number')}
    </li>
  )}
  {effective.requireSpecial && (
    <li className={checks.special ? 'text-green-600' : 'text-muted-foreground'}>
      {checks.special ? '✓' : '○'} {t('admin:security.password_needs_special')}
    </li>
  )}
</ul>
```

Disable the submit button until `allValid`:

```tsx
<Button type="submit" disabled={!allValid || isPending}>
  {t('actions.reset_password', 'Reset Password')}
</Button>
```

- [ ] **Step 3: Typecheck**

```bash
npm run build 2>&1 | tail -8
```

Expected: 0 TS errors.

- [ ] **Step 4: Commit**

```bash
git add src/core/auth/reset-password-page.tsx
git commit -m "feat(auth): use live password policy in reset-password page

Replaces hardcoded password validation checks with usePasswordPolicy() hook
reading the tenant's actual policy. Policy loads asynchronously; falls back
to platform defaults if the hook errors. Checklist items render only for
enabled requirements (e.g., 'special character' hidden if not required).

Sub C T1.5 — closes inconsistency where change-password would use the
real policy but reset-password hardcoded checks that may or may not match."
```

---

## Task 15: T2.5 — Rewrite security-page.tsx

**Files:**
- Rewrite: `src/admin/profile/security-page.tsx`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

**Scope:** Full rewrite. The current file is 324 lines with mixed `customFetch` + `useState` + UI. The new file consumes `useMe`, the mutations from Task 11, `usePasswordPolicy`, and adds 3 edge-case handlers (OIDC, lockout, MFA required) + sessions card + recovery codes regeneration.

- [ ] **Step 1: Read the current file as reference for test-id preservation**

```bash
grep -n "data-testid" src/admin/profile/security-page.tsx
```

Preserve these data-testids in the rewrite:
- `security-mfa-status`
- `security-mfa-enable`, `security-mfa-disable`
- `security-mfa-qrcode`
- `security-mfa-next-verify`, `security-mfa-code`, `security-mfa-confirm`
- `security-mfa-recovery-codes`, `security-mfa-copy`, `security-mfa-download`, `security-mfa-done`
- `security-password-old`, `security-password-new`, `security-password-confirm`, `security-password-submit`
- `security-mfa-disable-password`, `security-mfa-disable-confirm`

Add new data-testids:
- `security-lockout-banner`
- `security-mfa-required-banner`
- `security-oidc-badge`
- `security-mfa-regenerate`
- `security-mfa-regenerate-confirm`
- `security-sessions-list`
- `security-sessions-revoke-others`
- `security-sessions-revoke-{tokenId}` (dynamic)
- `security-password-checklist`

- [ ] **Step 2: Write the new file**

Create/overwrite `src/admin/profile/security-page.tsx`:

```tsx
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield, ShieldCheck, Download, Copy, KeyRound, Lock, RefreshCw, LogOut as LogOutIcon,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Label } from '@/core/ui/label';
import { Badge } from '@/core/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/core/ui/dialog';
import { ConfirmDeleteDialog } from '@/core/ui/confirm-delete-dialog';
import { useMe, isLockedOut, type Me } from '@/core/api/hooks/use-me';
import {
  useSetupMfa, useConfirmMfa, useDisableMfa,
  useChangePassword,
  useMySessions, useRevokeSession, useRevokeOtherSessions,
  useRegenerateRecoveryCodes, usePasswordPolicy,
  type ActiveSession, type MfaSetupResponse,
} from '@/core/api/hooks/use-auth-admin';

export default function SecurityPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: me, isLoading: meLoading } = useMe();

  if (meLoading || !me) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <h1 className="font-heading text-2xl font-semibold">
          {t('admin:security.title')}
        </h1>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const locked = isLockedOut(me);
  const isOidc = me.authProvider === 'oidc';

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6" data-testid="security-page">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">
          {t('admin:security.title')}
        </h1>
        {isOidc && (
          <Badge variant="secondary" data-testid="security-oidc-badge">
            {t('admin:security.oidc_badge')}
          </Badge>
        )}
      </div>

      {locked && (
        <div
          className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          data-testid="security-lockout-banner"
        >
          {t('admin:security.account_locked', {
            time: new Date(me.lockedUntil!).toLocaleString(),
          })}
        </div>
      )}

      <MfaSection me={me} locked={locked} />
      {!isOidc && <PasswordSection locked={locked} />}
      <SessionsSection locked={locked} />
    </div>
  );
}

// ------------------------------------------------------------
// MFA section
// ------------------------------------------------------------

function MfaSection({ me, locked }: { me: Me; locked: boolean }) {
  const { t } = useTranslation(['admin', 'common']);
  const setupMfa = useSetupMfa();
  const confirmMfa = useConfirmMfa();
  const disableMfa = useDisableMfa();
  const regenerate = useRegenerateRecoveryCodes();

  const [setupData, setSetupData] = useState<MfaSetupResponse | null>(null);
  const [setupStep, setSetupStep] = useState<'idle' | 'qr' | 'verify' | 'codes'>('idle');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const [newCodes, setNewCodes] = useState<string[] | null>(null);

  // Determine if the tenant requires MFA for this user.
  // Since useMe does not return the tenant policy, we infer "required" from
  // the fact that the backend returns 403 on disable. The UI hides the button
  // preemptively by reading... actually, the useMe hook does not have this.
  // For v1.6.0, we rely on the backend 403 response and show a banner when
  // the user attempts to disable (optimistic): keep it simple by always
  // showing the disable button unless the mutation returns 403, then showing
  // the banner.
  // TODO(v1.7.0): add MfaPolicy to /users/me response so UI can hide proactively.
  const mfaRequired = false;  // best-effort v1.6.0 — relies on backend 403

  async function handleSetup() {
    const data = await setupMfa.mutateAsync();
    setSetupData(data);
    setSetupStep('qr');
  }

  async function handleConfirm() {
    await confirmMfa.mutateAsync(verifyCode);
    setSetupStep('codes');
    setVerifyCode('');
  }

  async function handleDisable() {
    await disableMfa.mutateAsync(disablePassword);
    setDisableOpen(false);
    setDisablePassword('');
  }

  async function handleRegenerate() {
    const res = await regenerate.mutateAsync(regeneratePassword);
    setNewCodes(res.recoveryCodes);
    setRegenerateOpen(false);
    setRegeneratePassword('');
  }

  function copyCodes(codes: string[]) {
    navigator.clipboard.writeText(codes.join('\n'));
  }

  function downloadCodes(codes: string[]) {
    const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {me.mfaEnabled ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" />
          )}
          <div>
            <h3 className="font-medium">{t('admin:security.mfa')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('admin:security.mfa_description')}
            </p>
          </div>
        </div>
        <Badge data-testid="security-mfa-status" variant={me.mfaEnabled ? 'default' : 'secondary'}>
          {me.mfaEnabled ? t('common:status.enabled') : t('common:status.disabled')}
        </Badge>
      </div>

      {!me.mfaEnabled && mfaRequired && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800"
          data-testid="security-mfa-required-banner"
        >
          {t('admin:security.mfa_required_banner')}{' '}
          {t('admin:security.mfa_required_enroll')}
        </div>
      )}

      {setupStep === 'idle' && !me.mfaEnabled && (
        <Button
          data-testid="security-mfa-enable"
          onClick={() => void handleSetup()}
          disabled={locked || setupMfa.isPending}
        >
          {t('admin:security.enable_mfa')}
        </Button>
      )}

      {setupStep === 'idle' && me.mfaEnabled && (
        <div className="flex gap-2">
          {!mfaRequired && (
            <Button
              data-testid="security-mfa-disable"
              variant="destructive"
              onClick={() => setDisableOpen(true)}
              disabled={locked}
            >
              {t('admin:security.disable_mfa')}
            </Button>
          )}
          <Button
            data-testid="security-mfa-regenerate"
            variant="outline"
            onClick={() => setRegenerateOpen(true)}
            disabled={locked}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            {t('admin:security.regenerate_recovery_codes')}
          </Button>
        </div>
      )}

      {/* Setup: QR code step */}
      {setupStep === 'qr' && setupData && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm">{t('admin:security.scan_qr')}</p>
          <div className="flex justify-center">
            <div
              data-testid="security-mfa-qrcode"
              className="rounded-lg border bg-white p-4"
            >
              <QRCodeSVG value={setupData.qrUri} size={192} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t('admin:security.manual_key')}
            </p>
            <code className="block rounded bg-muted px-3 py-2 text-sm font-mono break-all">
              {setupData.secret}
            </code>
          </div>
          <Button data-testid="security-mfa-next-verify" onClick={() => setSetupStep('verify')}>
            {t('common:actions.next')}
          </Button>
        </div>
      )}

      {/* Setup: Verify step */}
      {setupStep === 'verify' && (
        <div className="space-y-4 border-t pt-4">
          <p className="text-sm">{t('admin:security.enter_code')}</p>
          <div className="flex gap-2">
            <Input
              data-testid="security-mfa-code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              className="w-32 font-mono text-center"
            />
            <Button
              data-testid="security-mfa-confirm"
              onClick={() => void handleConfirm()}
              disabled={verifyCode.length !== 6 || confirmMfa.isPending}
            >
              {t('common:actions.verify', 'Verify')}
            </Button>
          </div>
        </div>
      )}

      {/* Setup: Recovery codes step (initial enrollment) */}
      {setupStep === 'codes' && setupData && (
        <RecoveryCodesDisplay
          codes={setupData.recoveryCodes}
          onDone={() => {
            setSetupStep('idle');
            setSetupData(null);
          }}
        />
      )}

      {/* Recovery codes regeneration result */}
      {newCodes && (
        <RecoveryCodesDisplay codes={newCodes} onDone={() => setNewCodes(null)} />
      )}

      {/* Disable MFA dialog */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:security.disable_mfa')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>{t('common:auth.password', 'Password')}</Label>
            <Input
              type="password"
              data-testid="security-mfa-disable-password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder={t('admin:security.confirm_password_to_disable')}
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('common:actions.cancel', 'Cancel')}
            </DialogClose>
            <Button
              data-testid="security-mfa-disable-confirm"
              variant="destructive"
              onClick={() => void handleDisable()}
              disabled={!disablePassword || disableMfa.isPending}
            >
              {t('admin:security.disable_mfa')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate recovery codes dialog */}
      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin:security.regenerate_recovery_codes')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('admin:security.regenerate_confirm')}
          </p>
          <Input
            type="password"
            value={regeneratePassword}
            onChange={(e) => setRegeneratePassword(e.target.value)}
            placeholder={t('common:auth.password', 'Password')}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {t('common:actions.cancel', 'Cancel')}
            </DialogClose>
            <Button
              data-testid="security-mfa-regenerate-confirm"
              onClick={() => void handleRegenerate()}
              disabled={!regeneratePassword || regenerate.isPending}
            >
              {t('admin:security.regenerate_recovery_codes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecoveryCodesDisplay({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const { t } = useTranslation(['admin', 'common']);
  return (
    <div className="space-y-4 border-t pt-4">
      <p className="text-sm font-medium text-amber-600">
        {t('admin:security.save_recovery_codes')}
      </p>
      <div
        data-testid="security-mfa-recovery-codes"
        className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4"
      >
        {codes.map((code, i) => (
          <code key={i} className="text-sm font-mono">{code}</code>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          data-testid="security-mfa-copy"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(codes.join('\n'));
          }}
        >
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          {t('common:actions.copy')}
        </Button>
        <Button
          data-testid="security-mfa-download"
          variant="outline"
          size="sm"
          onClick={() => {
            const blob = new Blob([codes.join('\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'recovery-codes.txt';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t('common:actions.download')}
        </Button>
      </div>
      <Button data-testid="security-mfa-done" onClick={onDone}>
        {t('common:actions.done')}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------
// Password section
// ------------------------------------------------------------

function PasswordSection({ locked }: { locked: boolean }) {
  const { t } = useTranslation(['admin', 'common']);
  const { data: policy } = usePasswordPolicy();
  const changePassword = useChangePassword();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const effective = policy ?? {
    minLength: 12,
    requireUppercase: true,
    requireNumber: true,
    requireSpecial: false,
  };

  const checks = useMemo(() => ({
    length: newPassword.length >= effective.minLength,
    uppercase: !effective.requireUppercase || /[A-Z]/.test(newPassword),
    number: !effective.requireNumber || /[0-9]/.test(newPassword),
    special: !effective.requireSpecial || /[^a-zA-Z0-9]/.test(newPassword),
    match: newPassword === confirmPassword && newPassword.length > 0,
  }), [newPassword, confirmPassword, effective]);

  const allValid = Object.values(checks).every(Boolean);

  async function handleSubmit() {
    await changePassword.mutateAsync({ oldPassword, newPassword });
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">{t('admin:security.change_password')}</h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label>{t('common:auth.current_password', 'Current Password')}</Label>
          <Input
            type="password"
            data-testid="security-password-old"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('common:auth.new_password', 'New Password')}</Label>
          <Input
            type="password"
            data-testid="security-password-new"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={locked}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('common:auth.confirm_password', 'Confirm Password')}</Label>
          <Input
            type="password"
            data-testid="security-password-confirm"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={locked}
          />
        </div>

        {/* Password policy checklist */}
        <div data-testid="security-password-checklist" className="space-y-1 rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">{t('admin:security.password_policy_title')}</p>
          <ul className="space-y-0.5">
            <li className={checks.length ? 'text-green-600' : 'text-muted-foreground'}>
              {checks.length ? '✓' : '○'} {t('admin:security.password_too_short', { n: effective.minLength })}
            </li>
            {effective.requireUppercase && (
              <li className={checks.uppercase ? 'text-green-600' : 'text-muted-foreground'}>
                {checks.uppercase ? '✓' : '○'} {t('admin:security.password_needs_uppercase')}
              </li>
            )}
            {effective.requireNumber && (
              <li className={checks.number ? 'text-green-600' : 'text-muted-foreground'}>
                {checks.number ? '✓' : '○'} {t('admin:security.password_needs_number')}
              </li>
            )}
            {effective.requireSpecial && (
              <li className={checks.special ? 'text-green-600' : 'text-muted-foreground'}>
                {checks.special ? '✓' : '○'} {t('admin:security.password_needs_special')}
              </li>
            )}
          </ul>
        </div>

        <Button
          data-testid="security-password-submit"
          onClick={() => void handleSubmit()}
          disabled={locked || !allValid || !oldPassword || changePassword.isPending}
        >
          {t('admin:security.change_password')}
        </Button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Sessions section
// ------------------------------------------------------------

function SessionsSection({ locked }: { locked: boolean }) {
  const { t } = useTranslation(['admin', 'common']);
  const { data: sessions, isLoading } = useMySessions();
  const revokeSession = useRevokeSession();
  const revokeOthers = useRevokeOtherSessions();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading sessions…</p>;
  }

  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-medium">{t('admin:security.active_sessions')}</h3>
      </div>

      <div data-testid="security-sessions-list" className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Device</th>
              <th className="px-3 py-2 text-left font-medium">IP</th>
              <th className="px-3 py-2 text-left font-medium">Created</th>
              <th className="w-24 px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(sessions ?? []).map((s) => (
              <SessionRow
                key={s.tokenId}
                session={s}
                onRevoke={() => void revokeSession.mutateAsync(s.tokenId)}
                locked={locked}
              />
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDeleteDialog
        trigger={
          <Button
            variant="destructive"
            data-testid="security-sessions-revoke-others"
            disabled={locked}
          >
            <LogOutIcon className="mr-1.5 h-4 w-4" />
            {t('admin:security.sign_out_others')}
          </Button>
        }
        title={t('admin:security.sign_out_others')}
        description=""
        onConfirm={() => void revokeOthers.mutateAsync()}
      />
    </div>
  );
}

function SessionRow({
  session, onRevoke, locked,
}: {
  session: ActiveSession;
  onRevoke: () => void;
  locked: boolean;
}) {
  const { t } = useTranslation(['admin', 'common']);
  const device = parseUserAgent(session.userAgent);
  const created = new Date(session.createdAt).toLocaleString();

  return (
    <tr className="border-b last:border-0 hover:bg-muted/30">
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          {device}
          {session.isCurrentSession && (
            <Badge variant="default" className="text-xs">
              {t('admin:security.this_session')}
            </Badge>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{session.ipAddress ?? '—'}</td>
      <td className="px-3 py-2 text-muted-foreground">{created}</td>
      <td className="px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          data-testid={`security-sessions-revoke-${session.tokenId}`}
          disabled={session.isCurrentSession || locked}
          onClick={onRevoke}
        >
          {t('admin:security.revoke_session')}
        </Button>
      </td>
    </tr>
  );
}

function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown';
  // Simple heuristic — enough for display
  const browser = /Chrome/.test(ua) ? 'Chrome'
    : /Firefox/.test(ua) ? 'Firefox'
    : /Safari/.test(ua) ? 'Safari'
    : /Edge/.test(ua) ? 'Edge'
    : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : 'Unknown OS';
  return `${browser} on ${os}`;
}
```

**Note on the `mfaRequired = false` line:** this is a deliberate v1.6.0 limitation. The `/users/me` response does not currently return the tenant's MFA policy, so the UI cannot proactively hide the Disable button. The backend will 403 if the disable is not allowed, and the user will see the toast error. The TODO comment in the code references v1.7.0 where `useMe` can be extended to include `tenantAuthPolicy` or a flag.

- [ ] **Step 3: Typecheck**

```bash
npm run build 2>&1 | tail -10
```

Expected: 0 TS errors.

- [ ] **Step 4: Visual sanity check (dev server)**

```bash
npm run dev &
sleep 3
# open http://localhost:5173/admin/security in browser, verify it renders
# kill the dev server when done
```

Verify:
- Page renders without blanking
- All 3 cards visible (MFA / Password / Sessions)
- Loading state shows before data arrives
- No console errors

- [ ] **Step 5: Commit**

```bash
git add src/admin/profile/security-page.tsx
git commit -m "refactor(security): rewrite security-page with cards, sessions, and policy

Full rewrite replacing 4 direct customFetch calls with TanStack Query
mutations from use-auth-admin. Adds 3 edge-case handlers:
- Lockout banner (reads me.lockedUntil)
- OIDC badge + hidden password card for federated users
- MFA required banner (infrastructure; v1.7.0 will make it proactive)

New sections:
- Sessions management table with current-session highlight, per-row revoke,
  and 'Sign out all other devices' with 3s confirm dialog
- Recovery codes regeneration button (password-gated)
- Live password policy checklist under new-password input

Closes the line 30 TODO by consuming useMe() for initial MFA state. All
data-testids from the original file are preserved; 9 new ones added for
the new components.

Sub C T2.5 — core deliverable."
```

---

## Task 16: Update security.spec.ts + add 4 new E2E tests

**Files:**
- Modify: `tests/e2e/tests/platform-admin/security.spec.ts`
- Modify: `tests/e2e/fixtures/api-helper.ts` (add helpers)

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Read the existing security.spec.ts**

```bash
cat tests/e2e/tests/platform-admin/security.spec.ts
```

Identify the 6 existing tests and how they use the fixture.

- [ ] **Step 2: Update existing tests to pre-seed MFA state**

Change tests that assert "Disabled" initial state to pre-seed a user without MFA, and add one that pre-seeds WITH MFA:

```ts
test('should show MFA disabled when user has no MFA configured', async ({ platformAdminPage: page }) => {
  // default test user has no MFA
  await page.goto('/admin/security');
  await expect(page.getByTestId('security-mfa-status')).toHaveText(/Disabled/i);
});

test('should show MFA enabled when user has MFA configured', async ({ platformAdminPage: page, apiHelper }) => {
  const email = `mfa-${Date.now()}@test.local`;
  await apiHelper.setupTestUserWithMfa(email, 'TestPassword123!');
  await apiHelper.loginAs(email, 'TestPassword123!');
  await page.goto('/admin/security');
  await expect(page.getByTestId('security-mfa-status')).toHaveText(/Enabled/i);
});
```

- [ ] **Step 3: Add 3 new tests for policy enforcement and regeneration**

```ts
test('should block MFA disable when tenant policy requires MFA', async ({ page, apiHelper }) => {
  // Setup: create a tenant with MfaPolicy=required_all, create user with MFA, log in
  await apiHelper.setTenantMfaPolicy('test-tenant', 'required_all');
  const email = `mfa-req-${Date.now()}@test.local`;
  await apiHelper.setupTestUserWithMfa(email, 'TestPassword123!');
  await apiHelper.loginAs(email, 'TestPassword123!');

  await page.goto('/admin/security');
  await page.getByTestId('security-mfa-disable').click();
  await page.getByTestId('security-mfa-disable-password').fill('TestPassword123!');
  await page.getByTestId('security-mfa-disable-confirm').click();

  // Expect toast error (or banner) rather than success
  await expect(page.getByText(/required by your organization/i)).toBeVisible();

  // Reset tenant policy
  await apiHelper.setTenantMfaPolicy('test-tenant', 'optional');
});

test('should regenerate recovery codes and show new codes', async ({ page, apiHelper }) => {
  const email = `mfa-regen-${Date.now()}@test.local`;
  const { recoveryCodes: oldCodes } = await apiHelper.setupTestUserWithMfa(email, 'TestPassword123!');
  await apiHelper.loginAs(email, 'TestPassword123!');

  await page.goto('/admin/security');
  await page.getByTestId('security-mfa-regenerate').click();
  await page.getByPlaceholder(/password/i).fill('TestPassword123!');
  await page.getByTestId('security-mfa-regenerate-confirm').click();

  // New codes should be visible and differ from old
  await expect(page.getByTestId('security-mfa-recovery-codes')).toBeVisible();
  const shownCodes = await page.getByTestId('security-mfa-recovery-codes').textContent();
  for (const oldCode of oldCodes) {
    expect(shownCodes).not.toContain(oldCode);
  }
});

test('should display password policy checklist with live validation', async ({ page }) => {
  await page.goto('/admin/security');
  await expect(page.getByTestId('security-password-checklist')).toBeVisible();

  const newInput = page.getByTestId('security-password-new');
  await newInput.fill('short');
  // At least one check should be unmet (○)
  await expect(page.getByTestId('security-password-checklist')).toContainText('○');

  await newInput.fill('LongEnoughPassword123!');
  // All checks should be met (✓)
  const checklistText = await page.getByTestId('security-password-checklist').textContent();
  expect(checklistText).not.toContain('○');
});
```

- [ ] **Step 4: Add the helper methods to api-helper.ts**

```ts
async setTenantMfaPolicy(tenantId: string, policy: 'optional' | 'required_all'): Promise<void> {
  await this.request.put(`/api/v1/admin/auth/config`, {
    headers: { 'X-Tenant-Id': tenantId },
    data: { mfaPolicy: policy },
  });
}

async loginAs(email: string, password: string): Promise<void> {
  const res = await this.request.post('/api/v1/auth/login', {
    data: { email, password, tenantId: this.tenantId },
  });
  const { accessToken, refreshToken } = await res.json();
  // Store tokens in a way the Playwright context can use them on next page.goto
  await this.page.context().addCookies([
    { name: 'refresh_token', value: refreshToken, url: this.baseUrl },
  ]);
  await this.page.evaluate((token) => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { accessToken: token } }));
  }, accessToken);
}
```

Note: `loginAs` is simplified — the actual token storage path depends on the Zustand persist config. Read `src/core/auth/auth-store.ts` to match the exact localStorage key and shape.

- [ ] **Step 5: Run E2E suite (demo env required)**

```bash
npx playwright test tests/e2e/tests/platform-admin/security.spec.ts
```

Expected: all pass. If demo env not running, defer to Task 18.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/tests/platform-admin/security.spec.ts tests/e2e/fixtures/api-helper.ts
git commit -m "test(security): update + add E2E tests for rewritten security-page

Updates 6 existing tests to work with real me.mfaEnabled state instead of
hardcoded false. Adds 4 new tests:
- Shows enabled badge when backend confirms MFA
- Blocks disable when tenant policy requires MFA
- Regenerates recovery codes with fresh values
- Displays live password policy checklist

ApiHelper gains setTenantMfaPolicy() and loginAs() helpers to support
tenant-level policy tests and mid-test login for different test users.

Sub C E2E coverage for T1.1/T2.2/T2.3/T0.5."
```

---

## Task 17: Add sessions.spec.ts

**Files:**
- Create: `tests/e2e/tests/platform-admin/sessions.spec.ts`

**Working directory:** `/media/Data/Source/IPcom/Asterisk.Platform.Web`

- [ ] **Step 1: Create the new spec file**

```ts
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Active Sessions', () => {
  test('should list active sessions for current user', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/security');
    await expect(page.getByTestId('security-sessions-list')).toBeVisible();

    // At minimum the current session should be listed
    const currentSessionBadge = page.getByText(/this session/i);
    await expect(currentSessionBadge).toBeVisible();
  });

  test('should revoke other sessions and preserve current session', async ({ platformAdminPage: page, apiHelper }) => {
    // Create a second session for the same user via API
    const secondSessionToken = await apiHelper.createAdditionalSession();

    await page.goto('/admin/security');
    await expect(page.getByTestId('security-sessions-list')).toBeVisible();

    // Click "Sign out all other devices" (3-second confirm dialog)
    await page.getByTestId('security-sessions-revoke-others').click();
    // ConfirmDeleteDialog pattern: wait 3s then click confirm
    await page.waitForTimeout(3100);
    await page.getByTestId('confirm-delete-btn').click();

    // Verify the extra session was revoked via API
    const sessions = await apiHelper.getUserSessions();
    expect(sessions.length).toBe(1);
    expect(sessions[0].isCurrentSession).toBe(true);
  });
});
```

- [ ] **Step 2: Add helper methods to api-helper.ts**

```ts
async createAdditionalSession(): Promise<string> {
  // Log in again as the same user to create a parallel refresh token
  const res = await this.request.post('/api/v1/auth/login', {
    data: { email: this.testUserEmail, password: this.testUserPassword, tenantId: this.tenantId },
  });
  const { refreshToken } = await res.json();
  return refreshToken;
}

async getUserSessions(): Promise<Array<{ tokenId: string; isCurrentSession: boolean }>> {
  const res = await this.request.get('/api/v1/auth/sessions', {
    headers: { Authorization: `Bearer ${this.accessToken}` },
  });
  return res.json();
}
```

Note: `this.testUserEmail` and `this.testUserPassword` should come from the existing fixture config. Check `tests/e2e/fixtures/auth.fixture.ts` for the actual property names.

- [ ] **Step 3: Run the spec (demo env required)**

```bash
npx playwright test tests/e2e/tests/platform-admin/sessions.spec.ts
```

Expected: 2 PASS. If demo env not running, defer to Task 18.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/tests/platform-admin/sessions.spec.ts tests/e2e/fixtures/api-helper.ts
git commit -m "test(sessions): add E2E coverage for user sessions management

New spec covering the 3 sessions endpoints:
- GET /auth/sessions — listing with current session badge
- POST /auth/sessions/revoke-others — preserves current, revokes others

2 tests, both requiring demo env backend. Uses createAdditionalSession()
helper to simulate a multi-device scenario.

Sub C E2E coverage for T2.1a."
```

---

## Task 18: Final verification + version bump

**Files:**
- Modify: `Directory.Build.props` (Asterisk.Platform repo only — bump to 1.5.1)

**Working directories:** both repos

- [ ] **Step 1: Backend — full build + test suite**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform
dotnet build Asterisk.Platform.slnx 2>&1 | tail -10
```

Expected: 0 errors, 0 warnings (TreatWarningsAsErrors is ON).

```bash
dotnet test Asterisk.Platform.slnx -v q 2>&1 | tail -20
```

Expected: all pass. Count should be ~1650 (was 1627).

- [ ] **Step 2: Frontend — full build + test suite**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform.Web
npm run build 2>&1 | tail -10
```

Expected: 0 TS errors.

```bash
npm run test 2>&1 | tail -10
```

Expected: 36 + 8 new = 44 unit tests passing.

```bash
npm run lint 2>&1 | tail -5
```

Expected: unchanged baseline (139 errors / 15 warnings pre-existing). No new lint errors from Sub C changes.

- [ ] **Step 3: Frontend — E2E suite (if demo env available)**

```bash
docker compose -f docker/demo/docker-compose.demo.yml up -d
sleep 30
npx playwright test tests/e2e/tests/platform-admin/security.spec.ts tests/e2e/tests/platform-admin/sessions.spec.ts tests/e2e/tests/platform-admin/login.spec.ts
```

Expected: all new and updated tests pass.

- [ ] **Step 4: Bump backend version**

Edit `/media/Data/Source/IPcom/Asterisk.Platform/Directory.Build.props`:

```xml
<PackageVersion>1.5.1</PackageVersion>
<!-- or whatever the version property is called -->
```

Also update `CLAUDE.md` if it references the version.

- [ ] **Step 5: Manual verification checklist (docker demo required)**

Run the manual checklist from the spec. Each item should work end-to-end:
- [ ] Login with MFA enabled → enter code → dashboard loads
- [ ] Login with MFA enabled → use recovery code → dashboard loads
- [ ] Open user-menu → "Security" entry visible → click → page loads
- [ ] Enable MFA → see QR → verify → see recovery codes → badge changes
- [ ] Regenerate recovery codes → enter password → see new codes
- [ ] Disable MFA with password → badge changes to Disabled
- [ ] Open sessions card → current session highlighted + revoke disabled
- [ ] Sign out all other devices → 3s confirm → only current remains
- [ ] Impersonate user → navigate to security → disable MFA button returns 403
- [ ] Receive notification in bell when MFA changes (cross-feature Sub A)

- [ ] **Step 6: Commit version bump and push both repos**

```bash
cd /media/Data/Source/IPcom/Asterisk.Platform
git add Directory.Build.props CLAUDE.md
git commit -m "chore: bump PackageVersion to 1.5.1 for Sub C security fixes"
git push origin main

cd /media/Data/Source/IPcom/Asterisk.Platform.Web
git push origin main
```

- [ ] **Step 7: Update memory files**

Update `/home/orion75/.claude/projects/-media-Data-Source-IPcom-Asterisk-Platform/memory/project_v160_production_polish.md`:
- Mark Sub C as COMPLETE with commit count and date
- List files changed

Update `/home/orion75/.claude/projects/-media-Data-Source-IPcom-Asterisk-Platform/memory/MEMORY.md`:
- Current Position: Sub C complete
- Next: Sub D (Onboarding Sync)

- [ ] **Step 8: Final summary to user**

Report the final state:
- Tasks completed: 18/18
- Commits: ~17 (count actual)
- Tests added: backend +23, frontend unit +8, E2E +7 new + 6 updated
- Files changed
- Versions: Platform v1.5.0 → v1.5.1, Platform.Web unchanged (stays 1.5.0 until all v1.6.0 sub-projects done)
- Known deferrals: MfaPolicy proactive UI hiding (v1.7.0), per-session LastActivityAt tracking (long-tail)

---

## Self-Review Checklist

Before marking the plan complete, the engineer (or subagent) verifies:

- [ ] All 18 tasks include real code (no "TODO" / "implement later")
- [ ] Every task has explicit file paths
- [ ] Every test step includes the assertion
- [ ] Every commit has a conventional-commits message
- [ ] Types are consistent across tasks (e.g., `Me` shape in Task 10 matches usage in Task 15)
- [ ] Backend tests use the NSubstitute/FluentAssertions pattern consistently
- [ ] Frontend tests use vitest + @testing-library/react + renderHook pattern consistently
- [ ] No task depends on an undefined helper (all `BuildX` / `apiHelper.X` helpers are either confirmed to exist or explicitly added in the same task)
- [ ] Notification emits (Task 9) correctly inject `INotificationService` and existing tests are updated to mock it
- [ ] Middleware extension (Task 1) correctly matches the exact path format used by the router (with `/api/v1/` prefix)
- [ ] i18n additions are syntactically valid JSON in all 3 locales

## Resume instructions (if execution pauses mid-plan)

If an executor needs to resume this plan after a break:

1. `cd /media/Data/Source/IPcom/Asterisk.Platform.Web && git log --oneline origin/main..HEAD` — check which commits exist
2. Compare to the task commit messages in this plan — each task has a distinctive `Sub C TX.Y` marker in the commit body
3. Resume at the first task whose commit is missing
4. Re-read the spec `docs/superpowers/specs/2026-04-10-v160-sub-c-security-page-design.md` if returning after significant time
5. Check memory `project_v160_production_polish.md` for any scope changes made mid-execution

## After Task 18

- Both repos pushed to origin/main
- v1.6.0 Sub C complete
- Move to **Sub D — Onboarding Sync** (wire setup wizard to `POST /setup`, wire `setup-banner.tsx` to `/admin/onboarding/status`)
- Memory updated with Sub C completion state
