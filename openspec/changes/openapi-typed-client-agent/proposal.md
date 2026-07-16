---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Platform/ADR-0035
---

## Why

`openapi-typed-client` (archived 2026-07-12, Web PR#161) proved the swap-the-T mechanism and
migrated the CSAT slice onto the generated `src/core/api/generated/openapi.d.ts`.
`openapi-typed-client-phase2` (archived as superseded) resolved that the remaining hooks migrate
as **four per-module child changes**. This is the **Agent** child.

The Platform gate is **LIVE**: Platform/ADR-0035 (Accepted 2026-07-12) + Platform `ci.yml`'s
"Export OpenAPI document (CI-runtime capture)" step ship the real document, and the committed
`openapi.d.ts` is already generated from it (324 paths, 182 schemas). This child migrates the
Agent-workspace hooks against that real document.

Each hand-written interface in an Agent hook can silently drift from the real Platform contract —
the csat-runner failure class (Web PR#159). This child removes that risk for the Agent module so
`tsc -b` catches drift at compile time.

## What Changes

- **Migrate the 8 Agent-module hook files** in `src/core/api/hooks/` (22 hand-written
  request/response declarations) to consume the generated types from `openapi.d.ts` behind
  `client.ts`'s generic `<T>` (swap-the-T, no call-site plumbing). Full list in tasks.md.
- **Grep-and-update** any component prop / test import referencing a removed hand-written
  interface before deleting each old declaration.
- No breaking changes to any migrated hook's public return type — each generated type is a
  structural match (or a thin coercion wrapper where a `number | string` union needs normalizing).

## Capabilities

### Modified Capabilities

- `openapi-generated-types`: extends the migrated surface to the Agent-workspace hooks. Mechanism
  unchanged — this child only advances which hooks consume the generated types.

## Impact

- **Migrated hooks**: the 8 Agent-module files listed in tasks.md. No other module's hooks touched.
- **No new dependency, no new CI job**: the existing blocking `build` job gates the generated types
  for free.
- **No runtime behavior change**: swap-the-T is compile-time-only; existing coverage exercises the
  same runtime.
- **Depends on**: nothing pending — the Platform document is already committed as `openapi.d.ts`.
- **Not in scope**: the Admin/Analytics/Operations modules (their own sibling children);
  `src/core/realtime/platform-hub.ts` (SignalR — out of scope); the shared coercion helper (the
  Admin child gathers sites; helper deferred to ≥3 genuine sites).
