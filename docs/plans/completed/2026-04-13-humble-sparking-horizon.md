# Platform + Web v1.7.0 — Version Alignment (SDK 1.8.0 + Pro 1.2.0-pro)

> **STATUS: COMPLETE 2026-04-13**
>
> - Platform: `962c17f` tag `v1.7.0` pushed to origin
> - Platform.Web: `1746d2f` tag `v1.7.0` + retroactive `v1.6.0` at `bb13cb5` pushed
> - SDK 1.7.0→1.8.0, Pro 1.1.4-pro→1.2.0-pro (19 version bumps)
> - 1636/1636 tests pass (inotify limit issue at 128 — environment, not regression)
> - 4 stale branches deleted (1 Platform + 3 Web)
> - Memory updated

## Context

After completing Pro SDK v1.2.0-pro (Phase 2 backplane), Platform still pins SDK at 1.7.0 and Pro at 1.1.4-pro. Platform already has v1.7.0 feature work pushed to main (Partner Portal API + SSE resilience) but version/tag are stuck at 1.6.0. Platform.Web has v1.6.0 work untagged and v1.7.0 (Partner Portal pages) also untagged.

**Goal:** Align all repos with latest releases, tag properly, clean stale branches.

## Current State

| Repo             | Version   | Tag        | SDK       | Pro           | Gap                                                 |
| ---------------- | --------- | ---------- | --------- | ------------- | --------------------------------------------------- |
| Sdk              | 1.8.0     | v1.8.0     | —         | —             | Branch `chore/docker-unify-realtime` (non-blocking) |
| Sdk.Pro          | 1.2.0-pro | v1.2.0-pro | 1.8.0     | —             | None                                                |
| **Platform**     | **1.6.0** | v1.6.0     | **1.7.0** | **1.1.4-pro** | SDK stale, Pro stale, version behind                |
| **Platform.Web** | 1.6.0     | **v1.5.0** | —         | —             | Missing v1.6.0 + v1.7.0 tags                        |

## Key Decisions

1. **Bump SDK to 1.8.0** — avoids diamond dependency (Pro 1.2.0-pro transitively depends on SDK 1.8.0)
2. **Bump Pro to 1.2.0-pro** — gets Pro.Push backplane, health checks, metrics, topic registry
3. **Do NOT add new Pro packages** (Pro.Push, Pro.Cluster.Redis, etc.) — deferred to v1.3.0-pro integration
4. **Single dep bump commit** — SDK + Pro together, they are a logical unit
5. **Platform.Web v1.6.0 tag at `bb13cb5`** — last commit before Partner Portal work

---

## Phase 0 — Pre-flight

Verify repos clean, NuGet feed has packages.

```sh
cd /media/Data/Source/Verbara/Asterisk.Platform && git status
cd /media/Data/Source/Verbara/Asterisk.Platform.Web && git status
ls /media/Data/Source/Verbara/local-nuget-feed/Asterisk.Sdk.Hosting.1.8.0.nupkg
ls /media/Data/Source/Verbara/local-nuget-feed/Asterisk.Sdk.Pro.EventStore.1.2.0-pro.nupkg
```

## Phase 1 — Platform Dependency Bump

**File:** `Directory.Packages.props`

| Line  | Package                    | From      | To        |
| ----- | -------------------------- | --------- | --------- |
| 30    | Asterisk.Sdk.Hosting       | 1.7.0     | 1.8.0     |
| 31    | Asterisk.Sdk.Push          | 1.7.0     | 1.8.0     |
| 35-51 | All 17 Asterisk.Sdk.Pro.\* | 1.1.4-pro | 1.2.0-pro |

**Actions:**

1. Edit `Directory.Packages.props` (19 version changes)
2. Clear NuGet cache: `dotnet nuget locals all --clear`
3. `dotnet restore`
4. `dotnet build -c Release` → 0 warnings, 0 errors
5. `dotnet test` → all pass

**Commit:** `chore(deps): bump Sdk to 1.8.0 and Pro to 1.2.0-pro`

## Phase 2 — Platform Version Bump + Tag

**Files:**

- `Directory.Build.props` line 28: `1.6.0` → `1.7.0`
- `tests/Asterisk.Platform.Api.Tests/ManagementSystemEndpointTests.cs` line 24: `"1.6.0"` → `"1.7.0"`

**Actions:**

1. Edit both files
2. `dotnet build -c Release` → verify
3. `dotnet test` → all 1636 pass (including version assertion test)
4. Commit: `chore(release): bump PackageVersion to 1.7.0`
5. Tag: `git tag -a v1.7.0 -m "v1.7.0 — Partner Portal API, SSE resilience, SDK 1.8.0 + Pro 1.2.0-pro"`
6. Push: `git push origin main && git push origin v1.7.0`

## Phase 3 — Platform.Web Tags + Version Bump

**Step 3a — Retroactive v1.6.0 tag:**

```sh
cd /media/Data/Source/Verbara/Asterisk.Platform.Web
git tag -a v1.6.0 bb13cb5 -m "v1.6.0 — notification center, security page, SSE resilience, E2E hardening"
```

**Step 3b — Bump + tag v1.7.0:**

- Edit `package.json` line 4: `"1.6.0"` → `"1.7.0"`
- Commit: `chore(release): bump version to 1.7.0`
- Tag: `git tag -a v1.7.0 -m "v1.7.0 — Partner Portal pages, hooks, permission gates"`
- Push: `git push origin main && git push origin v1.6.0 v1.7.0`

## Phase 4 — Cleanup

Delete stale local branches:

```sh
# Platform
cd /media/Data/Source/Verbara/Asterisk.Platform
git branch -d feat/plan-0.5-api-hardening

# Platform.Web
cd /media/Data/Source/Verbara/Asterisk.Platform.Web
git branch -d feat/plan2-admin-crud feat/plan3-agent-workspace feat/plan4-5-ops-analytics
```

Note: SDK branch `chore/docker-unify-realtime` — informational, separate cleanup.

## Phase 5 — Memory Updates

- Update `MEMORY.md` Platform version: 1.6.0 → 1.7.0, SDK 1.7.0 → 1.8.0, Pro 1.1.4-pro → 1.2.0-pro
- Update Platform.Web version: 1.6.0 → 1.7.0, tags list
- Mark this alignment as complete

---

## Verification

```sh
# Platform
cd /media/Data/Source/Verbara/Asterisk.Platform
git describe --tags                     # v1.7.0
grep PackageVersion Directory.Build.props   # 1.7.0
grep Sdk.Hosting Directory.Packages.props   # 1.8.0
grep Pro.EventStore Directory.Packages.props # 1.2.0-pro
dotnet test -v q                        # all pass

# Platform.Web
cd /media/Data/Source/Verbara/Asterisk.Platform.Web
git tag -l 'v1.*' --sort=-v:refname     # v1.7.0, v1.6.0, v1.5.0
head -5 package.json                    # 1.7.0
```

## Critical Files

| File                                                              | Change            |
| ----------------------------------------------------------------- | ----------------- |
| `Asterisk.Platform/Directory.Packages.props`                      | 19 version bumps  |
| `Asterisk.Platform/Directory.Build.props`                         | 1.6.0 → 1.7.0     |
| `Asterisk.Platform/tests/.../ManagementSystemEndpointTests.cs:24` | version assertion |
| `Asterisk.Platform.Web/package.json`                              | 1.6.0 → 1.7.0     |

## Risk Assessment

**Low overall.** Both SDK 1.8.0 and Pro 1.2.0-pro are additive-only releases. The 1636 test suite will catch any regression immediately. Platform does not use new SDK 1.8.0 features (ITopicRegistry, Push.AspNetCore) yet. Pro 1.2.0-pro adds Pro.Push but Platform doesn't reference it.

## Explicitly Deferred

- v1.3.0-pro (Phase 2 Part B): SignalR PlatformHub, CRDT Presence — separate sprint
- Hardening spec (20 Layer 1/2/3 tasks) — separate track
- Platform integration of Pro.Push backplane — needs SignalR hub first
- SDK branch `chore/docker-unify-realtime` cleanup — separate
