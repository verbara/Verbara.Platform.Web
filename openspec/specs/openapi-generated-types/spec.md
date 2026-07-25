# openapi-generated-types Specification

## Purpose

Generates and maintains TypeScript types from Platform's published OpenAPI document
(`openapi-typescript`, committed `src/core/api/generated/openapi.d.ts`), so wire-shape
drift between this repo's hand-written consumer interfaces and the real Platform contract
is caught at compile time (`tsc -b`) instead of silently at runtime — the failure class
that caused the csat-runner incident (v3.13.1-web). Migration is phased and adopted
**only where the generated document actually carries a matching named schema**: this
capability covers the codegen tooling + the CSAT analytics slice
(`useCsatQueueAnalytics`/`CsatResponseDto`) + the Admin module's genuine structural
matches (`openapi-typed-client-admin`, archived 2026-07-16 — 6 of 44 Admin hook files
migrated). The migratable surface is bounded by an **upstream response-schema scarcity**:
Platform's captured OpenAPI document emits request bodies (`*Request`) and nested
value-object `*Dto`s but almost no top-level response DTOs, so most consumer response
interfaces have no generated schema to swap onto, and most request schemas diverge
(optional→required-nullable, `number`→the AOT `number | string` union, literal unions
widened to `string`) — a swap there would break the hook's public type, which the
structural-match discipline forbids. Hooks with no clean match stay hand-written, by
design, until that upstream bound moves. The remaining Agent/Analytics/Operations module
children are HELD as backlog pending a cross-repo thread that has Platform emit named
response DTOs in its OpenAPI document (see those children's proposals). The realtime
SignalR boundary (`src/core/realtime/platform-hub.ts`) is explicitly out of scope — no REST
paths, not representable in an OpenAPI document (ADR-0020's deferred follow-up, owner: Pro).

## Requirements

### Requirement: Generated types are produced from Platform's OpenAPI document

The repo SHALL generate TypeScript types from the OpenAPI document published by the
Platform Api host via `openapi-typescript`, and SHALL commit the generated output as a
single declaration file refreshed by an npm script — not fetched at CI build time. The
generated types are the single source of truth for any wire shape they cover; hand-written
interfaces for those shapes MUST be removed once migrated **and only where the document
carries a matching named schema** — a hook whose response shape has no generated schema, or
whose generated request schema diverges (optional→required-nullable, `number`→the AOT
`number | string` union, literal unions widened to `string`), stays hand-written by design,
not as a defect. The capability's migration is phased: Phase 1 (archived,
`openapi-typed-client`) covers tooling + the CSAT analytics slice; the Admin phase
(`openapi-typed-client-admin`, archived 2026-07-16) migrated **6 of its 44 hook files** —
the genuine clean matches — and left the other 38 hand-written because Platform's document
emits almost no top-level response DTOs (the upstream response-schema scarcity described in
the Purpose). Platform's real OpenAPI document is LIVE as a CI artifact (Platform/ADR-0035 +
the `ci.yml` "Export OpenAPI document (CI-runtime capture)" step) and the committed
`openapi.d.ts` is generated from it (324 paths, 182 schemas); the tooling is unblocked, but
the _migratable surface_ is capped by that scarcity. The remaining per-module children
`openapi-typed-client-agent`, `-analytics`, and `-operations` are HELD as backlog pending a
cross-repo thread to have Platform emit named response DTOs — until then their migratable
surface would be as thin as Admin's.

#### Scenario: Generated file matches the golden envelope shape

- **GIVEN** the OpenAPI document envelope matches the golden fixture
  `Verbara.Platform/openspec/changes/archive/2026-07-12-openapi-typed-client/fixtures/openapi-document.v1.sample.json`
  — a document with top-level `openapi`, `info`, `paths`, and `components.schemas` keys
- **WHEN** `npm run generate:api-types` runs against that document
- **THEN** the generated declaration file exposes a type for the
  `components.schemas.CsatResponseDto` schema reachable from the document's
  `paths` entry for `/api/v1/analytics/csat/queues/{queueId}`

#### Scenario: Build fails on drift between generated types and a consumer

- **GIVEN** a hook consumes a generated type via `customFetch<T>`
- **WHEN** the generated declaration file's shape no longer matches how the hook uses it
  (e.g. a field renamed upstream)
- **THEN** `tsc -b` (the existing blocking `build` CI job) fails, surfacing the drift at
  compile time instead of at runtime

#### Scenario: Unmigrated hooks remain hand-written until their own phase lands

- **GIVEN** a hook outside the CSAT slice still declares its own hand-written
  request/response interface
- **WHEN** the repo is at any commit between Phase 1's archive and a later migration phase
  for that hook
- **THEN** the hand-written interface is expected and not itself a defect — only the CSAT
  slice's `CsatQueueSummary` was required to be removed by Phase 1

### Requirement: CSAT analytics hook consumes the generated CsatResponseDto type

`useCsatQueueAnalytics` in `src/core/api/hooks/use-analytics.ts` SHALL consume the generated type for
the `CsatResponseDto` schema instead of a hand-written interface. With the numeric union now extinct
at the source (Platform host change `openapi-numeric-schema-truth`, `Platform/ADR-0036`), the CSAT
`select`-normalizers that previously coerced `CsatResponseDto`'s and `CsatAggregateAnalyticsDto`'s
`number | string` fields (`CsatQueueSummary` / `CsatAggregateSummary`) are **retired** — the
regenerated fields are already `number`. The generated type's fields MUST match the corrected golden
fixture `../Verbara.Platform/openspec/changes/archive/2026-07-25-openapi-numeric-schema-truth/fixtures/openapi-numeric-schema.v1.json`
verbatim: schema `CsatResponseDto` carries `queueName` (`type: string`), `channel` (`type: string`),
`totalResponses` (`type: integer` / `int32`), `averageRating` (`type: number` / `double`),
`rangeStart` (`type: string` / `date-time`), and `rangeEnd` (`type: string` / `date-time`).

#### Scenario: The CSAT numeric fields resolve as plain number with no coercion

- **GIVEN** the corrected fixture types `CsatResponseDto.totalResponses` as `type: integer` /
  `format: int32` and `CsatResponseDto.averageRating` as `type: number` / `format: double`
- **WHEN** `useCsatQueueAnalytics` resolves a successful response after `openapi.d.ts` is regenerated
- **THEN** `totalResponses` and `averageRating` are already `number` on the generated type, the
  `CsatQueueSummary` / `CsatAggregateSummary` `select`-normalizers' `Number()` coercions are removed,
  and the obsolete string-arm assertions in `use-csat-aggregate.test.ts` are dropped

#### Scenario: Hook return type carries every fixture field

- **GIVEN** `useCsatQueueAnalytics` resolves a successful response
- **WHEN** a caller reads the resolved data's fields
- **THEN** the type exposes exactly `queueName`, `channel`, `totalResponses`,
  `averageRating`, `rangeStart`, and `rangeEnd`, matching the golden fixture's
  `CsatResponseDto` schema field-for-field with no extra or renamed keys

#### Scenario: No hand-written duplicate remains for the migrated shape

- **GIVEN** the CSAT slice has migrated to the generated type
- **WHEN** the repo is searched for a hand-written `CsatQueueSummary` interface
  declaration
- **THEN** none remains in `src/core/api/hooks/use-analytics.ts` — the generated type is
  the only declaration of that shape

### Requirement: Realtime SignalR payloads remain hand-written and out of scope

The 4 hand-written hub payload interfaces in `src/core/realtime/platform-hub.ts`
(`PresenceUpdatedPayload`, `SupervisionStartedPayload`, `WhisperReceivedPayload`, and the
hub connection state mapping) SHALL NOT be migrated to generated types by this capability.
Hub messages have no REST paths and are not representable in the OpenAPI document this
capability consumes.

#### Scenario: Hub payload interfaces are untouched

- **GIVEN** `src/core/realtime/platform-hub.ts` declares its 4 hand-written payload
  interfaces
- **WHEN** the CSAT slice (or any future phase of this capability) migrates hook types to
  generated types
- **THEN** `platform-hub.ts`'s interfaces are not modified, removed, or replaced — that
  boundary is ADR-0020's deferred follow-up (owner: Pro), explicitly out of scope

### Requirement: Numeric AOT wire unions get a tracked normalization decision before proliferating

The `number | string` union was **never** a Platform precision policy — it was a .NET 10
`Microsoft.AspNetCore.OpenApi` artifact (framework-default `JsonNumberHandling.AllowReadingFromString`;
root cause [dotnet/aspnetcore #64145](https://github.com/dotnet/aspnetcore/issues/64145)). The
Platform host change `openapi-numeric-schema-truth` (`Platform/ADR-0036`, amends ADR-0035) adds an
`IOpenApiSchemaTransformer` that strips the spurious `string` arm from the emitted document
(document-only, AOT-safe, runtime deserialization unchanged). **After that correction the union is
EXTINCT at the source**: every numeric body/response field declares a SINGLE JSON type in the
regenerated `src/core/api/generated/openapi.d.ts`, so no `number | string` union remains to
normalize.

The earlier tally in this requirement ("**the tally stands at 2 genuine active sites**") was wrong:
the union had proliferated to **30+ hand-written `Number()` coercion sites** across production hooks
(`use-billing.ts`, `use-partner.ts`, `use-queue-metrics.ts`, `use-analytics.ts`, `use-teams.ts`,
`use-notifications.ts`, `use-supervisor.ts`, `use-typification-llm.ts`) — each existing only to
strip a `string` arm that never arrives at runtime. The corrected count of record is **30+**, and
this change **retires the entire class**.

Because the union no longer exists, the deferred open design question — "introduce a shared coercion
helper once ≥3 genuine active sites exist" (phase2 open question 3) — is **CLOSED as OBSOLETE**. The
shared helper MUST NOT be built: there is no `number | string` class left to generalize. Any numeric
field the regenerated document emits (`type: integer` or `type: number`, including `nullable`)
SHALL map to a plain TypeScript `number` (or `number | null`), and consumers SHALL read it directly
with no `Number()` coercion at the wire boundary.

The corrected single-typed shape is pinned in the Platform host change's golden fixture
`../Verbara.Platform/openspec/changes/archive/2026-07-25-openapi-numeric-schema-truth/fixtures/openapi-numeric-schema.v1.json`.
The regenerated `openapi.d.ts` MUST type each cited field with the single JSON type that fixture
declares, verbatim — never a `number | string` union:

- `CsatAggregateDto.totalResponses` — fixture `type: integer` / `format: int32` → `number`.
- `CsatAggregateDto.averageRating` — fixture `type: number` / `format: double` → `number`.
- `CsatResponseDto.totalResponses` — fixture `type: integer` / `format: int32` → `number`.
- `CsatResponseDto.averageRating` — fixture `type: number` / `format: double` → `number`.
- `DashboardKpisDto.avgWaitMs` — fixture `type: number` / `format: double` → `number`.
- `DashboardKpisDto.slaPercent` — fixture `type: number` / `format: double` → `number`.
- `QueueMetricsDto.waiting` — fixture nullable `type: integer` / `format: int32` (`nullable: true`)
  → `number | null` (nullable, never `| string`).
- `QueueMetricsDto.avgWaitSeconds` — fixture nullable `type: number` / `format: double`
  (`nullable: true`) → `number | null` (nullable, never `| string`).

#### Scenario: Regenerated numeric fields carry the fixture's single JSON type, never a string arm

- **GIVEN** the Platform host change's corrected document, whose golden fixture
  `../Verbara.Platform/openspec/changes/archive/2026-07-25-openapi-numeric-schema-truth/fixtures/openapi-numeric-schema.v1.json`
  declares `CsatAggregateDto.totalResponses` as `type: integer` / `format: int32`,
  `CsatAggregateDto.averageRating` as `type: number` / `format: double`,
  `DashboardKpisDto.avgWaitMs` as `type: number` / `format: double`, and `QueueMetricsDto.waiting`
  as a nullable `type: integer` / `format: int32`
- **WHEN** `npm run generate:api-types` regenerates `src/core/api/generated/openapi.d.ts` against
  that corrected document
- **THEN** the regenerated file types `CsatAggregateDto.totalResponses`, `CsatAggregateDto.averageRating`,
  and `DashboardKpisDto.avgWaitMs` as `number` (not `number | string`), and `QueueMetricsDto.waiting`
  as `number | null` (nullable, never `| string`) — matching each fixture field's single JSON type
  verbatim, and the whole-file count of `number | string` unions drops from 543 to 0

#### Scenario: The shared coercion helper decision is closed obsolete and the class is retired

- **GIVEN** the earlier requirement text claimed "the tally stands at 2 genuine active sites" while
  30+ `Number()` coercion sites actually existed, and deferred a shared coercion helper until ≥3
  genuine sites
- **WHEN** Platform's `IOpenApiSchemaTransformer` removes the `number | string` union from the
  document and this change regenerates `openapi.d.ts`
- **THEN** the corrected count of record is 30+, the ≥3-sites shared-coercion-helper decision is
  CLOSED as OBSOLETE (the helper MUST NOT be built — the union class no longer exists), and every
  retired site reads the regenerated `number` field directly with no `Number()` coercion at the wire
  boundary

#### Scenario: A second migrated hook hits the same union pattern

- **GIVEN** the `number | string` numeric union is now EXTINCT at the source (Platform's
  `IOpenApiSchemaTransformer` strips it, `openapi-numeric-schema-truth`), so the regenerated
  `openapi.d.ts` exposes no such union field
- **WHEN** any hook is migrated to the generated types after this change
- **THEN** no per-hook `number | string` normalization can arise — the field is already `number` /
  `number | null` — so the deferred "shared coercion helper at ≥3 genuine sites" design question is
  moot and CLOSED as obsolete, superseding the earlier defer-and-track posture

### Requirement: Admin module hooks adopt generated types where a genuine match exists

Across the 44 Admin-module hook files under `src/core/api/hooks/`, each hook SHALL adopt the
generated type from `src/core/api/generated/openapi.d.ts` (behind `client.ts`'s existing
generic `<T>`, swap-the-T) **only where the generated document carries a matching named
schema that is an exact structural match or a non-breaking superset** of the hand-written
interface. A hook whose response shape has no generated schema, or whose generated request
schema diverges (optional→required-nullable, `number`→the AOT `number | string` union,
literal unions widened to `string`), SHALL stay hand-written — a forced swap there would
break the hook's public type, which the structural-match discipline forbids. Where a shape
IS adopted, its hand-written interface MUST be removed and every usage (component props,
tests) updated to the generated type. Where a field's generated type is a `number | string`
AOT-wire-union, the migrated hook MAY keep a thin per-hook coercion (as the CSAT slice does)
until the shared-helper decision is revisited at ≥3 genuine sites.

The shipped outcome of `openapi-typed-client-admin` (archived 2026-07-16) is **6 genuine
migrations across the 44 files** — `ScheduleDay`, `ChangePasswordRequest`, `SystemSettings`,
`UpdateLicenseRequest`, `TypificationFieldOption`, `CreateWebhookSubscriptionRequest` — with
the other 38 files kept hand-written (per-file rationale in the archived change's `tasks.md`).
This is the current upstream bound, not an incomplete migration: Platform's captured OpenAPI
document emits almost no top-level response DTOs, so most Admin response interfaces have no
schema to swap onto. Lifting this bound is the subject of the held cross-repo response-schema
thread; the Agent/Analytics/Operations children remain HELD against it.

#### Scenario: An Admin hook with a clean generated match drops its hand-written interface

- **GIVEN** an Admin-module hook whose hand-written interface has an exact structural match
  (or non-breaking superset) in the generated document (e.g. `SystemSettings` →
  `components['schemas']['SystemSettingsRequest']`)
- **WHEN** the migration adopts that generated type via `customFetch<T>`
- **THEN** the hand-written interface is removed, every usage imports the generated type, and
  `tsc -b` (the existing blocking `build` CI job) passes — surfacing any drift between the hook's
  usage and the real Platform contract at compile time

#### Scenario: An Admin hook with no clean match stays hand-written by design

- **GIVEN** an Admin-module hook whose response shape has no generated schema, or whose
  generated request schema diverges from the hand-written interface (e.g. `use-queues.ts`'s
  `Queue`, which has no generated response schema)
- **WHEN** the migration evaluates that hook
- **THEN** the hand-written interface is retained and annotated in the archived change's
  `tasks.md` — this is the documented upstream bound (response-schema scarcity), not a defect
  or an unfinished task

#### Scenario: Numeric AOT wire-union sites are tallied, not silently re-normalized

- **GIVEN** an Admin hook whose _adopted_ generated type exposes a genuine `number | string`
  AOT-wire-union field a consumer must read as `number`
- **WHEN** the migration adopts that hook's generated type
- **THEN** the site is recorded in the coercion-site tally, and the shared-coercion-helper
  decision (phase2 open question 3) is revisited only once ≥3 genuine sites exist — a per-hook
  `select`/cast coercion is used in the interim, and `ai-credits-readout.tsx`'s `as number` casts
  (a hand-written `number | null` nullable-narrowing gap) are NOT counted as such a site. The
  Admin phase adopted no numeric-bearing schema, so the active tally stays at 2, with latent
  candidates logged in the archived change's `tasks.md` for hooks that would flip active if
  their schema were ever adopted

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

### Requirement: Operations REST hooks consume generated types; hub-stream payloads stay out

The 3 REST Operations-module hooks under `src/core/api/hooks/` — `use-cluster.ts`,
`use-queue-metrics.ts`, `use-supervisor.ts` (14 hand-written REST request/response declarations that
flow through `customFetch<T>`) — SHALL consume the generated types from
`src/core/api/generated/openapi.d.ts` in place of their hand-written interfaces, behind
`client.ts`'s existing generic `<T>` (swap-the-T). Once a shape is migrated, its hand-written
interface MUST be removed and every usage updated to the generated type. The 3 hub-event stream
hooks — `use-agent-state-stream.ts` (`AgentStateChangedPayload`), `use-cluster-state-stream.ts`
(`ClusterNodeStatePayload`), `use-conversation-state-stream.ts` (`ConversationStateChangedPayload`)
— declare SignalR hub-event payloads consumed via `onHubEvent`, not REST shapes, and SHALL NOT be
migrated by this change (consistent with the capability's existing SignalR-out-of-scope
requirement; ADR-0020's deferred follow-up, owner: Pro).

#### Scenario: An Operations REST hook drops its hand-written interface for the generated type

- **GIVEN** `use-cluster.ts` declares its own hand-written request/response interfaces consumed
  via `customFetch<T>`
- **WHEN** this change migrates that hook to consume the generated
  `components['schemas']['<SchemaName>']` types
- **THEN** the hand-written interfaces are removed, every usage imports the generated type, and
  `tsc -b` (the existing blocking `build` CI job) passes — surfacing any drift at compile time

#### Scenario: A hub-stream payload interface is not migrated

- **GIVEN** `use-agent-state-stream.ts` declares `AgentStateChangedPayload`, consumed via
  `onHubEvent` from `@/core/realtime` (a SignalR hub-event shape, no REST path)
- **WHEN** this change migrates the Operations module's REST hooks
- **THEN** `AgentStateChangedPayload` and the other two `*-state-stream` `*Payload` interfaces are
  left hand-written and untouched — hub messages are not representable in the OpenAPI document
  (ADR-0020's deferred follow-up, owner: Pro)

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

### Requirement: Analytics module hooks adopt generated types now that the numeric union is gone

The Analytics-module hook files under `src/core/api/hooks/` — `use-analytics.ts`, `use-surveys.ts`,
`use-recording.ts`, `use-csat.ts` (~39 hand-written declarations, authoritative list in this change's
`tasks.md`) — SHALL adopt the generated types from `src/core/api/generated/openapi.d.ts` (behind
`client.ts`'s existing generic `<T>`, swap-the-T) where the regenerated document now carries a clean
structural match, which the corrected numeric typing unblocks. This completes the sibling
`openapi-typed-client-analytics` child (which was HELD on exactly this `number | string` union). Once
a shape is adopted, its hand-written interface MUST be removed and every usage updated to the
generated type.

Two shapes the sibling `openapi-numeric-schema-truth` child logged as **structural-divergence
that SHALL stay hand-written** are now **corrected at the source** by the Platform host change
`openapi-residual-contract-shapes` (`Platform/ADR-0036`) and SHALL therefore adopt the generated
type instead (see the "Residual contract-shape shadows adopt the corrected generated types"
requirement for the field-level detail and golden-fixture citations):

- **`TopicTrendsResponse`** — the generated document already emits `trends` (not `topics`) and drops
  `from`/`to`; the stale hand-written `{ topics, totalAnalyzed, from, to }` shadow SHALL be dropped
  and its consumer repointed to the generated `trends` shape.
- **`ComplianceRuleSummaryDto.severity`** — Platform narrows `severity` back from bare `string` to
  the `Info | Warning | Critical` literal union; the hand-written `ComplianceRuleSummaryDto` /
  `ComplianceSummaryResponse` shadows SHALL be dropped and their severity display/filter/sort
  consumers repointed to the generated union (this adoption is gated on Platform shipping the union
  — buildOrder-2).

The remaining structural-divergence and no-generated-counterpart shapes SHALL stay hand-written —
these are separate Platform contract concerns, NOT fixed by this change: the `PagedResult<T>`
envelope (the generated `PagedResultOf<T>` monomorphization is by-design and already matches the
contract fields `items`, `totalCount`, `page`, `pageSize`, `totalPages`, `hasNextPage`,
`hasPreviousPage` — see the residual-shapes requirement), and no-generated-counterpart shapes
(`BotAnalyticsSummary`, `TranscriptSegment`, `IntervalData`, and request shapes like
`CsatCaptureRequest`).

#### Scenario: An Analytics hook with a now-clean match drops its hand-written interface

- **GIVEN** an Analytics-module hook whose hand-written interface was previously unmatchable only
  because a numeric field was a `number | string` union
- **WHEN** `openapi.d.ts` is regenerated from the corrected document and that field is now a single
  `number`, giving a clean structural match
- **THEN** the hook adopts `components['schemas']['<SchemaName>']` via `customFetch<T>`, the
  hand-written interface is removed, every usage imports the generated type, and `tsc -b` (the
  existing blocking `build` CI job) passes

#### Scenario: The two corrected residual shadows adopt the generated type instead of staying hand-written

- **GIVEN** `TopicTrendsResponse` (now generated with `trends`, not `topics`, and without
  `from`/`to`) and `ComplianceRuleSummaryDto.severity` (now narrowed to `Info | Warning | Critical`
  by the Platform host change `openapi-residual-contract-shapes`, `Platform/ADR-0036`)
- **WHEN** this change regenerates `openapi.d.ts` and completes the Analytics migration
- **THEN** each such shadow is dropped and its consumer repointed to the generated type — reversing
  the earlier "SHALL stay hand-written" posture, which held only while Platform's document diverged

#### Scenario: The PagedResult envelope stays hand-written by design as a still-sanctioned exception

- **GIVEN** the `PagedResult<T>` envelope, whose generated `PagedResultOf<T>` monomorphization is
  by-design and already carries `items`, `totalCount`, `page`, `pageSize`, `totalPages`,
  `hasNextPage`, `hasPreviousPage`
- **WHEN** this change completes the Analytics migration
- **THEN** the envelope exception remains sanctioned — the one hand-written `AuditEventsPagedResult`
  is retired by that hook's own separate future migration, not this change, and no forced swap is
  made here

### Requirement: Generated-types adoption baseline ratchets down as analytics hooks adopt

The adoption ratchet `scripts/check-generated-types-adoption.mjs` (`npm run lint:generated-types`)
SHALL force `generated-types-adoption-baseline.json`'s floor DOWN as `use-csat.ts`,
`use-recording.ts`, and `use-surveys.ts` adopt generated types under this change. The gate fails if a
hook not on the unadopted list is unadopted; as each of these three hooks adopts, it MUST be removed
from the list (the list only ever ratchets down, never up).

#### Scenario: Adopting analytics hooks trims the unadopted list

- **GIVEN** `use-csat.ts`, `use-recording.ts`, and `use-surveys.ts` are on
  `generated-types-adoption-baseline.json`'s `unadopted_hooks` list (floor 39)
- **WHEN** this change migrates those hooks to consume generated types and removes them from the list
- **THEN** `npm run lint:generated-types` passes with the lower floor, and no hook that already
  adopts generated types remains on the unadopted list

### Requirement: Residual contract-shape shadows adopt the corrected generated types

The two Analytics wire shapes the Platform host change `openapi-residual-contract-shapes`
(`Platform/ADR-0036`) corrects — `TopicTrendsResponse` and `ComplianceRuleSummaryDto.severity` — SHALL
be migrated from their hand-written shadows in `src/core/api/hooks/use-analytics.ts` to the generated
types in `src/core/api/generated/openapi.d.ts`, behind `client.ts`'s existing generic `<T>`
(swap-the-T). Once a shape is adopted, its hand-written shadow MUST be removed and every consumer
usage updated to the generated type. The consumed field names MUST match the Platform host change's
golden fixtures verbatim — no paraphrase, rename, reorder, or invention.

**API-contract dependency (API-first, `Platform/ADR-0036`):**

- **TopicTrends (INDEPENDENT — already unblocked):** the endpoint
  `/api/v1/call-analytics/topics/trends` already emits the corrected shape today. Per the golden
  fixture `topic-trends-response.v1.json`, the response carries `trends` — an array of
  `{ topic, occurrences, avgConfidence }` — and `totalAnalyzed`. It carries **no** `topics` key and
  **no** `from`/`to` keys. The hand-written shadow `TopicTrendsResponse`
  (`{ topics, totalAnalyzed, from, to }`) SHALL be dropped and the consumer
  `src/analytics/speech-analytics/speech-analytics-page.tsx` repointed from `data?.topics` to the
  generated `trends`.
- **ComplianceRuleSummary severity (DEPENDS on Platform, buildOrder 1 — the barrier):** Web narrows
  `severity` to the enum ONLY AFTER Platform ships the `Info | Warning | Critical` literal union in
  its emitted document. Per the golden fixture `compliance-rule-summary.v1.json`, a rule summary
  carries `ruleId`, `ruleName`, `severity` (one of `Info`, `Warning`, `Critical`), `occurrences`,
  `sessionsAffected`, `firstSeen`, and `lastSeen`. After Platform's document ships the union and
  `openapi.d.ts` is regenerated, the hand-written `ComplianceRuleSummaryDto` and its transitive
  `ComplianceSummaryResponse` shadow SHALL be dropped and the severity display/filter/sort consumers
  in `speech-analytics-page.tsx` repointed to the generated union.

The `PagedResult` envelope requires **no Web action** (recorded for completeness): per the golden
fixture `paged-result-envelope.v1.json`, the envelope carries `items`, `totalCount`, `page`,
`pageSize`, `totalPages`, `hasNextPage`, and `hasPreviousPage`, and the generated `PagedResultOf<T>`
monomorphization already matches it field-for-field. The by-design monomorphization stays; the one
hand-written `AuditEventsPagedResult` in `src/admin/security/audit/use-audit-events.ts` is retired by
that hook's OWN separate future migration, NOT this change.

The adoption ratchet `scripts/check-generated-types-adoption.mjs` (baseline floor 37) is unaffected —
`use-analytics.ts` already adopts the generated `components`, so no baseline entry changes under this
change.

#### Scenario: The TopicTrends shadow is dropped and the consumer repointed to the generated trends field

- **GIVEN** the golden fixture `topic-trends-response.v1.json` declares the response with `trends`
  (an array of `{ topic, occurrences, avgConfidence }`) and `totalAnalyzed`, and with no `topics` key
  and no `from`/`to` keys
- **WHEN** this change drops the hand-written `TopicTrendsResponse` shadow and repoints
  `src/analytics/speech-analytics/speech-analytics-page.tsx` from `data?.topics` to the generated
  `trends`
- **THEN** the hook resolves the generated type, `totalAnalyzed` is read unchanged, the consumer
  reads `trends` (not `topics`), no code references the removed `from`/`to` keys, and `tsc -b` (the
  existing blocking `build` CI job) passes

#### Scenario: The compliance severity shadow adopts the generated literal union only after Platform ships it

- **GIVEN** the golden fixture `compliance-rule-summary.v1.json` declares a rule summary with
  `ruleId`, `ruleName`, `severity` (one of `Info`, `Warning`, `Critical`), `occurrences`,
  `sessionsAffected`, `firstSeen`, and `lastSeen`, and Platform's host change
  `openapi-residual-contract-shapes` (buildOrder 1) narrows `severity` from bare `string` to that
  literal union in its emitted document
- **WHEN** Platform ships the union, `openapi.d.ts` is regenerated, and this change drops the
  hand-written `ComplianceRuleSummaryDto` / `ComplianceSummaryResponse` shadows and repoints the
  severity display/filter/sort consumers in `speech-analytics-page.tsx` to the generated union
- **THEN** the severity value is the generated `Info | Warning | Critical` union (not bare `string`),
  the severity-keyed display/filter/sort compiles against the narrowed type, and `tsc -b` passes —
  and this adoption occurs only after Platform's buildOrder-1 stage ships the union (the buildOrder-2
  barrier)

#### Scenario: The PagedResult envelope is confirmed by-design with no Web action

- **GIVEN** the golden fixture `paged-result-envelope.v1.json` declares the envelope with `items`,
  `totalCount`, `page`, `pageSize`, `totalPages`, `hasNextPage`, and `hasPreviousPage`, and the
  generated `PagedResultOf<T>` monomorphization already matches those fields
- **WHEN** this change evaluates the envelope shape
- **THEN** no Web type is dropped or repointed for the envelope — the monomorphization is
  by-design and the one hand-written `AuditEventsPagedResult` is left to its own separate future
  migration, recorded here for completeness only
