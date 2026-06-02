# Codec Selector — Backend Implementation Plan (`Verbara.Platform`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo for ALL tasks below:** `/media/Data/Source/Verbara/Verbara.Platform` (NOT the Web repo). This is the backend half of the cross-cutting codec-selector track; the frontend half is in `2026-06-02-codec-selector-frontend.md`.

**Goal:** Add a server-driven codec catalog endpoint (`GET /api/v1/admin/voice/codecs`) that reports the codecs Asterisk actually has loaded, plus save-time validation that rejects bogus codec tokens on trunk and endpoint-profile writes.

**Architecture:** A new `KnownCodecs` static (token allowlist + tolerant `core show codecs` parser + fallback catalog) backs both the new metadata endpoint and the validation. The endpoint is AMI-leader-gated exactly like `TrunkConnectivityTester`; if this pod isn't the AMI owner or Asterisk is unreachable, it returns a static fallback so the UI never breaks. Validation is inserted into the existing trunk and profile create/update handlers before the `Codecs` field is assigned.

**Tech Stack:** .NET 10, Native AOT (no reflection — source-gen JSON + `[LoggerMessage]`), Minimal APIs, `Verbara.Sdk.Ami` (`CommandAction`/`CommandResponse`), xUnit + `WebApplicationFactory`.

**Spec:** [`docs/specs/2026-06-02-codec-selector-server-driven-design.md`](../../specs/2026-06-02-codec-selector-server-driven-design.md) (in the Web repo).

**Reference files to read first (Platform repo):**

- `src/Verbara.Platform.Api/Services/TrunkConnectivityTester.cs` — AMI-leader gating + `SendActionAsync<CommandResponse>` pattern (mirror its `using` directives).
- `src/Verbara.Platform.Api/Endpoints/TrunkEndpoints.cs` — endpoint group + create/update handlers + request DTOs.
- `src/Verbara.Platform.Api/Endpoints/RealtimeEndpoints.cs` — profile create/update handlers (codec field ~line 84).
- `src/Verbara.Platform.Api/Serialization/ApiJsonContext.cs` — source-gen JSON registrations.
- `src/Verbara.Platform.Api/Program.cs:~1488` — where `v1.MapTrunkEndpoints()` is called.
- `tests/Verbara.Platform.Api.Tests/TrunkEndpointsTests.cs` + `AuthenticatedPlatformApiFactory.cs` — test harness (AMI is auto-stubbed; the test pod is **not** AMI leader, so the endpoint returns the fallback catalog under test).

---

## Task 1: `KnownCodecs` — token allowlist, parser, fallback catalog

**Files:**

- Create: `src/Verbara.Platform.Api/Voice/KnownCodecs.cs`
- Test: `tests/Verbara.Platform.Api.Tests/Voice/KnownCodecsTests.cs`

- [ ] **Step 1: Write the failing tests**

Create `tests/Verbara.Platform.Api.Tests/Voice/KnownCodecsTests.cs`:

```csharp
using Verbara.Platform.Api.Voice;

namespace Verbara.Platform.Api.Tests.Voice;

public sealed class KnownCodecsTests
{
    [Fact]
    public void InvalidTokens_ShouldReturnEmpty_WhenAllTokensKnown()
    {
        KnownCodecs.InvalidTokens("ulaw,alaw,g722").Should().BeEmpty();
    }

    [Fact]
    public void InvalidTokens_ShouldReturnEmpty_WhenStringNullOrBlank()
    {
        KnownCodecs.InvalidTokens(null).Should().BeEmpty();
        KnownCodecs.InvalidTokens("  ").Should().BeEmpty();
    }

    [Fact]
    public void InvalidTokens_ShouldReturnOffenders_WhenTokenMisspelled()
    {
        KnownCodecs.InvalidTokens("ulaw,ulwa,g722").Should().ContainSingle().Which.Should().Be("ulwa");
    }

    [Fact]
    public void InvalidTokens_ShouldBeCaseInsensitiveAndTrim()
    {
        KnownCodecs.InvalidTokens(" ULAW , Opus ").Should().BeEmpty();
    }

    [Fact]
    public void ParseInstalledCodecs_ShouldExtractKnownTokens_FromTabularOutput()
    {
        const string output = """
            ID   TYPE   NAME      FORMAT   DESCRIPTION
            0    audio  ulaw      ulaw     G.711 u-law
            1    audio  alaw      alaw     G.711 a-law
            2    audio  g722      g722     G.722
            3    audio  slin      slin     Signed Linear PCM (8kHz)
            100  video  vp8       vp8      VP8 video
            """;

        var codecs = KnownCodecs.ParseInstalledCodecs(output);

        codecs.Should().Equal("ulaw", "alaw", "g722", "vp8"); // slin filtered (not negotiable)
    }

    [Fact]
    public void ParseInstalledCodecs_ShouldReturnEmpty_WhenOutputBlank()
    {
        KnownCodecs.ParseInstalledCodecs("").Should().BeEmpty();
    }

    [Fact]
    public void FallbackCatalog_ShouldContainCommonCodecs()
    {
        KnownCodecs.FallbackCatalog.Should().Contain(new[] { "ulaw", "alaw", "g722", "opus" });
    }
}
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/Verbara.Platform.Api.Tests --filter "FullyQualifiedName~KnownCodecsTests"`
Expected: FAIL — `KnownCodecs` does not exist (compile error).

- [ ] **Step 3: Write the implementation**

Create `src/Verbara.Platform.Api/Voice/KnownCodecs.cs`:

```csharp
namespace Verbara.Platform.Api.Voice;

/// <summary>
/// The set of Asterisk/PJSIP codec tokens the platform recognises, plus a tolerant parser for
/// <c>core show codecs</c> output and a static fallback catalog used when Asterisk cannot be queried.
/// Token strings are load-bearing — they map 1:1 to PJSIP <c>allow=</c> values.
/// </summary>
internal static class KnownCodecs
{
    /// <summary>Every negotiable audio + video codec token we recognise (validation allowlist).</summary>
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        // audio
        "ulaw", "alaw", "g722", "opus", "g729", "gsm", "ilbc", "g726", "g726aal2", "adpcm",
        "speex", "speex16", "siren7", "siren14", "g719", "g723", "lpc10", "silk",
        // video
        "vp8", "vp9", "h264", "h263p", "h263", "h261", "mpeg4",
    };

    /// <summary>Returned when Asterisk cannot be queried (not AMI leader / unreachable / parse empty).</summary>
    public static readonly string[] FallbackCatalog =
    [
        "ulaw", "alaw", "g722", "opus", "g729", "gsm", "ilbc", "vp8", "h264",
    ];

    /// <summary>
    /// Extracts recognised codec tokens from raw <c>core show codecs</c> output. Tolerant of column
    /// layout differences across Asterisk versions: it tokenises every line and keeps only tokens that
    /// match <see cref="All"/> (so headers, descriptions, IDs and non-negotiable formats like
    /// <c>slin</c>/<c>wav</c> are naturally ignored). Preserves first-seen order, de-duplicates.
    /// </summary>
    public static string[] ParseInstalledCodecs(string? amiOutput)
    {
        if (string.IsNullOrWhiteSpace(amiOutput))
            return [];

        var found = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in amiOutput.Split('\n'))
        {
            foreach (var raw in line.Split([' ', '\t', '\r'], StringSplitOptions.RemoveEmptyEntries))
            {
                var token = raw.Trim();
                if (All.Contains(token) && seen.Add(token))
                    found.Add(token.ToLowerInvariant());
            }
        }

        return [.. found];
    }

    /// <summary>Returns the tokens in a comma-separated codec string that are NOT recognised (typos).</summary>
    public static IReadOnlyList<string> InvalidTokens(string? codecs)
    {
        if (string.IsNullOrWhiteSpace(codecs))
            return [];

        return [.. codecs
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(t => !All.Contains(t))];
    }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test tests/Verbara.Platform.Api.Tests --filter "FullyQualifiedName~KnownCodecsTests"`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/Verbara.Platform.Api/Voice/KnownCodecs.cs tests/Verbara.Platform.Api.Tests/Voice/KnownCodecsTests.cs
git commit -m "feat(voice): add KnownCodecs allowlist + core-show-codecs parser"
```

---

## Task 2: `VoiceCodecsResponse` + `CodecValidationError` records registered in `ApiJsonContext`

**Files:**

- Create: `src/Verbara.Platform.Api/Voice/VoiceCodecsResponse.cs`
- Modify: `src/Verbara.Platform.Api/Serialization/ApiJsonContext.cs` (add two `[JsonSerializable]` lines near the other Trunk types, ~line 140)

- [ ] **Step 1: Create the response + error records**

Create `src/Verbara.Platform.Api/Voice/VoiceCodecsResponse.cs`:

```csharp
namespace Verbara.Platform.Api.Voice;

/// <summary>
/// Codec catalog returned by <c>GET /api/v1/admin/voice/codecs</c>.
/// <paramref name="Source"/> is <c>"asterisk"</c> when the list came from a live <c>core show codecs</c>
/// query, or <c>"fallback"</c> when Asterisk could not be reached (static catalog).
/// </summary>
internal sealed record VoiceCodecsResponse(string Source, string[] Codecs);

/// <summary>400 body returned when a trunk/profile write contains unrecognised codec tokens.</summary>
internal sealed record CodecValidationError(string[] InvalidCodecs);
```

- [ ] **Step 2: Register both in `ApiJsonContext.cs`**

Add these lines alongside the existing Trunk-related `[JsonSerializable]` attributes (around line 140):

```csharp
[JsonSerializable(typeof(VoiceCodecsResponse))]
[JsonSerializable(typeof(CodecValidationError))]
```

Add the namespace import at the top of `ApiJsonContext.cs` if not already covered:

```csharp
using Verbara.Platform.Api.Voice;
```

- [ ] **Step 3: Build to verify the source generator accepts the new types**

Run: `dotnet build src/Verbara.Platform.Api`
Expected: Build succeeds, 0 warnings (TreatWarningsAsErrors is on).

- [ ] **Step 4: Commit**

```bash
git add src/Verbara.Platform.Api/Voice/VoiceCodecsResponse.cs src/Verbara.Platform.Api/Serialization/ApiJsonContext.cs
git commit -m "feat(voice): add codec DTO + validation-error records to ApiJsonContext"
```

---

## Task 3: `GET /api/v1/admin/voice/codecs` endpoint (AMI-gated + fallback)

**Files:**

- Create: `src/Verbara.Platform.Api/Endpoints/VoiceMetadataEndpoints.cs`
- Modify: `src/Verbara.Platform.Api/Program.cs` (add `v1.MapVoiceMetadataEndpoints();` next to `v1.MapTrunkEndpoints();`)
- Test: `tests/Verbara.Platform.Api.Tests/VoiceMetadataEndpointsTests.cs`

- [ ] **Step 1: Write the failing test**

Create `tests/Verbara.Platform.Api.Tests/VoiceMetadataEndpointsTests.cs`:

```csharp
using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;

namespace Verbara.Platform.Api.Tests;

/// <summary>
/// The test factory pod is NOT the AMI leader (hosted services are stubbed), so the endpoint must
/// return the static fallback catalog with <c>source = "fallback"</c> — exercising the degradation path.
/// </summary>
public sealed class VoiceMetadataEndpointsTests : IClassFixture<AuthenticatedPlatformApiFactory>
{
    private readonly HttpClient _admin;

    public VoiceMetadataEndpointsTests(AuthenticatedPlatformApiFactory adminFactory)
    {
        _admin = adminFactory.CreateAuthenticatedClient();
    }

    [Fact]
    public async Task GetCodecs_ShouldReturnFallbackCatalog_WhenNotAmiLeader()
    {
        var response = await _admin.GetAsync("/api/v1/admin/voice/codecs");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var json = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
        json["source"]!.GetValue<string>().Should().Be("fallback");
        var codecs = json["codecs"]!.AsArray().Select(n => n!.GetValue<string>()).ToList();
        codecs.Should().Contain(new[] { "ulaw", "alaw", "g722", "opus" });
    }
}
```

> The `AdminOnly` authorization gate is structural (the group uses `.RequireAuthorization("AdminOnly")`, mirroring `TrunkEndpoints`); the existing trunk endpoint tests already exercise the auth harness, so no separate 401 test is added here (the in-memory test pod auto-authenticates via the factory).

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test tests/Verbara.Platform.Api.Tests --filter "FullyQualifiedName~VoiceMetadataEndpointsTests"`
Expected: FAIL — route returns 404 (endpoint not mapped).

- [ ] **Step 3: Write the endpoint**

Create `src/Verbara.Platform.Api/Endpoints/VoiceMetadataEndpoints.cs`. **Copy the `using` directives for `VerbaraServerPool`, `IClusterLeader`, `VoiceLeaderResources`, `CommandAction`, `CommandResponse`, and `[FromKeyedServices]` from the top of `TrunkConnectivityTester.cs`** (they live in the SDK/Pro namespaces):

```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Verbara.Platform.Api.Voice;
// ↓ mirror these from TrunkConnectivityTester.cs:
//   using Verbara.Sdk.Ami.Actions;       (CommandAction)
//   using Verbara.Sdk.Ami.Responses;     (CommandResponse)
//   using Verbara.Sdk.* / Pro.*          (VerbaraServerPool, IClusterLeader, VoiceLeaderResources)

namespace Verbara.Platform.Api.Endpoints;

internal static partial class VoiceMetadataEndpoints
{
    public static void MapVoiceMetadataEndpoints(this IEndpointRouteBuilder app)
    {
        var voice = app.MapGroup("/admin/voice")
            .RequireAuthorization("AdminOnly")
            .RequireOperationalTenant();

        voice.MapGet("/codecs", ListCodecs);
    }

    /// <summary>
    /// Returns the codecs Asterisk has loaded (<c>core show codecs</c> via AMI). Leader-gated like
    /// <see cref="Services.TrunkConnectivityTester"/>: a follower pod or an unreachable Asterisk yields
    /// the static fallback catalog rather than an error, so the admin UI always has a usable list.
    /// </summary>
    private static async Task<IResult> ListCodecs(
        VerbaraServerPool serverPool,
        [FromKeyedServices(VoiceLeaderResources.AmiOwner)] IClusterLeader leader,
        ILoggerFactory loggerFactory,
        CancellationToken ct)
    {
        var logger = loggerFactory.CreateLogger("VoiceMetadataEndpoints");

        if (!leader.IsLeader)
            return Results.Ok(new VoiceCodecsResponse("fallback", KnownCodecs.FallbackCatalog));

        var server = serverPool.GetServer("primary");
        if (server is null)
            return Results.Ok(new VoiceCodecsResponse("fallback", KnownCodecs.FallbackCatalog));

        try
        {
            var response = await server.Connection
                .SendActionAsync<CommandResponse>(new CommandAction { Command = "core show codecs" }, ct)
                .ConfigureAwait(false);

            var installed = KnownCodecs.ParseInstalledCodecs(response.Output);
            return installed.Length > 0
                ? Results.Ok(new VoiceCodecsResponse("asterisk", installed))
                : Results.Ok(new VoiceCodecsResponse("fallback", KnownCodecs.FallbackCatalog));
        }
        catch (Exception ex)
        {
            LogCodecQueryFailed(logger, ex);
            return Results.Ok(new VoiceCodecsResponse("fallback", KnownCodecs.FallbackCatalog));
        }
    }

    [LoggerMessage(Level = LogLevel.Warning,
        Message = "Failed to query Asterisk codecs via AMI; returning fallback catalog.")]
    private static partial void LogCodecQueryFailed(ILogger logger, Exception ex);
}
```

- [ ] **Step 4: Register the endpoint in `Program.cs`**

Find `v1.MapTrunkEndpoints();` (~line 1488) and add immediately after it:

```csharp
v1.MapVoiceMetadataEndpoints();
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `dotnet test tests/Verbara.Platform.Api.Tests --filter "FullyQualifiedName~VoiceMetadataEndpointsTests"`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/Verbara.Platform.Api/Endpoints/VoiceMetadataEndpoints.cs src/Verbara.Platform.Api/Program.cs tests/Verbara.Platform.Api.Tests/VoiceMetadataEndpointsTests.cs
git commit -m "feat(voice): add GET /admin/voice/codecs server-driven codec catalog endpoint"
```

---

## Task 4: Codec validation on trunk create + update

**Files:**

- Modify: `src/Verbara.Platform.Api/Endpoints/TrunkEndpoints.cs` (Create handler ~line 49-90; Update handler ~line 92-141)
- Test: `tests/Verbara.Platform.Api.Tests/TrunkEndpointsTests.cs` (add tests to the existing class)

- [ ] **Step 1: Write the failing tests**

Add to `tests/Verbara.Platform.Api.Tests/TrunkEndpointsTests.cs` (the class already has a `TrunkBody` helper that sets `codecs = "ulaw,alaw"`):

```csharp
[Fact]
public async Task CreateTrunk_ShouldReturn400_WhenCodecTokenInvalid()
{
    var body = new
    {
        name = "carrier-badcodec",
        displayName = (string?)null,
        type = "pjsip",
        isActive = true,
        maxChannels = 10,
        transport = "transport-udp",
        codecs = "ulaw,ulwa",            // ulwa is a typo
        authUsername = (string?)null,
        authPassword = (string?)null,
        registrationUri = (string?)null,
        clientUri = (string?)null,
        context = "from-trunk",
        matchHost = (string?)null,
    };

    var response = await _admin.PostAsJsonAsync("/api/v1/admin/trunks", body);

    response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    var json = JsonNode.Parse(await response.Content.ReadAsStringAsync())!;
    json["invalidCodecs"]!.AsArray().Select(n => n!.GetValue<string>()).Should().ContainSingle()
        .Which.Should().Be("ulwa");
}

[Fact]
public async Task CreateTrunk_ShouldSucceed_WhenCodecsValid()
{
    var create = await _admin.PostAsJsonAsync(
        "/api/v1/admin/trunks", TrunkBody("carrier-goodcodec", null));
    create.StatusCode.Should().Be(HttpStatusCode.Created);
}
```

- [ ] **Step 2: Run the tests to verify the 400 test fails**

Run: `dotnet test tests/Verbara.Platform.Api.Tests --filter "FullyQualifiedName~CreateTrunk_ShouldReturn400_WhenCodecTokenInvalid"`
Expected: FAIL — currently returns `201 Created` (no validation).

- [ ] **Step 3: Add validation to the Create handler**

In `TrunkEndpoints.cs` `CreateTrunk`, immediately after the existing `MatchHost` validation (`if (!string.IsNullOrEmpty(body.MatchHost) && !IsValidMatchHost(body.MatchHost)) return Results.BadRequest();`) and **before** `var trunk = new Trunk`:

```csharp
var invalidCodecs = KnownCodecs.InvalidTokens(body.Codecs);
if (invalidCodecs.Count > 0)
    return Results.BadRequest(new CodecValidationError([.. invalidCodecs]));
```

- [ ] **Step 4: Add validation to the Update handler**

In `UpdateTrunk`, replace the existing line `if (body.Codecs is not null) trunk.Codecs = body.Codecs;` (~line 113) with:

```csharp
if (body.Codecs is not null)
{
    var invalidCodecs = KnownCodecs.InvalidTokens(body.Codecs);
    if (invalidCodecs.Count > 0)
        return Results.BadRequest(new CodecValidationError([.. invalidCodecs]));
    trunk.Codecs = body.Codecs;
}
```

- [ ] **Step 5: Add the `using` for `KnownCodecs`/`CodecValidationError`**

At the top of `TrunkEndpoints.cs`, add:

```csharp
using Verbara.Platform.Api.Voice;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `dotnet test tests/Verbara.Platform.Api.Tests --filter "FullyQualifiedName~TrunkEndpointsTests"`
Expected: PASS (existing MatchHost tests + the 2 new codec tests).

- [ ] **Step 7: Commit**

```bash
git add src/Verbara.Platform.Api/Endpoints/TrunkEndpoints.cs tests/Verbara.Platform.Api.Tests/TrunkEndpointsTests.cs
git commit -m "feat(voice): reject unknown codec tokens on trunk create/update"
```

---

## Task 5: Codec validation on endpoint-profile create + update

**Files:**

- Modify: `src/Verbara.Platform.Api/Endpoints/RealtimeEndpoints.cs` (Create handler ~line 79-94; the Update handler in the same file)
- Test: `tests/Verbara.Platform.Api.Tests/RealtimeEndpointsTests.cs` (create if it doesn't exist; otherwise add to it)

- [ ] **Step 1: Locate the profile handlers**

Read `src/Verbara.Platform.Api/Endpoints/RealtimeEndpoints.cs`. The Create handler assigns `Codecs = body.Codecs ?? "ulaw,alaw,g722"` (~line 84). Find the matching Update handler (assigns `profile.Codecs` from `body.Codecs`). Note the request DTO type names (e.g. `CreateProfileRequest` / `UpdateProfileRequest`) and the route prefix (e.g. `/admin/realtime/profiles`).

- [ ] **Step 2: Write the failing test**

Add to `tests/Verbara.Platform.Api.Tests/RealtimeEndpointsTests.cs` (mirror the trunk test; adjust the request body shape and route to match the DTO observed in Step 1):

```csharp
[Fact]
public async Task CreateProfile_ShouldReturn400_WhenCodecTokenInvalid()
{
    var body = new
    {
        name = "agent-badcodec",
        type = "agent",
        transport = (string?)null,
        codecs = "opus,ulwa",          // typo
        webrtc = true,
        maxContacts = 1,
        directMedia = false,
        context = (string?)null,
        qualifyFrequency = 30,
    };

    var response = await _admin.PostAsJsonAsync("/api/v1/admin/realtime/profiles", body);

    response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    JsonNode.Parse(await response.Content.ReadAsStringAsync())!["invalidCodecs"]!.AsArray()
        .Select(n => n!.GetValue<string>()).Should().Contain("ulwa");
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `dotnet test tests/Verbara.Platform.Api.Tests --filter "FullyQualifiedName~CreateProfile_ShouldReturn400_WhenCodecTokenInvalid"`
Expected: FAIL — currently `201/200` (no validation).

- [ ] **Step 4: Add validation to the profile Create handler**

In `RealtimeEndpoints.cs` Create handler, **before** `var profile = new EndpointProfile`:

```csharp
var invalidCodecs = KnownCodecs.InvalidTokens(body.Codecs);
if (invalidCodecs.Count > 0)
    return Results.BadRequest(new CodecValidationError([.. invalidCodecs]));
```

- [ ] **Step 5: Add validation to the profile Update handler**

Wrap the codec assignment in the Update handler the same way as the trunk Update (only validate when `body.Codecs` is non-null), returning `Results.BadRequest(new CodecValidationError(...))` on offenders.

- [ ] **Step 6: Add the `using`**

At the top of `RealtimeEndpoints.cs`:

```csharp
using Verbara.Platform.Api.Voice;
```

- [ ] **Step 7: Run the full backend test suite**

Run: `dotnet test tests/Verbara.Platform.Api.Tests`
Expected: PASS (1,180+ existing tests stay green + the new codec tests).

- [ ] **Step 8: Commit**

```bash
git add src/Verbara.Platform.Api/Endpoints/RealtimeEndpoints.cs tests/Verbara.Platform.Api.Tests/RealtimeEndpointsTests.cs
git commit -m "feat(voice): reject unknown codec tokens on endpoint-profile create/update"
```

---

## Final verification

- [ ] **Build (AOT-clean, zero warnings):**

Run: `dotnet build -c Release`
Expected: Build succeeded, 0 warnings.

- [ ] **Full test suite green:**

Run: `dotnet test`
Expected: All pass.

- [ ] **Deploy/publish** so the Web frontend's `useVoiceCodecs()` can reach `GET /api/v1/admin/voice/codecs`. (Until deployed, the Web side degrades to its own fallback catalog automatically — the two halves are decoupled.)

---

## Spec coverage check (this plan ↔ spec "Backend" acceptance)

- ✅ `GET /api/v1/admin/voice/codecs`, `VoiceCodecsResponse { Source, Codecs }`, `ApiJsonContext`, `AdminOnly` gate → Tasks 2, 3.
- ✅ AMI-leader-gated `core show codecs` + non-negotiable filtering (`slin*`/`wav`/etc. ignored by the intersect-with-`All` parser) → Tasks 1, 3.
- ✅ Fallback on no-leader / unavailable / parse-empty, never 5xx → Task 3.
- ✅ Shared known-codec token set → Task 1 (`KnownCodecs.All`).
- ✅ Save-time validation: unknown token → 400 with `CodecValidationError`; valid-but-not-installed accepted (we validate against `All`, not the installed set, so a valid token the server lacks still saves) → Tasks 4, 5.
- ✅ Existing rows not re-validated unless edited (Update only validates when `body.Codecs is not null`) → Tasks 4, 5.
- ✅ Tests: parser, format filtering, fallback path, 400 on bogus token → Tasks 1, 3, 4, 5.
