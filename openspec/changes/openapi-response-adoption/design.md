## Context

Consumer child of the `openapi-generated-types` migration and the cross-repo `openapi-response-schemas`
thread (Platform/ADR-0035). Sibling to the four per-module `openapi-typed-client-*` children, but
scoped differently: those split the hooks **by module**; this one closes the **response-schema gap**
the Admin child hit. It is thin by design — the mechanism is fixed by the archived phase-1 design;
this file adds only the admin-remainder scope and the source-of-truth citation for the newly emitted
response schemas.

**Mechanism (do not re-derive — see archived phase-1 design):**
`openspec/changes/archive/2026-07-12-openapi-typed-client/design.md` records the settled decisions
this child inherits verbatim:

- **Codegen tool**: `openapi-typescript` (types-only; the repo owns its fetch layer in `client.ts`).
- **Delivery**: committed generated file `src/core/api/generated/openapi.d.ts`, refreshed by
  `scripts/generate-api-types.mjs` (`npm run generate:api-types`) — not a CI-time fetch.
- **Swap-the-T**: at each hook, only the generic `T` on `customFetch<T>` (`src/core/api/client.ts:222`)
  changes from the hand-written interface to `components['schemas']['<SchemaName>']` (re-exported
  under a local alias for call-site readability). No change to `client.ts`.
- **Structural-vs-nominal discipline**: generated types are structural; grep for every usage of each
  hand-written interface name (component props, tests) and update imports before deleting the old
  declaration.

## What this child unblocks (the response-schema gap)

The archived Admin child (`2026-07-16-openapi-typed-client-admin`) documented, in its final tally,
that across **44 Admin files / 199 declarations it migrated only 6 shapes; 38 files stayed
hand-written**, because the committed `openapi.d.ts` exposed request bodies and nested value-object
`*Dto`s but **almost no top-level response DTOs**. Its recorded follow-up was for the Platform host
to "emit response DTOs as named `components/schemas`." The cross-repo `openapi-response-schemas`
change (Platform/ADR-0035, committed) delivers exactly that for the admin-remainder group. This
child regenerates against that document and migrates the ~38 previously-blocked hooks onto the
now-named response schemas.

## Source of truth — the response-schema manifest (`admin-remainder` group)

The authoritative list of emitted response-DTO **names and verbatim field names** this child
consumes is the fixture manifest in the Platform host change:
`Verbara.Platform/openspec/changes/openapi-response-schemas/fixtures/response-schema-manifest.v1.json`,
group `admin-remainder` (status `complete`), which `scripts/verify-openapi-fixture.py` asserts
verbatim against the CI-captured `/openapi/v1.json`. The migrated hooks bind to those exact schema
names via `components['schemas']['<SchemaName>']`; the spec delta cites a representative core set
(`UserDto`, `QueueDto`, `TeamDto`, `AdminAgentResponseDto`, and the paged/list wrappers), and the
manifest is authoritative for the full admin-remainder set. Field names in the spec delta are copied
verbatim from that manifest — a paraphrased or invented field name is a boundary-reconciliation
finding, not a stylistic choice.

## Scope — admin-remainder hooks (~38 files the Admin child kept hand-written)

The migratable set is the admin-remainder hooks under `src/core/api/hooks/` that the archived Admin
child annotated per-file as no-match for response-schema scarcity. They map to the manifest's
`admin-remainder` group and the Platform candidate endpoint files it lists (e.g. `AdminEndpoints.cs`,
`RbacEndpoints.cs`, `ManagementTenantEndpoints.cs`, `Management*`/`Partner*`/`Tenant*` groups). The
authoritative per-file migration list with counts lives in this change's `tasks.md`; each file
migrates one at a time, `tsc -b` green after each.

## Q3 — numeric-coercion site gathering (inherited obligation)

The shared `number | string` → `number` coercion-helper decision stays deferred until **≥3 genuine
active sites** exist; the tally stands at **2** (both `use-analytics.ts`: `CsatResponseDto` and
`CsatAggregateAnalyticsDto`). The Admin child logged many **latent** candidates — `number | string`
unions in generated schemas whose hooks it kept hand-written **because there was no response schema
to swap onto**. Adopting the admin-remainder response types here is exactly what can flip those
latents **active** (a consumer now normalizes the union). This child records each newly-active site
in the shared tally. **Warning (preserved from phase2 / retro run 4):** `ai-credits-readout.tsx`'s
`as number` casts are NOT this pattern — a hand-written `number | null` nullable-narrowing gap — and
do not count toward the ≥3 threshold.

## Sibling siblings — the three HELD children un-gate here (out of scope)

`openapi-typed-client-agent`, `openapi-typed-client-analytics`, and `openapi-typed-client-operations`
each held a GATE on this same cross-repo response-schema thread. This child un-gates that thread for
them (the document now carries their `agent` / `analytics` / `operations` groups too), but they run
as **their own backlog items** consuming their own manifest groups. They are listed here only so the
un-gating is accounted for — no file of theirs is touched by this change.

## Non-Goals

- Migrating any Agent / Analytics / Operations hook (the un-gated sibling children own those groups).
- Migrating any SignalR hub-event payload (`platform-hub.ts` or the `*-state-stream` `*Payload`
  interfaces) — no REST paths, ADR-0020's deferred follow-up (owner: Pro).
- Implementing the shared coercion helper — deferred to ≥3 genuine active sites; this child only
  gathers/flips sites.
- Any Platform endpoint/DTO change — the Platform host `openapi-response-schemas` change owns the
  emission; this child only consumes the document.

## Open Questions

None. The mechanism is fixed by the archived phase-1 design; the response schemas are fixed and
verbatim-asserted by the manifest. Any admin-remainder hook whose generated response type structurally
diverges from its hand-written interface (a real upstream drift) surfaces at `tsc -b` during migration
and is handled per-hook, not as an open design question.
