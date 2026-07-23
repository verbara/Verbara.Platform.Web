## ADDED Requirements

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
