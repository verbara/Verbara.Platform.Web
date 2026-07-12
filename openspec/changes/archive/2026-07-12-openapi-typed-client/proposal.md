---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Platform/ADR-0035
---

## Why

The csat-runner incident (Web PR#159, v3.13.1-web) shipped a hand-written consumer DTO
(`CsatQueueSummary` in `src/core/api/hooks/use-analytics.ts`) that drifted from the real
Platform contract — the exact class of bug the cross-repo `openapi-typed-client` train
(host: Verbara.Platform, `decision_ref: Platform/ADR-0035`) exists to remove. This repo
hand-declares ~277 request/response interfaces across 62 hook files under
`src/core/api/hooks/`; every one of them can silently drift the same way, because nothing
checks them against the real API shape at build time.

This is a **child change derived from the cross-repo contract**
(`Verbara.Platform/openspec/changes/openapi-typed-client/impact.yaml` + golden fixture
`fixtures/openapi-document.v1.sample.json`). Web is the decoupled consumer (buildOrder 2)
of the OpenAPI document the Platform host child publishes as a CI artifact.

## What Changes

- **Codegen tooling (NET-NEW):** add `openapi-typescript` to generate TypeScript types
  from Platform's exported OpenAPI document at `/api/v1/analytics/csat/queues/{queueId}`
  and every other documented route — a single generated `.d.ts` becomes the source of
  truth for wire shapes, replacing hand-written interfaces one hook at a time.
- **Build wiring (NET-NEW):** wire codegen into the repo so the existing `tsc -b` gate in
  the `build` CI job (`.github/workflows/ci.yml`) type-checks against generated types —
  no new CI job; the current blocking `build` job absorbs it for free.
- **Phased migration (EXTEND):** migrate hand-written interfaces in
  `src/core/api/hooks/` to the generated types behind `client.ts`'s existing generic `<T>`
  integration point (swap-the-T, no call-site plumbing). First slice: the CSAT analytics
  hook (`useCsatQueueAnalytics` / `CsatQueueSummary` in `use-analytics.ts`) — the exact
  surface that drifted in PR#159, and the one with a golden fixture already in hand
  (`CsatResponseDto`). Remaining 61 hook files migrate in later phases (this change
  proposes the mechanism + first slice; it does not claim the full 277-declaration
  migration in one shot).
- No breaking changes to any existing hook's public return type for the migrated slice —
  the generated `CsatResponseDto` type is a structural match for the current
  `CsatQueueSummary` interface it replaces.

**EXPLICITLY OUT (per impact.yaml's scope boundary):** the realtime SignalR boundary. The
4 hand-written hub payload interfaces in `src/core/realtime/platform-hub.ts`
(`PresenceUpdatedPayload`, `SupervisionStartedPayload`, `WhisperReceivedPayload`, and the
hub connection state mapping) are NOT touched — hub messages have no REST paths and are
not representable in the OpenAPI document. Typing that boundary end-to-end is ADR-0020's
deferred follow-up (owner: Pro, `Verbara.Sdk.Pro.Push.SignalR IPlatformHubClient`) and is
out of scope for this train.

## Capabilities

### New Capabilities

- `openapi-generated-types`: the codegen pipeline (tooling + build wiring) that turns
  Platform's published OpenAPI document into a generated TypeScript types file consumed
  by `src/core/api/client.ts`'s generic `<T>`, gated by the existing `tsc -b` build step.

### Modified Capabilities

<!-- None. This repo's openspec/specs/ is intentionally near-empty (hub rule, verbara-meta/ADR-0005);
     Web-behavior living specs are hosted in Verbara.Platform. No existing Web living spec changes. -->

## Impact

- **New dev dependency**: `openapi-typescript` (codegen, dev-only — no runtime footprint).
- **New generated artifact**: a TypeScript declaration file under `src/core/api/` (exact
  path is a design decision — see design.md), refreshed from Platform's
  `/openapi/v1.json` document.
- **Migrated hook**: `src/core/api/hooks/use-analytics.ts` — `CsatQueueSummary` /
  `useCsatQueueAnalytics` swap their hand-written interface for the generated
  `CsatResponseDto` type. No other hook files touched in this child.
- **CI**: no new job — the existing blocking `build` job (`tsc -b && vite build`) gates
  the generated types for free, per impact.yaml.
- **Depends on**: Platform publishing the OpenAPI document as a consumable CI artifact
  (buildOrder 1, host child, Platform/ADR-0035) — API-first, this child cannot fetch a
  real document until that lands; the golden fixture is the contract in the interim.
- **Version re-pin**: 3.13.1-web → 3.14.0-web (per impact.yaml's tentative next-minor
  targets; operator may re-pin at `/xr:release`).
- **Not in scope**: `src/core/realtime/platform-hub.ts` (SignalR hub payloads — see
  "EXPLICITLY OUT" above); the remaining 61 non-CSAT hook files (future phases of this
  same capability, tracked as follow-up tasks, not follow-up changes).
