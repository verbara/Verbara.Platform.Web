# Session/Auth Overhaul — W6 Technical Design (agent channel capacity — tenant default + per-agent override + real `MaxTotal`)

> Track W6 of the [ADR-0009](../decisions/0009-agent-presence-session-work-continuity.md) north-star — the **last** track; with W6 in, W1–W6 are all shipped and the north-star is complete. Cross-repo: `Verbara.Platform` (backend) + `Verbara.Platform.Web` (admin UI).

## Goal

Make an agent's per-channel capacity **configurable** at the product level — a per-tenant **default** (single source of truth) plus a sparse per-agent **override** (per-field-nullable = inherit, resolved at read) — and **actually enforce `MaxTotal`** over the async aggregate, with voice as an exclusive lane. Fold in the two enforcement bugs the analysis surfaced (chat-pool counter + dead `MaxTotal`), pin voice to 1, and audit capacity changes.

## Problem (today → target)

- **Today:** `ChannelCapacity` is **hard-coded** (Voice 1 / Chat 3 / Email 5 / SMS 3). `MaxTotal` is **defined but dead** (no enforcement usage). Nothing — not the agent create/update DTOs, not a tenant editor — can configure capacity. Worse, the live-load dict is keyed by the **raw `ChannelType`** while `GetMax` pools the chat family into `MaxChat`, so each chat sub-channel (WebChat/WhatsApp/Messenger/Instagram/Telegram/Twitter/Video/Rcs) counts separately against `MaxChat=3` → an agent could hold ~24 chats "respecting" `MaxChat=3`; persistence only read the `WebChat` bucket as chat, so non-WebChat chat load persisted as 0. And `HasCapacityAsync` only compared `load[channel] < GetMax(channel)` — it never summed across channels.
- **Target:** capacity is a per-tenant default + sparse per-agent override (resolved at read — no backfill on retune). `MaxTotal` is enforced over the sum of **async** loads (chat-pool + email + sms); voice is an exclusive lane (`MaxVoice` pinned 1, not counted toward `MaxTotal`). The chat counter pools the whole family into one bucket. Capacity changes are audited.

## Why this shape (deep-analysis findings)

Three adversarial critiques + a design synthesis settled the design and caught two pre-existing enforcement bugs that any naive "add an editor + enforce `MaxTotal`" would have sat on top of:

1. **State of the art is "default + sparse override".** Amazon Connect Routing Profiles, Genesys utilization, Five9, and Twilio TaskRouter all model capacity as a shared default with per-agent deviation, resolved at routing time. Per-agent full duplication forces a backfill on every tenant retune — rejected.
2. **`MaxTotal` is only meaningful over the async aggregate.** A single voice call is exclusive (an agent on a call cannot also take a second call today), so counting voice toward a blended `MaxTotal` is wrong until simultaneous voice exists (W5b ARI mixing-bridge). `MaxTotal` therefore caps async (chat-pool + email + sms); voice gates on its own `MaxVoice` lane.
3. **The chat counter was broken**, and persistence dropped non-WebChat chat load — so the enforcement work had to fix the bucket before `MaxTotal` could mean anything.

## Confirmed decisions

1. **D1 — Granularity = per-tenant DEFAULT + per-agent OVERRIDE.** Tenant default = single source of truth; override is **per-field nullable** (`null` per field = inherit) and **resolved at read**, so a tenant retune is one edit with no backfill. (Connect / Genesys / Five9 / Twilio pattern.)
2. **D2 — `MaxTotal` = voice exclusive.** `MaxVoice` pinned **1**, in its own lane, **not** counted toward `MaxTotal` (until the W5b ARI mixing-bridge enables simultaneous voice). `MaxTotal` = ceiling of the async sum = chat-pool + email + sms. Routing gate: voice → `voiceLoad < MaxVoice`; async channel → `pooledLoad[channel] < cap[channel]` **AND** `asyncTotal < MaxTotal`.
3. **D3 — Robustness folded in (no shortcuts):** (a) fix the chat-pool counter across the live path + persistence + reconcile + `GetMax`; (b) pin `MaxVoice=1` server-side (resolver) + read-only in the UI; (c) audit capacity changes (`agent.capacity_override` + `tenant.capacity_default_changed`).

## Representation & seam (D-A / D-B / D-C)

- **Override (D-A):** a new per-field-nullable `ChannelCapacityOverride` (`int?` × 5: MaxVoice/MaxChat/MaxEmail/MaxSms/MaxTotal; all `null` = inherit). `Agent.Capacity` → `Agent.CapacityOverride`, stored in the existing `agents.capacity` jsonb — **no agents-table migration**. Existing `capacity = '{}'` rows deserialize to all-null = "inherit everything" → identical effective behavior (see back-compat).
- **Resolution + dependency constraint (D-B):** `Verbara.Platform.Queues` must **not** reference `Verbara.Platform.Identity` (verified — Queues references only Core + Conversations). So `ICapacityDefaultsProvider` is **defined in `Verbara.Platform.Queues`** and **implemented in `Verbara.Platform.Api`** as `TenantAuthConfigCapacityDefaultsProvider`, reading the already-cached `ITenantAuthConfigStore` (wrapped by `CachedTenantAuthConfigStore`) → **the existing auth hot-path cache + cross-replica invalidation are reused, no new cache** (hard fallback 1/3/5/3/5 if the row is missing). `IAgentCapacityResolver` (in Queues) computes `override.X ?? default.X` and pins `MaxVoice=1`. The **resolver owns the agent read** — one agent read per capacity check (see "What review caught").
- **Tenant-default storage (D-C):** explicit snake_case **columns** on `tenant_auth_config` (NOT jsonb — avoids the camelCase mismatch of `PostgresJsonSerializer`; consistent with `voice_callback_grace_seconds` et al.). Migration **033** seeds `max_voice_default`=1, `max_chat_default`=3, `max_email_default`=5, `max_sms_default`=3, `max_total_default`=5. Edited via the existing `PUT /admin/tenant/settings` (`AdminOnly`), Operational section.

## The `MaxTotal` enforcement gate (D-D / D-E)

`HasCapacityAsync(agentId, channel)`:

```
cap   = resolver.ResolveAsync(agentId)          // override ?? tenant-default, MaxVoice pinned 1; null if agent missing
bucket = NormalizeToCapacityBucket(channel)     // chat family → WebChat; Voice/Email/Sms → self
if channel is Voice:
    return voiceLoad < cap.MaxVoice             // exclusive lane; voice NOT in asyncTotal
else (async channel):
    asyncTotal = chatPoolLoad + emailLoad + smsLoad     // same Active-reserved load the live dict tracks
    return pooledLoad[bucket] < cap[bucket] AND asyncTotal < cap.MaxTotal
```

- **Async denominator (D-D):** `asyncTotal` is the same load the live `_load` dict tracks = conversations `Reserve`d-without-`Release` = `ConversationState.Active` (Accept→Reserve; WrapUp/Transfer/ReturnToBot→Release; OnHold/Consulting/Snoozed do **not** release). `ReconcileAsync` already counts only `Active`, so live and persisted agree. `MaxTotal` is **not** a `ChannelType` and does not come out of `GetMax`; it is summed explicitly.
- **Chat-pool (D-E):** `NormalizeToCapacityBucket(ChannelType)` (chat family → canonical `WebChat`; Voice/Email/Sms → self) is the **first line** of Reserve / Release / GetCurrentLoad / HasCapacity. `PersistCurrentLoadsAsync` is fixed to read the **pooled** bucket; `ReconcileAsync` reserves via the same normalized path.

## Back-compat — no agents migration, legacy normalization in 033

- **No agents-table migration:** existing `capacity = '{}'` jsonb rows deserialize to an all-null `ChannelCapacityOverride` = inherit everything = the seeded tenant default (1/3/5/3/5) = identical effective capacity. The class defaults match the seeded tenant defaults.
- **Legacy normalization (migration 033):** migration **033** also normalizes legacy `agents.capacity` rows to `'{}'`. Pre-W6 the capacity field was never user-settable, so every stored value was just the old hard default — leaving a full-object value would **shadow** the new tenant default. Resetting them to inherit is the lossless, correct normalization.

## Surfaces (DTOs, admin reads, `/agents/me`)

- **Agent create/update** accept a `ChannelCapacityOverride? Capacity`: validate `MaxVoice` null-or-1 → 400; clamp 0–50; emit the `agent.capacity_override` audit on a real change (not a no-op — see review).
- **Admin agent reads** (`GetAgent` / `ListAgents`) return both the raw `override` **and** the resolved `effectiveCapacity` in `AdminAgentResponseDto`, so the UI shows inherited-vs-override per field.
- **`GET /agents/me`** keeps returning the **resolved** effective `ChannelCapacity` (the resolver runs in the endpoint) — the agent app sees its real limits.
- **Tenant defaults** are edited via `PUT /admin/tenant/settings` Operational section: 5 `*Default` fields on `OperationalSettingsDto` / `UpdateOperationalSettingsDto`, clamped, `MaxVoiceDefault` forced to 1, written through `authConfigStore.SaveAsync` (the `CachedTenantAuthConfigStore` write-through auto-invalidates the cache cross-replica).

## Audit (D-F)

Two best-effort `IAuditService.RecordAsync` (mirroring the `ForceAgentOffline` try/catch pattern): `agent.capacity_override` (category `queues`) and `tenant.capacity_default_changed` (category `operational`), each with per-field old/new + actor. **No new cross-pod event** — capacity is read-time-resolved, so it does not touch `PlatformPushJsonContext` or the SSE all-types guard (the W4 lesson is N/A here). The unrelated load-tracking `AgentCapacityChangedEvent` is left untouched.

## Validation / bounds

- `MaxVoice` (override and tenant default): null or `1` only; anything > 1 → 400 (override) / forced to 1 (tenant default).
- Async caps (`MaxChat` / `MaxEmail` / `MaxSms` / `MaxTotal`): clamp 0–50.
- UI warns inline when `maxTotal < (maxChat ?? default)` (a `MaxTotal` below a single channel cap is almost always a misconfiguration).
- Server-side pin + UI read-only both enforce `MaxVoice=1`, so a client bypass still can't raise it.

## What review caught (recorded, like prior tracks)

- **Enforcement cluster:** a **hot-path double agent-read** — the eligibility guard and the resolver each loaded the agent, with a **false "cached" comment** implying otherwise. Fixed by making the **resolver the single read owner** (`ResolveAsync` returns `null` when the agent is missing) → one agent read per capacity check.
- **Endpoints cluster:** (1) an **audit emitted on a no-op** capacity update, (2) **undocumented incidental field drops** on a partial update, and (3) a **missing combined-update test** (override + other agent fields in one request). All three fixed.

## AOT / JSON

`ApiJsonContext` registers `ChannelCapacityOverride`, `ChannelCapacityOverrideDto`, `AdminAgentResponseDto` (+ its paged result if serialized); `PostgresJsonSerializer` adds `[JsonSerializable(typeof(ChannelCapacityOverride))]` (keeping `ChannelCapacity`). Gate: full Native AOT publish with zero warnings.

## Rejected / deferred (recorded)

- **Simultaneous voice (`MaxVoice` > 1)** — blocked on the W5b ARI mixing-bridge re-architecture; voice stays pinned 1.
- **Voice pre-gate** (capacity-checking voice before the bridge) — deferred with simultaneous voice.
- **Per-queue / per-team capacity, scheduled / time-of-day capacity, VIP interrupt lanes, multi-tenant capacity cascade, capacity webhooks** — future granularity, recorded only.
- **Wallboard / analytics capacity-utilization cards** — a W6+1 visualization track.
- **Granular `queues:agent_capacity:configure` permission** — kept **`AdminOnly`** (consistent with every `/admin/*` agent route); granular RBAC later.
- **Atomic last-slot reserve / race** — transient + reconcile-safe → a code comment, not a lock.

## Testing

- **Backend (build `-warnaserror` 0; full AOT publish 0):** override deserialize (empty jsonb → all-null; per-field-null round-trip); tenant-default storage (seeded defaults when columns absent, persist when set); resolver (inherit when override null, use override when set, pin `MaxVoice` ≤ 1, fallback hard defaults when tenant config missing); enforcement (pool all chat sub-channels vs `MaxChat`; block async at `asyncTotal == MaxTotal`; **allow voice when async-total is at `MaxTotal`**; effective override for chat; persist + reconcile pooled chat load); switchboard regression (`AcceptAsync` rejects at async-total `MaxTotal`); endpoints (reject `MaxVoice` > 1, emit capacity audit on change, return effective + override when inheriting, `/agents/me` reflects a changed tenant default, combined override + field update); tenant settings (persist defaults, force `MaxVoiceDefault` → 1, invalidate cache on change). **Api.Tests 1311, Queues 80, Switchboard 56.**
- **Web:** build + lint (i18n parity) + vitest **1301** — `MaxVoice` disabled, tenant-default placeholder when override null, warn when `MaxTotal` < chat cap, submit capacity defaults from tenant settings.
- **Manual E2E:** (1) edit tenant defaults → reload an agent with no override → `/agents/me` reflects the new value (no backfill). (2) override chat for one agent → only that agent changes. (3) reserve 3 distinct chat sub-channels → the 4th chat is rejected (pool). (4) fill async-total to `MaxTotal` (chat+email+sms) → next async rejected, but a voice call **still** connects. (5) `agent.capacity_override` + `tenant.capacity_default_changed` audits with old/new + actor.

## Delivery

See the [ADR-0009 W6 record](../decisions/0009-agent-presence-session-work-continuity.md#w6--capacity-configurability-designed--shipped-2026-06-07) for the per-task commit list. Platform `w6-agent-capacity`; Web `w6-agent-capacity-web`. **W6 closes the ADR-0009 north-star (W1–W6 all shipped).**
