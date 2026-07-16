---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Platform/ADR-0035
---

## Why

`openapi-typed-client` (archived 2026-07-12, Web PR#161) proved the swap-the-T mechanism and
migrated the CSAT slice of `use-analytics.ts` (`useCsatQueueAnalytics` / `CsatResponseDto`) onto
the generated `src/core/api/generated/openapi.d.ts`. `openapi-typed-client-phase2` (archived as
superseded) resolved that the remaining hooks migrate as **four per-module child changes**. This
is the **Analytics** child — it completes the migration of `use-analytics.ts`'s remaining
hand-written declarations plus the other Analytics hooks.

The Platform gate is **LIVE**: Platform/ADR-0035 (Accepted 2026-07-12) + Platform `ci.yml`'s
"Export OpenAPI document (CI-runtime capture)" step ship the real document; the committed
`openapi.d.ts` is already generated from it (324 paths, 182 schemas).

## What Changes

- **Migrate the 4 Analytics-module hook files** in `src/core/api/hooks/` (43 hand-written
  request/response declarations, of which the CSAT slice in `use-analytics.ts` is already done)
  to consume the generated types behind `client.ts`'s generic `<T>` (swap-the-T). Full list in
  tasks.md. `use-analytics.ts` carries the bulk (34 declarations minus the migrated CSAT slice).
- **Grep-and-update** any component prop / test import referencing a removed hand-written interface
  before deleting each old declaration.
- **Preserve the existing CSAT coercions** — `use-analytics.ts` already normalizes both
  `CsatResponseDto`'s and `CsatAggregateAnalyticsDto`'s `number | string` unions via per-hook
  `select`s (the two genuine coercion sites tallied so far); do not regress either. Any further
  `number | string` union sites this child hits are reported to the shared tally (the Admin child
  owns the ≥3-genuine-sites helper decision — currently at 2 of 3).
- No breaking changes to any migrated hook's public return type — structural match, or a thin
  coercion wrapper where a `number | string` union needs normalizing (as the CSAT slice does).

## Capabilities

### Modified Capabilities

- `openapi-generated-types`: extends the migrated surface from the CSAT slice alone to the whole
  Analytics module. Mechanism unchanged.

## Impact

- **Migrated hooks**: the 4 Analytics-module files listed in tasks.md. No other module's hooks
  touched. The already-migrated CSAT slice in `use-analytics.ts` is preserved as-is.
- **No new dependency, no new CI job**: the existing blocking `build` job gates the generated types
  for free.
- **No runtime behavior change**: swap-the-T is compile-time-only.
- **Depends on**: nothing pending — the Platform document is already committed as `openapi.d.ts`.
- **Not in scope**: the Admin/Agent/Operations modules (sibling children);
  `src/core/realtime/platform-hub.ts` (SignalR — out of scope); implementing the shared coercion
  helper (the Admin child gathers sites; helper deferred to ≥3 genuine sites).
