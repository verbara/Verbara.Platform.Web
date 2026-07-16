## 1. Phase A — Migrate Operations REST hooks (swap-the-T, per file)

Each task: replace the file's hand-written REST request/response interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of
each removed interface name and update imports, then delete the hand-written declaration. `tsc -b`
must stay green after each. Counts in parens = hand-written REST declarations in the file today (14
total across these 3 files).

- [ ] 1.1 `use-cluster.ts` (6)
- [ ] 1.2 `use-queue-metrics.ts` (1)
- [ ] 1.3 `use-supervisor.ts` (7) — `PagedResult<T>` is a local (non-exported) generic envelope;
      keep it as a wrapper around the generated item type rather than treating it as a generated
      type itself

## 2. Phase A-out — Hub-stream payloads (explicitly NOT migrated, listed for accounting)

These 3 files remain Operations-module files but their `*Payload` interfaces are SignalR hub-event
shapes (consumed via `onHubEvent` from `@/core/realtime`), not REST — do NOT migrate them (same
class as `platform-hub.ts`; ADR-0020's deferred follow-up, owner: Pro). No action; recorded so the
module's 6 files are fully accounted for.

- [ ] 2.1 `use-agent-state-stream.ts` (`AgentStateChangedPayload`) — left hand-written, untouched
- [ ] 2.2 `use-cluster-state-stream.ts` (`ClusterNodeStatePayload`) — left hand-written, untouched
- [ ] 2.3 `use-conversation-state-stream.ts` (`ConversationStateChangedPayload`) — left
      hand-written, untouched

## 3. Phase B — Coercion sites (report to the Admin child's tally)

- [ ] 3.1 If any migrated Operations REST hook exposes a genuine `number | string` AOT-wire-union
      field a consumer must normalize to `number`, record it and report it to the shared tally
      tracked in `openapi-typed-client-admin` (the ≥3-genuine-sites decision point lives there).
      Exclude `ai-credits-readout.tsx`'s `as number` casts (not this pattern — retro run 4).

## 4. Phase C — Validation (batch)

- [ ] 4.1 `npm run build` — type-check + bundle clean (`tsc -b` is the drift-catching CI gate)
- [ ] 4.2 `npx vitest run` — unit tests green
- [ ] 4.3 `npx eslint .` — clean (no new errors; i18n:check remains green)
- [ ] 4.4 Confirm no hand-written interface remains for any migrated Operations REST shape, and the
      3 hub-stream `*Payload` interfaces are unchanged
- [ ] 4.5 No `npx playwright test` task required unless a migration alters a user-facing flow —
      swap-the-T is compile-time-only
