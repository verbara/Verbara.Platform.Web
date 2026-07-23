---
tier: MEDIANO
owner: hreina
approver: hreina
stakeholder: Platform product
decision_ref: Platform/ADR-0035
---

## Why

`openapi-typed-client` (archived 2026-07-12, Web PR#161) proved the swap-the-T mechanism and
migrated the CSAT slice onto the generated `src/core/api/generated/openapi.d.ts`.
`openapi-typed-client-phase2` (archived as superseded) resolved that the remaining hooks migrate as
**four per-module child changes**. This is the **Operations** child — the realtime-monitoring
module's hooks.

The Platform gate is **LIVE**: Platform/ADR-0035 (Accepted 2026-07-12) + Platform `ci.yml`'s
"Export OpenAPI document (CI-runtime capture)" step ship the real document; the committed
`openapi.d.ts` is already generated from it (324 paths, 182 schemas).

## What Changes

- **Migrate the 3 REST Operations hooks** in `src/core/api/hooks/` — `use-cluster.ts` (6),
  `use-queue-metrics.ts` (1), `use-supervisor.ts` (7): 14 hand-written REST request/response
  declarations that flow through `customFetch<T>` — to consume the generated types behind
  `client.ts`'s generic `<T>` (swap-the-T). Full list in tasks.md.
- **The 3 `*-state-stream.ts` hooks stay OUT of the type migration.** `use-agent-state-stream.ts`,
  `use-cluster-state-stream.ts`, and `use-conversation-state-stream.ts` each declare a single
  `*Payload` interface (`AgentStateChangedPayload`, `ClusterNodeStatePayload`,
  `ConversationStateChangedPayload`) that is a **SignalR hub-event payload** consumed via
  `onHubEvent` from `@/core/realtime` — not a REST shape. These are the exact class the phase-1
  change carved out for `src/core/realtime/platform-hub.ts` (hub messages have no REST paths, not
  representable in the OpenAPI document; ADR-0020's deferred follow-up, owner: Pro). They remain
  Operations-module files (so they are listed and accounted for), but their hub-payload
  declarations are NOT migrated by this child.
- **Grep-and-update** any component prop / test import referencing a removed hand-written REST
  interface before deleting each old declaration.
- No breaking changes to any migrated hook's public return type — structural match, or a thin
  coercion wrapper where a `number | string` union needs normalizing.

## Capabilities

### Modified Capabilities

- `openapi-generated-types`: extends the migrated surface to the Operations module's REST hook
  shapes (the 3 `customFetch`-based hooks). Mechanism unchanged. The module's 3 hub-event stream
  hooks are accounted for but their SignalR payloads stay explicitly out (consistent with the
  capability's existing "Realtime SignalR payloads remain hand-written and out of scope"
  requirement).

## Impact

- **Migrated hooks (3 REST)**: `use-cluster.ts`, `use-queue-metrics.ts`, `use-supervisor.ts` — 14
  hand-written REST declarations. No other module's hooks touched.
- **NOT migrated (3 hub-stream)**: `use-agent-state-stream.ts`, `use-cluster-state-stream.ts`,
  `use-conversation-state-stream.ts` — their single `*Payload` each is a SignalR hub-event shape
  (consumed via `onHubEvent`), same class as `src/core/realtime/platform-hub.ts`'s hand-written
  hub payloads (`PresenceUpdatedPayload`, `SupervisionStartedPayload`, `WhisperReceivedPayload`,
  hub connection state), which are NOT migrated either — hub messages have no REST paths, not
  representable in the OpenAPI document (ADR-0020's deferred follow-up, owner: Pro).
- **No new dependency, no new CI job**: the existing blocking `build` job gates the generated types
  for free.
- **No runtime behavior change**: swap-the-T is compile-time-only.
- **GATE (held, 2026-07-16)**: implementation is HELD as backlog pending the cross-repo thread to have Platform emit named response DTOs in its OpenAPI document — the `openapi-typed-client-admin` archive (2026-07-16) found only 6 of 44 hooks migratable because of response-schema scarcity, and this module's 3 REST hooks would hit the same bound. (Cross-repo change id / ADR recorded when that thread opens.)
- **Depends on**: the Platform document is committed as `openapi.d.ts`, but the migratable surface is capped by the response-schema scarcity above — see GATE.
- **Not in scope**: the Admin/Agent/Analytics modules (sibling children); the SignalR hub payloads
  (above); implementing the shared coercion helper (the Admin child gathers sites; deferred to ≥3).
