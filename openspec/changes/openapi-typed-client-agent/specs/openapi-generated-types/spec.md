## ADDED Requirements

### Requirement: Agent module hooks consume generated types

The Agent-module hook files under `src/core/api/hooks/` (8 files, ~22 hand-written
request/response declarations — the authoritative list is in this change's `tasks.md`) SHALL
consume the generated types from `src/core/api/generated/openapi.d.ts` in place of their
hand-written interfaces, behind `client.ts`'s existing generic `<T>` (swap-the-T, no call-site
plumbing). Once a shape is migrated, its hand-written interface MUST be removed and every usage
(component props, tests) updated to the generated type.

#### Scenario: An Agent hook drops its hand-written interface for the generated type

- **GIVEN** an Agent-module hook (e.g. `use-conversations.ts`) declares its own hand-written
  request/response interface
- **WHEN** this change migrates that hook to consume the generated
  `components['schemas']['<SchemaName>']` type via `customFetch<T>`
- **THEN** the hand-written interface is removed, every usage imports the generated type, and
  `tsc -b` (the existing blocking `build` CI job) passes — surfacing any drift between the hook's
  usage and the real Platform contract at compile time
