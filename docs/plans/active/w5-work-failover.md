# Plan — W5 (digital): Failover del trabajo en curso (Agent Presence north-star, track 5 — slice digital)

> Mirrored from the approved ExitPlanMode plan (2026-06-06). ADR: [0009](../../decisions/0009-agent-presence-session-work-continuity.md) (W5 section) · Spec: [W5 design](../../specs/2026-06-06-w5-work-failover.md). Execute via **Subagent-Driven Development** with FCM batching. Auth/routing-sensitive tasks flagged 🔒 get individual focused review. (Cross-repo: backend in `Verbara.Platform`, client here — coordinated delivery like W1+W2, W3 and W4.) `git mv`s to `completed/` on ship.

## Context

**Por qué:** Cuando un agente queda **Offline con trabajo digital activo** (reaper W3, idle-logout, force-offline admin, o el timeout de W4), sus conversaciones quedan **huérfanas** — `RealtimeStateBridge` solo pausa Asterisk; **nada toca las conversaciones**: siguen `Active` con dueño offline, jamás re-enrutadas, el cliente abandonado. Es justo el "trabajo atascado" que W4 deja marcado. W5 (digital) lo **rescata automáticamente**: detecta dueño-offline, espera una gracia (cancela si el agente vuelve), y re-encola la conversación **al frente** de su cola original para que el distribution loop la re-ofrezca a un agente vivo; más herramienta de supervisor para VER el trabajo atascado y reasignar a mano.

**Análisis profundo confirmó** que el eje digital/voz/supervisor es correcto y que **voz (W5b) es un track propio** (su señal de detección agente-leg-muerto no existe y es Asterisk-deep). Y destapó 4 dimensiones que el framing naïve omitía: gracia + cancelar-al-volver, prioridad de re-encolado (saltar al frente), protección anti-loop, y auto+visibilidad juntos. La maquinaria de re-encolado ya existe (`TransferToQueueAsync` + `QueueDistributionWorker`); falta detección + gracia + prioridad + el sweep.

## Confirmed decisions (usuario, tras análisis profundo)

1. **Alcance = W5a (failover digital automático) + W5c (supervisor: vista de atascados + reasignar).** Voz (W5b) diferida a track propio.
2. **Detección = sweep líder-gated** (`WorkFailoverWorker`, calca `PendingPauseDrainWorker`/`AgentLivenessReaper`; resource `work-failover:sweep` + stub `AlwaysLeader` single-node).
3. **Gracia + cancelar-al-volver:** re-encolar solo tras `WorkFailoverGraceSeconds` (por-tenant, default 30; 0 deshabilita) desde que el dueño quedó Offline; si vuelve a routable antes, NO re-encolar.
4. **Prioridad = saltar al FRENTE** de la cola + **tope de re-intentos** (3): tras N, escalar (marcar atascada + audit/alerta supervisor) en vez de re-encolar en loop.

## Diseño núcleo (4 puntos resueltos + decisiones de refinamiento)

- **D1 — Gracia vía `Agent.OfflineSince` (DateTimeOffset?).** Chokepoint verificado: solo dos paths →Offline en prod — `Agent.ForceOffline()` y `Agent.TransitionTo()`. Setear `OfflineSince ??= now` al entrar a Offline (beacons repetidos no reinician el reloj), limpiar al salir. Da cancel-on-return gratis (el agente que vuelve tiene OfflineSince=null y sale de `StreamOfflineAgentsAsync`). Mutators ganan `DateTimeOffset? now = null` (call-sites compilan igual). Migración: columna `agents.offline_since`.
- **D2 — Prioridad vía columna `conversations.queue_priority int NOT NULL DEFAULT 0`.** `ListQueuedAsync`/`ListByStateAsync` pasan a `ORDER BY queue_priority ASC, created_at ASC` (`CreatedAt` es init-only, no se puede restampar). Failover setea `-1` (frente). `QueueDistributionWorker` drena en ese orden → front-load automático, sin cambios en el worker. Nuevo `RequeueToFrontAsync` reusa el cuerpo de `TransferToQueueAsync` (libera capacidad, Active→Escalated→Queued) vía core privado compartido con arg `queuePriority`.
- **D3 — Cola original vía `Metadata["originQueueId"]`,** estampada en el offer (cuando el owner aún es la Queue, `QueueDistributionWorker:129-131`, junto a `_offeredAt`/`_offeredTo`). Failover re-encola a esa cola; si falta (p.ej. takeover sin distribución) → **escalate-only** (no adivinar).
- **D4 — Anti-loop vía `Metadata["failoverAttempts"]`** (incrementa por re-queue); tras **3** → `Metadata["failoverStuck"]`, audit `conversation.failover.escalated`, y se omite en sweeps futuros hasta que un supervisor reasigne (limpia los marcadores).
- **Refinamientos decididos:** failover re-encola SOLO **{Active, OnHold, Consulting}** (cliente conectado); **WrapUp se EXCLUYE** (sin cliente; el `ConversationTimeoutWorker` ya lo cierra por timeout). **Sin evento nuevo** de escalación (la vista supervisor lo ve por la query + audit). **MaxAttempts = const 3** (no per-tenant en MVP). Query de atascados reusa offline-agents × `ListFailoverWorkByOwner` (sin JOIN cross-store nuevo). Backfill: agentes ya-offline → `offline_since` NULL → el worker los salta (sin re-queue masivo en el primer deploy).

## Phase A — Backend (`Verbara.Platform`, rama `w5-work-failover`)

> FCM: A2∥A3∥A4 batch. 🔒 individual: A1, A5, A6, A7. AOT/source-gen, TreatWarningsAsErrors, test naming `Method_ShouldExpected_WhenCondition`. Migración **031** (single file: `agents.offline_since` + `tenant_auth_config.work_failover_grace_seconds` + `conversations.queue_priority`).

- **A1 🔒** — `Agent.OfflineSince` + set/clear en `ForceOffline`/`TransitionTo` (chokepoint, `??=` al entrar, null al salir; `now` opcional) + threading store Postgres/InMemory (calca `auto_answer`/pending\_\* nullable) + columna en migración 031. Tests: set-on-offline, no-reset-en-repetido, clear-al-volver, round-trip.
- **A2** — `TenantAuthConfig.WorkFailoverGraceSeconds=30` end-to-end (record + Postgres threading; columna en migración 031). Tests: default-30, round-trip.
- **A3** — `IAgentStore.StreamOfflineAgentsAsync` (calca `StreamRoutableAgentsAsync` pero `state=0`) Postgres+InMemory. Tests: yields-only-offline, across-tenants.
- **A4** — `IConversationStore.ListFailoverWorkByOwnerAsync(tenant, agentId, ct)` (List sibling de `CountActiveWorkAsync`, set {Active,OnHold,Consulting} — sin WrapUp) Postgres+InMemory. Tests: lists-engaged-no-wrapup, owner+tenant-scoped.
- **A5 🔒** — `conversations.queue_priority` + ordering en `ListQueuedAsync`/`ListByStateAsync` + `ConversationSwitchboard.RequeueToFrontAsync` (core compartido con `TransferToQueueAsync`, `queue_priority=-1`, libera capacidad, Active→Escalated→Queued). Tests: front-ordering, requeue-releases-capacity + sets-priority + state path.
- **A6 🔒** — `WorkFailoverLeaderResources.Sweep="work-failover:sweep"` + `WorkFailoverWorker` (loop abajo) + Program.cs (lease en el bloque cluster W3/W4 + stub en el else + `AddHostedService`); estampar `originQueueId` en el offer (`QueueDistributionWorker`); audit `conversation.failover.requeued`/`.escalated`. EventIds 9130–9133. Tests: no-op-not-leader, no-requeue-bajo-gracia, requeue-tras-gracia-al-frente, cancel-al-volver (owner routable), escalate-tras-3-intentos, skip-sin-originQueueId→escalate, idempotente, per-tenant-gracia, skip-cuando-grace=0.
- **A7 🔒** — `GET /api/v1/supervisor/conversations/stuck` (offline-owner × `ListFailoverWorkByOwner` + `failoverStuck`) + `POST /api/v1/supervisor/conversations/{id}/reassign` (body `{targetQueueId|targetAgentId}` → `TransferToQueue`/`TransferToAgent`, limpia marcadores failover vía `Conversation.RemoveMetadata`) en `SupervisorEndpoints.cs` (`SupervisorPlus` + `RequireOperationalTenant`). DTOs en `ApiJsonContext`. Tests: stuck-list (offline-owner + escalated), reassign-to-queue/agent, clears-markers, RBAC forbid, not-found.
- **A8 gate** — `dotnet build -warnaserror` + `dotnet test` verdes.

### WorkFailoverWorker loop (SweepOnceAsync)

```
if (!_leader.IsLeader) return;
now; graceCache(tenant->seconds);
await foreach (offlineAgent in _agentStore.StreamOfflineAgentsAsync(ct)):
  grace = cache[tenant] ??= cfg.WorkFailoverGraceSeconds ?? 30;  if (grace<=0) continue;
  if (offlineAgent.OfflineSince is null || now - OfflineSince < grace) continue;   // gracia
  await foreach (conv in _conv.ListFailoverWorkByOwnerAsync(tenant, agentId)):
    // re-load + re-check owner still offline & still owns & state in {Active,OnHold,Consulting} (idempotente)
    attempts = conv.Metadata["failoverAttempts"] ?? 0;
    if (attempts >= 3 || conv has failoverStuck): continue;  // ya escalada
    originQueueId = conv.Metadata["originQueueId"];
    if (originQueueId is null): markStuck + audit escalated; continue;   // no adivinar
    conv.Metadata["failoverAttempts"]=attempts+1; save;  // PERSISTIR ANTES de re-queue (anti-loop)
    await _switchboard.RequeueToFrontAsync(convId, tenant, originQueueId);  // libera cap + Active→Escalated→Queued + priority=-1
    audit requeued;  // RequeueToFront emite ConversationStateChangedEvent
```

## Phase B — Client (`Verbara.Platform.Web`, rama `w5-work-failover-web`)

> Gate: `npm run build` + `npm run lint`(+i18n:check) + `npm run test`. 🔒: el stuck-work UI.

- **B1** — hooks `useStuckConversations()` (`GET /supervisor/conversations/stuck`) + `useReassignConversation()` (`POST .../{id}/reassign`) en `use-supervisor.ts` (calcan `useSupervisorConversations`/`useTakeoverConversation`, invalidan).
- **B2 🔒** — **tercera tab en `monitor-page.tsx`** (`voice|digital|stuck` — integración más liviana que una página nueva) → `stuck-work-tab.tsx`: lista de atascados + "owned by (offline) / stuck for X" + acciones **Reassign to queue** / **Reassign to agent**. i18n 3 locales en `operations.json`.
- **B3** — tests: lista, reassign-to-queue/agent llaman el hook, empty-state.

## Docs (Web repo, como W3/W4)

- ADR-0009: sección W5 (DIGITAL-only shipped: detección owner-offline + gracia/cancel-on-return + re-queue front + anti-loop + supervisor; **voz W5b explícitamente diferida**; cierra la dependencia W4→W5 en la línea de "stuck work").
- Spec `docs/specs/2026-06-06-w5-work-failover.md` (modelo OfflineSince+grace, queue_priority front, originQueueId, loop-protection, WrapUp excluido, worker loop, endpoints supervisor).
- Mirror del plan a `docs/plans/active/w5-work-failover.md` (→ `completed/` al mergear).

## Phase C — Secuencia y review

**Cierre W4 primero (al salir de plan mode):** sync `main` en ambos repos, `git mv` plan W4 `active/`→`completed/`, retirar ramas W4 (`w4-deferred-pause`/`-web`), actualizar memorias/roadmaps/CLAUDE.md a SHIPPED (PRs #43→`0fc1760` / #77→`c8b6233`). Luego ramar W5 desde `main`.

Orden: A1 🔒 → (A2∥A3∥A4) → A5 🔒 → A6 🔒 → A7 🔒 → A8 gate → B1 → B2 🔒 → B3 → gate B → docs → **holística cross-repo final** (atrapó 2 Critical en W4 — mismo rigor) → finishing (Push + PR ambos repos, confirmando antes). Subagent-Driven + review de dos etapas por tarea.

## Critical files

Backend: `Queues/Agent.cs` (OfflineSince) · `Queues/IAgentStore.cs` (+StreamOfflineAgentsAsync) · `Conversations/IConversationStore.cs` (+ListFailoverWorkByOwnerAsync) · `Conversations/Conversation.cs` (+QueuePriority/RemoveMetadata) + `ConversationStateMachine.cs` (+FailoverWorkStates) · `Switchboard/IConversationSwitchboard.cs`+`ConversationSwitchboard.cs` (RequeueToFrontAsync) · `Api/Services/WorkFailoverWorker.cs`+`WorkFailoverLeaderResources.cs` (nuevos, calcan PendingPauseDrainWorker) · `Api/Services/QueueDistributionWorker.cs` (originQueueId stamp) · `Api/Endpoints/SupervisorEndpoints.cs` + `Serialization/ApiJsonContext.cs` · `Identity/TenantAuthConfig.cs` + `Storage.Postgres/Stores/{PostgresAgentStore,PostgresTenantAuthConfigStore,PostgresConversationStore}.cs` + `Migrations/031_*.sql` + `Storage.InMemory/*` · `Api/Program.cs` (lease + worker).
Cliente: `src/core/api/hooks/use-supervisor.ts` · `src/operations/monitor/monitor-page.tsx` + `stuck-work-tab.tsx` (nuevo) · `public/locales/{en-US,es-419,pt-BR}/operations.json`.

## Verification

- Backend: `dotnet build -warnaserror` + `dotnet test` (OfflineSince set/clear, grace config, StreamOffline/ListFailoverWorkByOwner, queue_priority front-ordering, RequeueToFront, worker: gracia/cancel-on-return/requeue-front/escalate-3/skip-no-origin/grace=0, supervisor stuck+reassign+RBAC).
- Cliente: build + lint(+i18n) + test (stuck list, reassign hooks).
- E2E manual: agente con 2 chats activos → Offline → tras gracia (~30s) los chats re-encolan **al frente** y los re-ofrece a otro agente; el agente vuelve dentro de la gracia → NO se re-encola; 3 fallos → escala + alerta supervisor; WrapUp huérfano → NO se re-encola (lo cierra el wrapup-timeout); supervisor ve la lista de atascados y reasigna a cola/agente.

## Open questions (resueltas; reconfirmar en review si aplica)

1. Evento de escalación → **sin evento nuevo** (vista supervisor por query+audit). 2. MaxAttempts → **const 3**. 3. Stuck query → **reusa offline-agents × `ListFailoverWorkByOwner`** (sin JOIN cross-store nuevo). 4. Conv sin originQueueId → **escalate-only**. 5. WrapUp → **excluido** (lo cierra el wrapup-timeout). 6. Backfill OfflineSince → **NULL skip** (sin re-queue masivo).

## Conventions

Subagent-Driven Development con FCM batching. Conventional Commits, sin `Co-Authored-By`/referencias a IA. AOT/no-reflection, source-gen JSON (cualquier evento/DTO nuevo en `ApiJsonContext` **y** `PlatformPushJsonContext` + guard SSE si cruza pods — lección W4). Cross-repo (backend + Web) — entrega coordinada como W1–W4. `finishing-a-development-branch` al cierre (Push + PR en ambos repos, confirmando antes).

## Status log

- **2026-06-06 — Plan approved.** Branches `w5-work-failover` (Platform) and `w5-work-failover-web` (Web) created from `main`; ADR-0009 W5 section flipped to designed + shipped (digital slice), W5 spec written, and this plan mirrored to `docs/plans/active/`.
- **2026-06-06 — Phase A (backend) shipped** via 8 commits on `w5-work-failover`:
  - `ca9b0a9` — A1 🔒: `Agent.OfflineSince` set/clear at the `ForceOffline`/`TransitionTo` chokepoint (`??=` on entering Offline, null on leaving; optional `now`) + Postgres/InMemory threading + migration `031` column `agents.offline_since`.
  - `a7c3d9c` — A1 fix: InMemory presence path stamps `OfflineSince` + threads the clock (the InMemory presence service set Offline outside the mutators that stamp the clock).
  - `332f45b` — A2 + A3 + A4: per-tenant `TenantAuthConfig.WorkFailoverGraceSeconds` (default 30) end-to-end, `IAgentStore.StreamOfflineAgentsAsync`, and `IConversationStore.ListFailoverWorkByOwnerAsync` ({Active,OnHold,Consulting}, excludes WrapUp/parked/pre-accept).
  - `808f35e` — A5 🔒: `conversations.queue_priority` (migration `031`) + `ListQueuedAsync`/`ListByStateAsync` `ORDER BY queue_priority ASC, created_at ASC` + `ConversationSwitchboard.RequeueToFrontAsync` (shared core with `TransferToQueueAsync`, releases capacity, `queue_priority=-1`).
  - `43e4cc2` — A5 fix: `OnHold`/`Consulting` must bridge back to `Active` before `Active→Escalated→Queued` (a held/consulting conversation cannot transition straight to `Queued`).
  - `9b89230` — A6 🔒: `WorkFailoverWorker` (leader-gated `work-failover:sweep`, ~5 s, single-node `AlwaysLeader` stub) — grace gate + cancel-on-return + persist-attempts-before-requeue anti-loop + escalate-after-3 / no-origin + audits `conversation.failover.requeued`/`.escalated`.
  - `b2afff7` — A6 fix: **O1** — re-load the offered instance and stamp `originQueueId` on it (`QueueDistributionWorker` had re-saved its stale `Queued` snapshot after `OfferToAgentAsync` saved `Offered`, reverting `Offered→Queued` in Postgres) + crash `EventId` fix.
  - `909c0ac` — A7 🔒: `GET /api/v1/supervisor/conversations/stuck` + `POST /api/v1/supervisor/conversations/{id}/reassign` ({targetQueueId|targetAgentId}, clears failover markers via `Conversation.RemoveMetadata`, `SupervisorPlus`).
  - Gates: `dotnet build -warnaserror` 0 warnings; Queues 65, Storage.InMemory 164, Switchboard 55, Api.Tests 1255.
- **2026-06-06 — Phase B (client) shipped** via 2 commits on `w5-work-failover-web`:
  - `bbbe352` — supervisor stuck-work view: a third **"Stuck Work"** tab in `monitor-page.tsx` (`voice|digital|stuck`) + `stuck-work-tab.tsx` + `useStuckConversations`/`useReassignConversation` hooks + 3-locale i18n.
  - `8bfb086` — add the `consulting` state label for the stuck-work view (i18n parity).
  - Gates: `npm run build` clean, lint 0, i18n parity OK, vitest 1272.
- **Two-stage reviews passed.** The A1 individual review caught + fixed the InMemory-presence path not stamping `OfflineSince`/clock (`a7c3d9c`). The A5 review caught + fixed the `OnHold`/`Consulting` → `Active` bridge before re-queue (`43e4cc2`). The A6 review caught + fixed the **O1** offered-instance stamp + crash EventId (`b2afff7`). The B2 (stuck-work UI) review surfaced the missing `consulting` friendly label (`8bfb086`). The A6/A7 routing-sensitive reviews and the final holistic cross-repo review passed.
- **Deferred (recorded, not built):** the whole **voice caller-rescue track (W5b)** — its agent-leg-death detection signal does not exist (Asterisk-deep); per-tenant `MaxAttempts` (constant 3 for now); a `consulting`-and-beyond friendly-label completeness pass (ADR-0009 W5.x).
- `git mv`s `active/` → `completed/` on ship.
