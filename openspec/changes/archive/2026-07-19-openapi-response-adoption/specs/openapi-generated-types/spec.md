## ADDED Requirements

### Requirement: Admin-remainder hooks consume the newly-emitted named response schemas

The admin-remainder hook files under `src/core/api/hooks/` — the ~38 files the archived
`openapi-typed-client-admin` change kept hand-written for response-schema scarcity (authoritative
per-file list in this change's `tasks.md`) — SHALL consume the named response schemas now emitted in
`src/core/api/generated/openapi.d.ts` (regenerated from the Platform `openapi-response-schemas`
document) in place of their hand-written response interfaces, behind `client.ts`'s existing generic
`<T>` (swap-the-T, no call-site plumbing). Once a response shape is migrated, its hand-written
interface MUST be removed and every usage (component props, tests) updated to the generated type.
The generated schema names and their fields are authoritative in the Platform host change's fixture
manifest `response-schema-manifest.v1.json`, group `admin-remainder` (status `complete`); the hooks
bind to those exact names via `components['schemas']['<SchemaName>']`. The representative core
schemas this delta cites (fields copied verbatim from that manifest) are:

- **`UserDto`** — `id`, `email`, `displayName`, `role`, `status`, `createdAt`.
- **`QueueDto`** — `id`, `name`, `isActive`, `maxWaiting`, `slaTargets`, `overflowRule`, `wrapUp`,
  `requiredSkills`, `autoAnswerDefault`, `createdAt`.
- **`TeamDto`** — `id`, `name`, `memberCount`, `createdAt`.
- **`AdminAgentResponseDto`** — `agentId`, `tenantId`, `userId`, `displayName`, `state`,
  `pendingState`, `pendingReason`, `pendingSince`, `hasPendingPause`, `teamId`, `skills`,
  `extension`, `autoAnswer`, `canAcceptWork`, `createdAt`, `updatedAt`, `capacityOverride`,
  `effectiveCapacity`.
- **Paged/list wrappers** — `PagedResultOfUserDto`, `PagedResultOfQueueDto`, `PagedResultOfTeamDto`,
  and `PagedResultOfAdminAgentResponseDto`, each with `items`, `totalCount`, `page`, `pageSize`,
  `totalPages`, `hasNextPage`, `hasPreviousPage`.

The manifest's `admin-remainder` group is authoritative for the full set (e.g. `MgmtTenantDto`,
`RoleTemplate`, `TenantRole`, `PermissionGroupDto`, `InvoiceDto`, `TenantSettingsDto`,
`WebhookSubscription`, `LicenseInfoDto`, and the remaining response DTOs listed there); this delta
cites the core set and defers to the manifest for the rest.

#### Scenario: An admin-remainder hook drops its hand-written response interface for the generated schema

- **GIVEN** an admin-remainder hook (e.g. `use-users.ts`) declares its own hand-written response
  interface — a shape the archived Admin child could not migrate because the document exposed no
  named response schema for it
- **WHEN** this change regenerates `openapi.d.ts` from the Platform `openapi-response-schemas`
  document and migrates that hook to consume the now-named `components['schemas']['UserDto']` (or its
  `PagedResultOfUserDto` wrapper) via `customFetch<T>`
- **THEN** the hand-written interface is removed, every usage imports the generated type, and
  `tsc -b` (the existing blocking `build` CI job) passes — surfacing any drift between the hook's
  usage and the real Platform contract at compile time

#### Scenario: Cited response DTO field names match the manifest verbatim

- **GIVEN** the Platform host emits `UserDto` with fields `id`, `email`, `displayName`, `role`,
  `status`, `createdAt` and `QueueDto` with `id`, `name`, `isActive`, `maxWaiting`, `slaTargets`,
  `overflowRule`, `wrapUp`, `requiredSkills`, `autoAnswerDefault`, `createdAt` — verbatim per the
  `admin-remainder` group of `response-schema-manifest.v1.json`
- **WHEN** a migrated hook binds to `components['schemas']['UserDto']` or
  `components['schemas']['QueueDto']`
- **THEN** the consumed field names match the manifest exactly (no paraphrase, rename, reorder, or
  invention), and any divergence between the generated `openapi.d.ts` and the hook's usage is caught
  at `tsc -b`

#### Scenario: A newly-adopted response type flips a latent numeric coercion site active

- **GIVEN** the archived Admin child logged a `number | string` AOT-wire-union field as a **latent**
  candidate because its hook stayed hand-written for lack of a response schema
- **WHEN** this change adopts that hook's now-named response type and a consumer must normalize the
  union to `number`
- **THEN** the site is recorded as **active** in this change's shared coercion-site tally, and the
  shared-coercion-helper decision (phase2 open question 3) is revisited only once ≥3 genuine active
  sites exist — `ai-credits-readout.tsx`'s `as number` casts (a hand-written `number | null`
  nullable-narrowing gap) are NOT counted as such a site

## Architectural Risk

- **Level:** LOW.
- **Affected:** `src/core/api/hooks/` (the ~38 admin-remainder hooks) and the components/tests that
  import their removed hand-written response interfaces; `src/core/api/generated/openapi.d.ts`
  (regenerated). No change to `src/core/api/client.ts` (swap-the-T is `<T>`-only). No runtime path
  changes — the migration is compile-time-only.
- **API-contract dependency (API-first):** consumes the Platform `openapi-response-schemas` document
  (Platform/ADR-0035) — specifically the named response schemas of the admin-remainder endpoint
  group (`AdminEndpoints.cs`, `RbacEndpoints.cs`, `Management*`, `Partner*`, `Tenant*` and the other
  candidate files enumerated in the manifest). If the Platform document drifts from the manifest, the
  mismatch surfaces at `tsc -b` after regeneration, not at runtime.
- **Mitigation:** one file at a time with `tsc -b` green after each; grep-before-delete for every
  removed interface name; the manifest (`admin-remainder` group, verbatim-asserted by
  `verify-openapi-fixture.py`) is the single source of truth for schema names + fields; the existing
  blocking `build` job gates the regenerated types for free with no new CI job.
