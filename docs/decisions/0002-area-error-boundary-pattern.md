# ADR-0002: Per-area Error Boundaries

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Platform.Web maintainer
- **Related:** [`src/core/ui/area-error-boundary.tsx`](../../src/core/ui/area-error-boundary.tsx), [`src/core/ui/route-error-boundary.tsx`](../../src/core/ui/route-error-boundary.tsx), v1.13.37 commit `ad0cd93`

## Context

Until v1.13.37 the application had a single `RouteErrorBoundary` wired at the route level via React Router's `errorElement`. While this caught navigation errors, a render-time crash within a child component (e.g. a malformed data response in `/admin/cluster`) propagated past the route boundary in some cases and tumbled the entire app — including unrelated areas like `/agent`, the surface with the highest production traffic.

Audit findings showed only one boundary in the tree, no per-area isolation. A bug inside the admin cluster page could crash an active agent's conversation view in the same browser session.

The four high-level layouts (`admin`, `agent`, `analytics`, `operations`) are independent feature areas served by distinct teams of code. A failure in one should not affect the others.

## Decision

Wrap each layout shell with an `AreaErrorBoundary` (a class component, since hooks cannot be used in error boundaries):

- `src/pages/admin/admin-layout.tsx` → `<AreaErrorBoundary areaName="admin">`
- `src/pages/agent/agent-layout.tsx` → idem `agent`
- `src/pages/analytics/analytics-layout.tsx` → idem `analytics`
- `src/pages/operations/operations-layout.tsx` → idem `operations`

When a render-time error occurs inside an area, the boundary:
1. Renders a contextual fallback ("The {areaName} module failed to load. The rest of the app is still available.")
2. Provides "Try Again" (resets local error state) and "Go to Home" buttons.
3. Logs `Area error [${areaName}]:` to `console.error` (will integrate with Sentry in Track 1E).
4. Localizes the area name via `common:errors.area_names.${areaName}` with a default-value fallback.

`RouteErrorBoundary` is preserved at the route level for navigation errors (loader failures, 404s).

## Consequences

**Positive:**
- A crash in `/admin/cluster` no longer affects a logged-in agent's conversation view.
- Recovery is in-place via "Try Again" without full reload.
- Per-area logging gives clearer telemetry once Sentry is wired (`tag: area=admin`).

**Negative:**
- Slight code surface increase: 4 layout edits + 1 new component + 6 unit tests.
- Class-component pattern feels out of place in a hooks-first codebase, but is mandatory for error boundaries (React limitation).

**Trade-off:**
- Boundaries swallow errors that would otherwise crash loudly. Mitigation: `console.error` always fires, and Track 1E (Sentry) will report them remotely. The fallback UI also surfaces `error.message` to the user, so silent failures are unlikely.

## Alternatives considered

- **Single boundary at app shell level:** rejected — would not isolate areas from each other.
- **`react-error-boundary` library:** considered. Reasonable, but the existing `RouteErrorBoundary` already established the in-house class-component pattern with i18n integration. Adding a dependency for one component is overkill; copying the pattern keeps the codebase consistent.
- **Per-page boundaries (one per route):** rejected — too granular, more code, and the failure mode it solves (cross-area corruption) is rare. Per-area is the right granularity.
