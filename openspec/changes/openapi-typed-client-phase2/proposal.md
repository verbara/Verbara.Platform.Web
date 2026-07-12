---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Platform/ADR-0035
---

## Why

`openapi-typed-client` (archived, Web PR#161) proved the swap-the-T mechanism and migrated
one hook slice (`useCsatQueueAnalytics` / `CsatResponseDto`) off a hand-written interface
onto the generated `openapi.d.ts`. Its `tasks.md` Phase 4 recorded three follow-ups that were
explicitly out of scope for that child but must not be lost now that it's archived:

1. Record the codegen delivery mechanism (committed file vs CI-time fetch) as a durable ADR
   in `Verbara.Platform/docs/decisions/` if a later phase revisits the decision.
2. Plan the next migration phase — the remaining 61 hand-written hook files (~271
   declarations) across Admin, Agent, Analytics, and Operations modules — once the Platform
   host CI artifact (buildOrder 1) is live and a real generated document can replace the
   fixture-derived interim `openapi.d.ts` from Phase A.
3. Decide whether the generated schema's `number | string` union for AOT-typed numeric
   fields (seen on `CsatResponseDto.totalResponses` / `.averageRating`) should get a
   repo-wide coercion convention (a shared helper), instead of each migrated hook
   re-deriving its own `select`-based normalization. `ai-credits-readout.tsx` already has an
   `as number` cast that is the same shape of problem, uncoordinated.

This change exists so those three items are tracked and visible (per the closing-routine
follow-up-harvest rule) instead of surviving only as prose in an archived change.

## What Changes

- **Planning only in this proposal** — no code changes ship with this change yet. It scopes
  the next migration phase and the coercion-helper decision so they can be picked up as
  actual implementation work (this change's own future `/opsx:apply`, or split further if
  the scope warrants it).
- Tracks the ADR follow-up (item 1) as a task pointing at the Platform repo, since the ADR
  itself is out of this repo's tree.

## Capabilities

### Modified Capabilities

- `openapi-generated-types`: extends the capability's scope statement to acknowledge the
  planned next phase (remaining hook migration) and the still-open numeric-coercion
  question, without committing to either's resolution yet.

## Impact

- **No runtime/build impact** — this is a planning-only change; Phase A codegen tooling and
  the CSAT slice migration already shipped and are unaffected.
- **Depends on**: Platform publishing the OpenAPI document as a consumable CI artifact
  (buildOrder 1, host child, Platform/ADR-0035) before the remaining-61-files phase can use
  a real (non-fixture-derived) generated document.
- **Not in scope**: implementing the migration of any additional hook file, or implementing
  the coercion helper — both are scoped here, executed in a later change once this
  proposal's open questions are resolved.
