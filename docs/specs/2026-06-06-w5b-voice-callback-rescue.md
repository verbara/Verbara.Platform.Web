# Session/Auth Overhaul — W5b Technical Design (voice caller-rescue — priority callback)

> Track W5b of the [ADR-0009](../decisions/0009-agent-presence-session-work-continuity.md) north-star. The **voice** slice W5 (digital) deferred. Cross-repo: `Verbara.Platform` (backend) + `Verbara.Platform.Web` (supervisor UI).

## Goal

When a voice agent's SIP leg dies mid-call (browser/network/pod death, the W3 "zombie agent"), the customer is dropped. **Detect it and automatically call the customer back, routing them to the next live agent in their original queue** — with a per-tenant grace, a 3-attempt anti-loop cap, and a supervisor view for the give-ups.

## Problem (today → target)

- **Today:** `VoiceConversationBridge.OnCallEndedAsync` moves the answered call to `WrapUp`, releases capacity, sends the agent to ACW — and does nothing about the dropped customer. The orphaned WrapUp lingers; the customer is gone and forgotten. W5 rescues the **digital** equivalent; voice had no counterpart.
- **Target:** a leader-gated sweep detects an answered voice call that ended because the **agent** side died, waits a per-tenant grace (cancel-on-return), then originates a **priority callback** to the customer into their origin queue's front; after 3 failed callbacks it escalates to the supervisor stuck-work view.

## Why this shape (deep-analysis findings)

The W5 framing — "voice is blocked because the agent-leg-death signal doesn't exist (Asterisk-deep)" — was wrong on both counts:

1. **Detection already exists, no new AMI plumbing.** The SDK `CallSession` the bridge already loads carries **per-leg `HangupCause` + `LeftAt`** on each `SessionParticipant` (`Verbara.Sdk.Sessions`). The session-level cause keeps only the last leg's, but per-participant values survive — so "agent leg ended non-`NormalClearing`, at/before the caller" is computable in hand. The W3 liveness store (`IAgentLivenessStore.IsAliveAsync`) corroborates. Raw AMI `HangupEvent`/`ContactStatusEvent` (via `IAmiConnection.Subscribe`, unused today) is a **future accelerator**, not a dependency.
2. **The caller can't be kept on the line.** `app_queue` bridges the call (`Queue(${QUEUE_NAME})`); in a 2-party bridge, the agent leg dying tears the caller down too — a reactive AMI `Redirect` loses the race. Keep-on-line would need a dialplan `Queue(…,c)` survival path (fragile) or the ARI/Stasis mixing-bridge re-architecture (multi-track). Both out of scope.

⇒ **Rescue = priority callback** (accept the drop, call back). Most reliable, fits the W1–W5 cadence, reuses ~70% of existing machinery.

## Confirmed decisions

1. Semantics = **priority callback** (not keep-on-line; not the ARI re-bridge).
2. Detection = **layered**: per-leg abnormal `HangupCause` (primary, conservative) **OR** owning agent confirmed not-alive (liveness backstop), inside a per-tenant **grace** window evaluated by a leader-gated sweep.
3. **Front-of-queue + 3-attempt anti-loop** → escalate to supervisor (mirrors W5).
4. A **new** callback conversation is originated; the original WrapUp resolves once the callback is enqueued.

## Detection — per-leg hangup classifier (A1)

Pure, primitive-typed (so it's unit-testable without the SDK-internal `CallSession.AddParticipant`):

```
IsAbnormalAgentHangup(agentCause, agentLeftAt, callerLeftAt):
  agentCause is null            → false   // no evidence
  agentCause == NormalClearing  → false   // deliberate clean hangup
  agentLeftAt is null           → false   // can't order → conservative
  callerLeftAt < agentLeftAt    → false   // caller hung up first → customer-initiated
  else                          → true    // non-normal agent cause, agent left first/together
```

Conservative on purpose — false-negatives are caught by the worker's liveness backstop. On an **answered** call's end, `OnCallEndedAsync` stamps the conversation (left in `WrapUp`) with the cross-task metadata contract:

| key                   | value                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `pendingCallbackEval` | `"true"`                                                                                     |
| `agentLegAbnormal`    | classifier result (`"true"`/`"false"`) over the Agent vs Caller `SessionParticipant`s        |
| `callbackEvalSince`   | `clock.UtcNow.ToString("O")`                                                                 |
| `callbackNumber`      | `session.CallerIdNum` → contact's Voice `ChannelAddress`; **omitted** if blank/`"anonymous"` |
| `originQueueId`       | platform queue id resolved from `session.QueueName` (`{tenant}-{name}` prefix strip)         |

## Config & query (A2/A3)

- `TenantAuthConfig.VoiceCallbackGraceSeconds` (default **25**; `<=0` disables voice rescue for the tenant). Migration **032**.
- `IConversationStore.ListPendingCallbackEvalAsync(ct)` — cross-tenant `WrapUp` conversations with `pendingCallbackEval="true"` (Postgres `metadata->>'pendingCallbackEval' = 'true'`; InMemory mirror). Self-bounds: the worker clears the marker on enqueue/escalate.

## Originator — `CallbackOriginator` (A4)

`OriginateCallbackAsync(tenant, number, originQueueId, rescuedFrom, callbackAttempts, ct) → bool`. Reuses the Pro Dialer `OriginateExecutorBase` (circuit-breaker + trunk-health) like `AgentOutboundDialService`, but dials the **customer** directly:

- `OriginateAction`: `Channel = PJSIP/{trunk}/{number}`, `Context = "stasis-queue"`, `Exten = "s"` (**reuses the existing inbound context — no new dialplan**), `IsAsync`, `Timeout`, `CallerId` = tenant outbound caller id.
- Channel vars: `TENANT_ID`, `QUEUE_NAME` = `{tenant}-{queue.Name}`, `VERBARA_OUTBOUND_ID` = the pre-created conv id (reuses the bridge's existing `OnCallStarted` linkage → zero new GetVars), `QUEUE_PRIO` = `"10"`.
- **Front-of-queue for voice = the Asterisk `QUEUE_PRIO` channel var** (app_queue honors it before `Queue()`); the platform `queue_priority` column orders only the **digital** distribution worker, so the rescue conv sets it `-1` for reporting parity only.
- Trunk via the optional outbound route resolver → default trunk. **DNC skipped** (a callback returns a call to someone who just called us). Conversation persisted **only** after a successful Originate (no orphan), with metadata `rescuedFrom` + `callbackAttempts` + `direction="callback-rescue"`; `ContactId` reused from the original conversation.

## Bridge support (A5)

The callback originated into `stasis-queue` is classified **`Inbound`** by `SessionCorrelator.InferDirection` (the context isn't an outbound pattern), so the existing Inbound-gated bridge handlers process it. Verified — no behavior change, only tests + comments:

- `OnCallStarted` → `LinkOutboundCallAsync` reads `VERBARA_OUTBOUND_ID`, stamps `VoiceLinkedId` on the pre-created (null-owner) rescue conv; its agent screen-pop branch is correctly skipped.
- `OnCallQueued` no-ops on the already-linked conv (no duplicate — relies on CallStarted-before-CallQueued, preserved by the per-session stripe lock).
- `OnCallConnected` activates it on answer (Owner=agent, screen-pop), **preserving `rescuedFrom`/`callbackAttempts`** so a re-dropped callback chains the anti-loop counter.

## Worker — `CallbackRescueWorker.SweepOnceAsync` (leader-gated, ~5 s) (A6)

Resource `callback-rescue:sweep`. **Voice is cluster-only** (the voice/AMI stack registers solely inside the cluster-connection branch), so the worker + lease exist only on a clustered voice-AMI pod — no single-node `AlwaysLeader` stub (unlike the always-on digital W3/W4/W5 sweeps).

```
if (!_leader.IsLeader) return;
foreach conv in ListPendingCallbackEvalAsync():
  grace = cache[tenant] ??= VoiceCallbackGraceSeconds ?? 25
  reload + recheck (WrapUp, pending, !callbackStuck)        // idempotent / cross-pod-safe
  grace<=0 → clearPending; continue
  malformed callbackEvalSince → clearPending; continue      // self-bound
  now-evalSince < grace → continue                          // grace + cancel-on-return window
  attempts>=3 → markStuck + escalate("max_attempts") + clearPending; continue
  worthy = agentLegAbnormal=="true" OR (owner agent: !IsAlive OR Offline)
  !worthy → clearPending; continue                          // clean end + agent present → suppress
  number/originQueue missing → markStuck + escalate("no_number_or_queue") + clearPending; continue
  attempts++ ; save                                         // BEFORE originate (ordering invariant — crash-safe)
  ok = OriginateCallbackAsync(tenant, number, originQueue, rescuedFrom=conv.Id, attempts)
  ok  → clearPending + callbackEnqueued ; resolve original (WrapUp→Resolved, ConversationStateChangedEvent) ; audit conversation.callback.enqueued
  !ok → attempts>=3 ? (markStuck + escalate("originate_failed") + clearPending) : audit conversation.callback.failed (leave pending for retry)
```

No **new** cross-pod event type (reuses `ConversationStateChangedEvent`, already in both `ApiJsonContext` + `PlatformPushJsonContext` — the W4 lesson). EventIds 9140–9145.

## Supervisor (A7) + Web (B)

- `ListCallbackStuckAsync(tenant, ct)` (WrapUp + `callbackStuck="true"`) feeds the existing `GET /supervisor/conversations/stuck`; `StuckConversationDto.Channel` (already present) distinguishes voice. New `POST /supervisor/conversations/{id}/retry-callback` re-arms the rescue (resets `callbackAttempts`, re-stamps `pendingCallbackEval`/`callbackEvalSince`, clears `callbackStuck`) — `reassign` stays digital-only (a dead voice call can't be transferred).
- Web stuck-work tab: voice rows render a Phone icon + "Callback failed N×" with **Retry callback** (`useRetryCallback`) + **Close** (reuses `/close`) actions; digital rows keep the Reassign menu. 3-locale i18n.

## Rejected / deferred (recorded)

- **Keep-the-caller-on-the-line** (dialplan `Queue(…,c)` survival) — loses to bridge teardown / needs fragile normal-vs-abnormal disambiguation.
- **ARI/Stasis mixing-bridge re-architecture** — the proper programmatic-call-control north-star; multi-track, deferred.
- **Raw AMI `HangupEvent`/`ContactStatusEvent` subscription** — a faster, SIP-cause-granular accelerator; not needed (per-leg `CallSession` cause + liveness suffice).
- **No dialplan change shipped** — the callback reuses `[stasis-queue]`. The Helm ConfigMap is load-test-only (no production voice contexts); production K8s voice dialplan is a separate deployment concern.
- **Per-tenant `MaxAttempts`** — const `3` for the MVP.

## Testing

- Backend (build `-warnaserror` 0): `IsAbnormalAgentHangup` branches; call-end stamping (answered/not-answered/anonymous); `ListPendingCallbackEvalAsync`; `CallbackOriginator` (channel/context/vars, no-orphan, queue/trunk failures); bridge rescue-conv lifecycle (link/no-dup/activate-preserving-metadata); worker (leader gate, within-grace, abnormal→originate, clean-end+alive→suppress, not-alive→originate, escalate-3, no-number/queue, grace-disabled, save-before-originate, idempotent reload, malformed-timestamp clear); supervisor voice stuck + retry-callback + RBAC. Api.Tests **1294**, Storage.InMemory **174**.
- Web: build + lint (i18n parity) + vitest **1278** (voice rows + retry/close + hook).
- Manual E2E: agent on a call → kill the browser → after grace (~25 s) the customer is called back into the front of their origin queue and another agent picks up; agent returns / call ended normally → no callback; 3 failed callbacks → escalated + visible in the supervisor stuck-work view with a voice indicator.

## Delivery

See the [ADR-0009 W5b record](../decisions/0009-agent-presence-session-work-continuity.md#w5b--voice-caller-rescue-designed--shipped-2026-06-06) for the per-task commit list. Platform `w5b-voice-callback-rescue`; Web `w5b-voice-callback-rescue-web`.
