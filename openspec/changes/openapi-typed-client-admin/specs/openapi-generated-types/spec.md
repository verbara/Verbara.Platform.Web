## ADDED Requirements

### Requirement: Admin module hooks consume generated types

The Admin-module hook files under `src/core/api/hooks/` (44 files, ~199 hand-written
request/response declarations — the authoritative list is in this change's `tasks.md`) SHALL
consume the generated types from `src/core/api/generated/openapi.d.ts` in place of their
hand-written interfaces, behind `client.ts`'s existing generic `<T>` (swap-the-T, no call-site
plumbing). Once a shape is migrated, its hand-written interface MUST be removed and every usage
(component props, tests) updated to the generated type. Where a field's generated type is a
`number | string` AOT-wire-union, the migrated hook MAY keep a thin per-hook coercion (as the CSAT
slice does) until the shared-helper decision is revisited at ≥3 genuine sites.

#### Scenario: An Admin hook drops its hand-written interface for the generated type

- **GIVEN** an Admin-module hook (e.g. `use-queues.ts`) declares its own hand-written
  request/response interface
- **WHEN** this change migrates that hook to consume the generated
  `components['schemas']['<SchemaName>']` type via `customFetch<T>`
- **THEN** the hand-written interface is removed, every usage imports the generated type, and
  `tsc -b` (the existing blocking `build` CI job) passes — surfacing any drift between the hook's
  usage and the real Platform contract at compile time

#### Scenario: Numeric AOT wire-union sites are tallied, not silently re-normalized

- **GIVEN** an Admin hook's generated type exposes a genuine `number | string` AOT-wire-union
  field a consumer must read as `number`
- **WHEN** this change migrates that hook
- **THEN** the site is recorded in this change's coercion-site tally, and the shared-coercion-helper
  decision (phase2 open question 3) is revisited only once ≥3 genuine sites exist — a per-hook
  `select`/cast coercion is used in the interim, and `ai-credits-readout.tsx`'s `as number` casts
  (a hand-written `number | null` nullable-narrowing gap) are NOT counted as such a site
