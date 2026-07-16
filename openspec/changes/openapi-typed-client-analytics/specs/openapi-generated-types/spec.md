## ADDED Requirements

### Requirement: Analytics module hooks consume generated types

The Analytics-module hook files under `src/core/api/hooks/` (4 files, ~43 hand-written
request/response declarations — the authoritative list is in this change's `tasks.md`, of which
the CSAT slice of `use-analytics.ts` is already migrated) SHALL consume the generated types from
`src/core/api/generated/openapi.d.ts` in place of their hand-written interfaces, behind
`client.ts`'s existing generic `<T>` (swap-the-T, no call-site plumbing). Once a shape is
migrated, its hand-written interface MUST be removed and every usage updated to the generated type.
The already-migrated `useCsatQueueAnalytics` / `CsatResponseDto` slice and its `number | string`
coercion MUST be preserved unchanged.

#### Scenario: An Analytics hook drops its hand-written interface for the generated type

- **GIVEN** an Analytics-module hook (e.g. a non-CSAT slice of `use-analytics.ts`) declares its
  own hand-written request/response interface
- **WHEN** this change migrates that hook to consume the generated
  `components['schemas']['<SchemaName>']` type via `customFetch<T>`
- **THEN** the hand-written interface is removed, every usage imports the generated type, the
  already-migrated CSAT slice is untouched, and `tsc -b` (the existing blocking `build` CI job)
  passes — surfacing any drift at compile time
