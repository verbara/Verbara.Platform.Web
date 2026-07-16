## Context

Per-module child of the `openapi-generated-types` migration, split out by
`openapi-typed-client-phase2` (archived as superseded, resolution 2 = per-module children). This
is the **Admin** child. The mechanism is already designed and proven — this design is thin and
points at the archived phase-1 design for the durable decisions; it adds only the Admin-module
file list and the Q3 site-gathering obligation.

**Mechanism (do not re-derive — see archived phase-1 design):**
`openspec/changes/archive/2026-07-12-openapi-typed-client/design.md` records the settled
decisions this child inherits verbatim:

- **Codegen tool**: `openapi-typescript` (types-only; no runtime client — the repo owns its fetch
  layer in `client.ts`).
- **Delivery**: committed generated file `src/core/api/generated/openapi.d.ts`, refreshed by
  `npm run generate:api-types` — not a CI-time fetch. (Re-check trigger for this decision is
  recorded in phase2's design; DEFER the Platform-repo ADR until a real fetch-vs-committed
  weighing occurs.)
- **Swap-the-T**: at each hook, only the generic `T` changes from the hand-written interface to
  `components['schemas']['<SchemaName>']` (re-exported under a local alias for call-site
  readability). No change to `client.ts`.
- **Structural-vs-nominal discipline**: generated types are structural; grep for every usage of
  each hand-written interface name (component props, tests) and update imports before deleting the
  old declaration.

## Scope — Admin module (44 files, 199 hand-written declarations)

Ownership was determined by dominant consumer + domain: Admin owns the configuration/CRUD
domains. The authoritative file list (with per-file declaration counts) lives in this change's
`tasks.md`. Notable judgment calls folded into Admin (config owner) over Agent: `use-cases`,
`use-reason-hints`, `use-canned-responses`, `use-knowledge`, `use-typification` — the Admin CRUD
UI owns each domain; agent-side usage is read-only/in-conversation.

## Q3 — numeric-coercion site gathering (this child's extra obligation)

`openapi-typed-client-phase2` deferred generalizing a shared `number | string` → `number`
coercion helper until **≥3 genuine sites** exist. **The tally already stands at 2** (both in
`use-analytics.ts`, Analytics module): `CsatResponseDto` (`totalResponses`/`averageRating`,
migrated in phase-1) and `CsatAggregateAnalyticsDto` (envelope + each `queues[]` row, added by the
archived `2026-07-14-csat-completion` change, self-documented there as "the second concrete call
site"). So **one more genuine site trips the ≥3 threshold**. This child, being the largest, carries
the site-gathering task: as each Admin hook migrates, record any field whose generated type is a
genuine `number | string` AOT-wire-union that a consumer must normalize to `number`. Append each to
the shared tally in this change's tasks.md.

**Warning (preserved from phase2 / retro run 4):** `ai-credits-readout.tsx`'s `as number` casts
are NOT an instance of this pattern — its `AiCreditsResponse` is a hand-written `number | null`
interface and the casts work around a TS nullable-narrowing gap, a different root cause. Do not
count it toward the ≥3 threshold and do not model the helper on it.

## Non-Goals

- Migrating any Agent / Analytics / Operations hook (sibling children own those).
- Implementing the shared coercion helper — deferred to ≥3 genuine sites; this child only tallies.
- Touching `src/core/realtime/platform-hub.ts` (SignalR — no REST paths, out of scope).
- Any Platform endpoint/DTO change — Platform owns the document; this child only consumes it.

## Open Questions

None. The mechanism is fixed by the archived phase-1 design; the grouping and coercion-helper
posture are fixed by phase2's resolutions. Any Admin hook whose generated type structurally
diverges from its hand-written interface (a real upstream drift) surfaces at `tsc -b` during
migration and is handled per-hook, not as an open design question.
