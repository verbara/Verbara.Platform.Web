---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Platform/ADR-0035
---

## Why

`openapi-typed-client` (archived 2026-07-12, Web PR#161) proved the swap-the-T mechanism and
migrated one hook slice (`useCsatQueueAnalytics` / `CsatResponseDto`) off a hand-written
interface onto the generated `src/core/api/generated/openapi.d.ts`. `openapi-typed-client-phase2`
(planning, archived as superseded) resolved that the remaining 61 hand-written hook files migrate
as **four per-module child changes**. This is the **Admin** child.

The Platform gate this migration once waited on is **LIVE**: Platform/ADR-0035 ("OpenAPI CI-export
contract", Accepted 2026-07-12) records the contract, and Platform `ci.yml`'s "Export OpenAPI
document (CI-runtime capture)" step boots the Api host, captures `/openapi/v1.json`, and verifies
it against the fixture via `scripts/verify-openapi-fixture.py`. The committed `openapi.d.ts` is
already generated from the real captured document (324 paths, 182 schemas), so this child has a
real, non-fixture-derived document to migrate against.

Every hand-written request/response interface in an Admin hook can silently drift from the real
Platform contract — the exact class of bug the csat-runner incident (Web PR#159, v3.13.1-web)
shipped. This child removes that risk for the Admin module by swapping hand-written interfaces for
the generated types, so `tsc -b` catches drift at compile time.

## What Changes

- **Migrate the 44 Admin-module hook files** in `src/core/api/hooks/` (199 hand-written
  request/response declarations) to consume the generated types from `openapi.d.ts` behind
  `client.ts`'s existing generic `<T>` (swap-the-T, no call-site plumbing), one file at a time.
  The full file list is in tasks.md.
- **Grep-and-update** any component prop / test import that referenced a now-removed hand-written
  interface, before deleting each old declaration (structural-vs-nominal swap discipline from the
  phase-1 design).
- **Numeric-coercion site gathering (Q3, from phase2):** this child additionally records every
  concrete `number | string` AOT-wire-union call site it encounters during migration, appended to
  the shared tally. The decision on whether to introduce a shared coercion helper is revisited
  once ≥3 genuine sites exist. **The tally already stands at 2** — `CsatResponseDto` (phase-1) and
  `CsatAggregateAnalyticsDto` (the archived `2026-07-14-csat-completion` change's "second concrete
  call site"), both in `use-analytics.ts` — so one more genuine site trips the threshold.
  `ai-credits-readout.tsx`'s `as number` casts are NOT an instance of this pattern (retro run 4)
  and do not count.
- No breaking changes to any migrated hook's public return type — each generated type is a
  structural match for the hand-written interface it replaces (or a thin coercion wrapper where a
  `number | string` union needs normalizing, mirroring the CSAT slice precedent).

## Capabilities

### Modified Capabilities

- `openapi-generated-types`: extends the migrated surface from the CSAT slice alone to the whole
  Admin module's hook files. The capability's mechanism is unchanged — this child only advances
  which hooks consume the generated types.

## Impact

- **Migrated hooks**: the 44 Admin-module files listed in tasks.md — hand-written interfaces
  removed, generated types consumed. No other module's hooks touched.
- **No new dependency, no new CI job**: the existing blocking `build` job (`tsc -b && vite build`)
  gates the generated types for free; `npm run generate:api-types` and `openapi.d.ts` already
  exist from phase-1.
- **No runtime behavior change**: swap-the-T is a compile-time-only change; a hook's resolved data
  shape is unchanged (structural match), so existing unit/E2E coverage exercises the same runtime.
- **Depends on**: nothing pending — the Platform document is already committed as `openapi.d.ts`
  (Platform/ADR-0035 gate is live).
- **Not in scope**: the Agent/Analytics/Operations modules (their own sibling children);
  `src/core/realtime/platform-hub.ts` (SignalR hub payloads — no REST paths, ADR-0020's deferred
  follow-up, owner: Pro); implementing a shared coercion helper (deferred to ≥3 genuine sites —
  this child only gathers sites).
