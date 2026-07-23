## Context

Per-module child of the `openapi-generated-types` migration, split out by
`openapi-typed-client-phase2` (archived as superseded, resolution 2 = per-module children). This
is the **Operations** child. Thin by design — the mechanism is fixed by the archived phase-1
design; this file adds the Operations-module file list and the REST-vs-SignalR scoping boundary
this module surfaces.

**Mechanism (do not re-derive — see archived phase-1 design):**
`openspec/changes/archive/2026-07-12-openapi-typed-client/design.md` records the settled decisions
this child inherits verbatim: `openapi-typescript` codegen; committed `openapi.d.ts` refreshed by
`npm run generate:api-types` (not CI-fetch); swap-the-T at each hook (`T` → generated schema type,
`client.ts` untouched); structural-vs-nominal grep-before-delete discipline.

## Scope — Operations module (6 files; 14 REST decls migrated, 3 hub payloads out)

Ownership: Operations owns realtime monitoring (wallboard, agent states, cluster state, supervisor,
live queue metrics). Of its 6 hook files:

- **Migrate (3 REST hooks, 14 declarations):** `use-cluster.ts` (6), `use-queue-metrics.ts` (1),
  `use-supervisor.ts` (7) — all flow through `customFetch<T>`, so their request/response shapes are
  representable in the OpenAPI document. `use-supervisor.ts`'s local `PagedResult<T>` generic
  envelope (not exported) is a structural wrapper — handle per-hook (it may wrap a generated item
  type rather than being a generated type itself).
- **DO NOT migrate (3 hub-stream hooks, 3 payloads):** `use-agent-state-stream.ts`
  (`AgentStateChangedPayload`), `use-cluster-state-stream.ts` (`ClusterNodeStatePayload`),
  `use-conversation-state-stream.ts` (`ConversationStateChangedPayload`). Each `*Payload` is a
  **SignalR hub-event shape** consumed via `onHubEvent` from `@/core/realtime` — the exact class
  the phase-1 change carved out for `src/core/realtime/platform-hub.ts`. Hub messages have no REST
  paths and are not representable in the OpenAPI document. This is ADR-0020's deferred follow-up
  (owner: Pro), and the living spec already carries a "Realtime SignalR payloads remain
  hand-written and out of scope" requirement — this child honors it.

## Non-Goals

- Migrating any Admin / Agent / Analytics hook (sibling children own those).
- Migrating any SignalR hub-event payload (the 3 `*-state-stream` `*Payload` interfaces or
  `platform-hub.ts`'s interfaces) — out of scope, ADR-0020's deferred follow-up (owner: Pro).
- Implementing the shared coercion helper (the Admin child gathers sites; helper deferred to ≥3).
- Any Platform endpoint/DTO change — this child only consumes the document.

## Open Questions

None. Mechanism fixed by the archived phase-1 design; grouping fixed by phase2's resolution 2; the
REST-vs-SignalR boundary is fixed by the capability's existing out-of-scope requirement. Any real
upstream drift on a migrated REST hook surfaces at `tsc -b` and is handled per-hook.
