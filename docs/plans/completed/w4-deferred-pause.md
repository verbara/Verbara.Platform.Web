# Plan — W4: Pausa diferida / "pause-when-free" (Agent Presence north-star, track 4)

> Mirrored from the approved ExitPlanMode plan (2026-06-06). ADR: [0009](../../decisions/0009-agent-presence-session-work-continuity.md) (W4 section) · Spec: [W4 design](../../specs/2026-06-06-w4-deferred-pause.md). Execute via **Subagent-Driven Development** with FCM batching. Auth/routing-sensitive tasks flagged 🔒 get individual focused review. (Cross-repo: backend in `Verbara.Platform`, client here — coordinated delivery like W1+W2 and W3.) `git mv`s to `completed/` on ship.

## Context

**Por qué:** Cuando un agente pide una pausa (Break/Lunch/Training/DND) mientras tiene trabajo en curso, hoy o bien **no puede** (`Busy→Break` es inválido — está en llamada) o bien la pausa **se aplica de inmediato** mostrando "Break" mientras aún tiene 2 chats abiertos. El usuario lo reportó explícitamente: _"el pedir una pausa es inicialmente para que no le lleguen más mensajes o llamadas, y la pausa no sería efectiva hasta que realmente haya terminado totalmente lo que tenga pendiente"_. W4 hace que pedir pausa **bloquee trabajo nuevo al instante** pero el estado solo se vuelve efectivo cuando el trabajo ACTIVO drena a 0.

**Análisis profundo (3 exploraciones + verificación) reveló matices que afinan el diseño:**

- `Busy` es **automático** (sistema lo pone al contestar voz; `Busy→ACW` al colgar). Digital deja al agente `Available` con carga vía `IAgentCapacityService`. → "trabajo en curso" = (voz: conversación `Active`) ∪ (digital: conversaciones activas), no por estado.
- **"carga==0" NO basta:** al colgar, el agente pasa a **ACW** (wrap-up, que _es trabajo_) con carga ya 0, y `ACW→Lunch/Training/DND` es inválido. La condición real de aplicar es **"pending ∧ sin trabajo ACTIVO"**.
- Un **chat parqueado** (`WaitingForCustomer`/`Snoozed`) **mantiene capacidad reservada** → con "carga==0" naïve el agente quedaría rehén. → drenar sobre **trabajo activo** `{Active,OnHold,Consulting,WrapUp}`, excluyendo parqueados.
- No existe `PendingState` ni señal de fin-de-trabajo; `AgentCapacityChangedEvent` está definido pero nunca se publica.
- **QueuePause(true)** confirma el semántico: bloquea llamadas nuevas, mantiene la activa.

## Confirmed decisions (usuario, tras análisis profundo de cada una)

1. **Mecanismo de aplicación = sweep líder-gated (~5s)** que calca el reaper W3. Poletea la condición compuesta y aplica. (No event-driven, no inline-en-release — el bus es per-pod in-process y la condición es compuesta; el sweep la cubre uniformemente y es cluster-safe.)
2. **Drenaje = "sin trabajo ACTIVO"** = cero conversaciones del agente en `{Active,OnHold,Consulting,WrapUp}`. Parqueados `{WaitingForCustomer,Snoozed}` y pre-accept `{Queued,Offered}` **no** bloquean (quedan asignados, se reanudan al volver). Usa una query nueva de "trabajo activo" en el conversation store, NO `GetCurrentLoadAsync` (los parqueados retienen capacidad).
3. **Estados diferibles = {Break,Lunch,Training,DND}** (aux manuales no-routables), con **re-pedido** (cambiar el target mientras está pending). Offline sigue inmediato (sign-off diferido = extensión futura sobre la MISMA maquinaria). ACW es automático, no aplica.
4. **Timeout pending = forzar + alertar supervisor.** Por-tenant `PendingPauseTimeoutMinutes` (default 30); tras T fuerza el estado igual Y emite alerta/audit marcando el trabajo atascado para W5 (el rescate real es W5, fuera de alcance).

## Diseño núcleo

- **`PendingState` en el agente** — pedir pausa NO cambia `State`; registra el target. Add `Agent.PendingState (AgentState?)`, `PendingReason (string?)`, `PendingSince (DateTimeOffset?)` + `Agent.ApplyPendingState()` (bounded-bypass que calca `ForceOffline()` de W1: force-set al target + limpia pending; NO se ensancha la tabla pública). Migración + threading store (Postgres + InMemory) + `StreamPendingPauseAgentsAsync` (calca `StreamRoutableAgentsAsync` de W3).
- **Bloqueo inmediato de trabajo nuevo** al fijar PendingState:
  - Digital: excluir agentes con pending de `InMemoryAgentPresenceService.GetAvailableAgentsAsync` (predicate gana `&& !HasPendingPause`) → se propaga a `MembershipAwareRoutingEligibilityService`.
  - Voz: **QueuePause inmediato** aunque `State` siga routable. Nuevo `AgentPendingStateChangedEvent(tenant,agent,name,pendingState|null)` que `RealtimeStateBridge` consume → `QueuePause(true)` al fijar, unpause al limpiar (si State routable). **Requiere cross-pod**: registrar en `PlatformPushJsonContext` + `case "agent.pending_state_changed"` en `RemoteEventDispatcher` (igual que `AgentStateChangedEvent`).
- **Query de trabajo activo** — `IConversationStore.CountActiveWorkAsync(tenant, agentId, ct)` contando `{Active,OnHold,Consulting,WrapUp}` con `owner_kind=Agent` (patrón `COUNT(*)` + `ExecuteScalarAsync<long?>`); cubre voz (las llamadas son Conversations) y digital. Set canónico `ConversationStateMachine.ActiveWorkStates`.
- **Drain worker** — `PendingPauseDrainWorker : BackgroundService` líder-gated (calca `AgentLivenessReaper`: `SweepOnceAsync` público, `PeriodicTimer(5s,_clock)`, OCE-shutdown swallow, fatal rethrow, `[LoggerMessage]` EventIds distintos, `[FromKeyedServices(PendingPauseLeaderResources.Sweep)] IClusterLeader` + stub `AlwaysLeader` single-node). Cada tick (líder): `StreamPendingPauseAgentsAsync` → re-load + re-check pending (idempotente) → si `CountActiveWorkAsync==0` aplica; si queda trabajo y `now-PendingSince ≥ timeout` fuerza + alerta/audit; si no, deja pending. Al aplicar: `ApplyPendingState` + `SaveAsync` + publica `AgentStateChangedEvent(old→target)` (deja el QueuePause del estado no-routable final; NO re-publica el pending event).
- **API** (extender `AgentEndpoints.cs`): `PUT /me/state` **pending-aware** (target diferible + trabajo activo → set pending + bloquear, sin cambiar State; sin trabajo → aplica ya; re-pedido → actualiza target; routable/Offline estando pending → cancela pending + aplica). `POST /me/pause/cancel` (limpia pending, unpause, sigue routable). `POST /me/pause/force` (`ApplyPendingState` ya, el trabajo activo continúa). Todos idempotentes. DTO `AgentMeResponseDto` gana `pendingState/pendingReason/pendingSince/activeWorkCount` (registrar en `ApiJsonContext`).

## Phase A — Backend (`Verbara.Platform`, rama `w4-deferred-pause`)

> FCM: A2∥A3 batch. 🔒 individual: A1, A4, A5, A6. AOT/source-gen, TreatWarningsAsErrors, test naming `Method_ShouldExpected_WhenCondition`.

- **A1 🔒** — Agent `PendingState/PendingReason/PendingSince` + `ApplyPendingState()` + `HasPendingPause`; **migración 030** (columnas `pending_*` en `agents` + `pending_pause_timeout_minutes` en `tenant_auth_config`); threading Postgres (5 SELECTs incl. streams, INSERT/VALUES/ON CONFLICT, binders, Row/Map/ToAgent — calca `auto_answer` nullable) + InMemory; `IAgentStore.StreamPendingPauseAgentsAsync`. Tests: ApplyPendingState (set/no-op/from-ACW), round-trip pending, stream-only-pending.
- **A2** — `TenantAuthConfig.PendingPauseTimeoutMinutes=30` end-to-end (record + Postgres threading; columna ya en migración 030). Tests: default-30, round-trip.
- **A3** — `IConversationStore.CountActiveWorkAsync` + `ConversationStateMachine.ActiveWorkStates`/`IsActiveWork`; Postgres (`COUNT(*) ... state IN (...) AND owner_kind=Agent AND owner_id=@`) + InMemory. Tests: cuenta engaged, excluye parqueados/pre-accept/cerrados, cuenta voz.
- **A4 🔒** — exclusión de eligibility (`GetAvailableAgentsAsync` + `!HasPendingPause`); `AgentPendingStateChangedEvent` + registro cross-pod (`PlatformPushJsonContext` + `RemoteEventDispatcher`); `RealtimeStateBridge` maneja el evento (refactor a `ApplyPauseAsync` compartido; pausa al set, unpause al clear). Tests: exclude-when-pending, QueuePause true/set & false/clear, regresión AgentStateChanged.
- **A5 🔒** — DTO fields + `GetCurrentAgent` pasa `activeWorkCount`; `PUT /me/state` pending-aware (tabla de comportamiento) + `pause/cancel` + `pause/force`; `TimeProvider` para `PendingSince`. Tests: set-pending-con-trabajo, aplica-sin-trabajo, re-pedido, cancel+aplica-al-pedir-Available, publish-pending-event, cancel (pending/no-op), force (pending/no-op), DTO con pending+count.
- **A6 🔒** — `PendingPauseLeaderResources.Sweep="pending-pause:sweep"` + `PendingPauseDrainWorker` (loop arriba) + Program.cs (lease en el bloque cluster W3 + stub en el else single-node + `AddHostedService`); timeout force-apply + `RaiseTimeoutAlertAsync` (audit `agent.pending_pause.forced_timeout` warning + metadata trabajo atascado). Tests: no-op-not-leader, apply-sin-trabajo, no-apply-con-trabajo-bajo-timeout, force+audit-pasado-timeout, idempotente, publica state+pending-cleared, skip-timeout-cero.
- **A7 gate** — `dotnet build -warnaserror` + `dotnet test` verdes.

## Phase B — Client (`Verbara.Platform.Web`, rama `w4-deferred-pause-web`)

> Gate: `npm run build` (tsc -b) + `npm run lint` (eslint + i18n:check) + `npm run test`. 🔒 individual: B2.

- **B1** — `Agent` type gana `pendingState/pendingReason/pendingSince/activeWorkCount`; hooks `useCancelPendingPause` (`POST /me/pause/cancel`) + `useForcePendingPause` (`POST /me/pause/force`) (calca `useUpdateAgentState`, invalidan `['agent-me']`).
- **B2 🔒** — `agent-status-selector.tsx`: **fix casing bug** (línea 47, `.toLowerCase()` + map `break→on_break`); indicador "{target} (pending)" + hint "termina tus N ítems activos"; botones **Apply now** (force) + **Cancel** (cancel) solo cuando pending; pedir diferible llama `updateState.mutate` como hoy (el backend decide).
- **B3** — confirmar que `agent.state_changed` (SSE, `use-sse.ts:153`) invalida `['agent-me']` para reflejar la aplicación; el set-pending se refleja del response/invalidación. (Push dedicado `agent.pending_state_changed` al navegador = refinamiento opcional, diferido.)
- **B4** — i18n 3 locales en `agent.json` `agent_status.*`: `pending_label`, `finish_active_items`, `apply_now`, `cancel_pending`.
- **B5** — tests: muestra pending-label, muestra finish-hint, force/cancel clicks, regresión casing PascalCase.

## Docs (Web repo, como W3)

- ADR-0009: sección W4 (decisión sweep líder-gated; drenaje activo-vs-parqueado; diferibles {Break,Lunch,Training,DND}; Offline inmediato/futuro; timeout + hand-off a W5).
- Spec `docs/specs/2026-06-06-w4-deferred-pause.md` (modelo PendingState, flujo set→bloqueo / apply→state-change, contratos endpoint, drain worker, voz vs digital, query active-work, nota cross-pod).
- Mirror del plan a `docs/plans/active/w4-deferred-pause.md` (→ `completed/` al mergear).

## Phase C — Secuencia y review

A1 🔒 → (A2 ∥ A3) → A4 🔒 → A5 🔒 → A6 🔒 → A7 gate → B1 → B2 🔒 → (B3 ∥ B4) → B5 → gate B. Review individual 🔒: **A1, A4, A5, A6, B2**. Subagent-Driven Development con FCM batching + revisión de dos etapas por tarea + holística cross-repo final.

## Critical files

Backend: `Queues/Agent.cs` · `Queues/IAgentStore.cs` (+`StreamPendingPauseAgentsAsync`) · `Queues/Services/InMemoryAgentPresenceService.cs` (exclusión) · `Conversations/IConversationStore.cs` + `ConversationStateMachine.cs` (+`CountActiveWorkAsync`/`ActiveWorkStates`) · `Core/PlatformEventBus.cs` (+`AgentPendingStateChangedEvent`) · `Core/Push/PlatformPushJsonContext.cs` + `Realtime/Services/RemoteEventDispatcher.cs` (cross-pod) · `Api/Services/RealtimeStateBridge.cs` (pending pause) · `Api/Endpoints/AgentEndpoints.cs` + `AgentMeResponseDto.cs` + `Serialization/ApiJsonContext.cs` · `Api/Services/PendingPauseDrainWorker.cs` + `PendingPauseLeaderResources.cs` (nuevos, calcan `AgentLivenessReaper`/`AgentLivenessLeaderResources`) · `Identity/TenantAuthConfig.cs` + `Storage.Postgres/Stores/{PostgresAgentStore,PostgresTenantAuthConfigStore,PostgresConversationStore}.cs` + `Migrations/030_DeferredPause.sql` + `Storage.InMemory/*` · `Api/Program.cs` (lease + worker).
Cliente: `src/core/api/hooks/use-agents.ts` · `src/agent/inbox/agent-status-selector.tsx` · `public/locales/{en-US,es-419,pt-BR}/agent.json`.

## Verification

- Backend: `dotnet build -warnaserror` + `dotnet test` (ApplyPendingState, round-trip pending, active-work query incl. parqueados/voz, eligibility exclusion, QueuePause set/clear, endpoints pending/cancel/force, drain worker apply/timeout/idempotente).
- Cliente: build + lint(+i18n) + test (pending-label, finish-hint, force/cancel, casing).
- E2E manual: (1) voz en llamada pide Break → pending, llamadas nuevas bloqueadas, llamada sigue; al colgar+wrap-up → Break aplica ≤5s. (2) digital 2 chats activos pide Lunch → pending "termina 2 ítems"; cierra ambos → Lunch aplica. (3) chat parqueado NO bloquea → aplica ya. (4) force-now. (5) cancel. (6) timeout bajo + trabajo activo → fuerza + audit `agent.pending_pause.forced_timeout` + alerta.

## Open questions (resolver en impl/review)

1. Push dedicado `agent.pending_state_changed` al navegador para indicador pending cross-tab instantáneo — diferido salvo que se requiera sync multi-tab.
2. `ForcePendingPause`/`CancelPendingPause` cuando no hay pending → 200 no-op idempotente (vs 409). Default 200.
3. Surface admin para `PendingPauseTimeoutMinutes` (¿el form de tenant-auth-config ya expone `AgentLivenessTimeoutSeconds`? alinear).
4. Confirmar columnas reales del conversation store (`owner_kind`/`owner_id`/`state` int) + el enum `ConversationOwnerKind.Agent` al implementar A3.

## Conventions

Subagent-Driven Development con FCM batching. Conventional Commits, sin `Co-Authored-By`/referencias a IA. AOT/no-reflection, source-gen JSON. Cross-repo (backend + Web) — entrega coordinada como W1+W2 y W3. `finishing-a-development-branch` al cierre (Push + PR en ambos repos, confirmando antes).

## Status log

- **2026-06-06 — Plan approved.** Branches `w4-deferred-pause` (Platform) and `w4-deferred-pause-web` (Web) created from `main`; ADR-0009 W4 section flipped to designed + shipped, W4 spec written, and this plan mirrored to `docs/plans/active/`.
- **2026-06-06 — Phase A (backend) shipped** via 6 commits on `w4-deferred-pause`:
  - `f0247cb` — A1 🔒: Agent `PendingState/PendingReason/PendingSince` + `ApplyPendingState()` (bounded bypass mirroring W1 `ForceOffline()`) + `HasPendingPause`, migration `030_DeferredPause.sql` (`pending_*` on `agents` + `pending_pause_timeout_minutes` on `tenant_auth_config`), Postgres + InMemory threading, and `IAgentStore.StreamPendingPauseAgentsAsync`.
  - `7332d8a` — A2 + A3: per-tenant `TenantAuthConfig.PendingPauseTimeoutMinutes` (default 30) end-to-end, and `IConversationStore.CountActiveWorkAsync` + `ConversationStateMachine.ActiveWorkStates` (active `{Active,OnHold,Consulting,WrapUp}`, excludes parked/pre-accept).
  - `047a5b6` — A4 🔒: digital eligibility exclusion (`!HasPendingPause` propagating to routing + round-robin sticky bypass), `AgentPendingStateChangedEvent` + cross-pod registration (`PlatformPushJsonContext` + `RemoteEventDispatcher`), and `RealtimeStateBridge` voice `QueuePause` on set / unpause on clear.
  - `46feaea` — A5 🔒: pending-aware `PUT /me/state` + `POST /me/pause/cancel` + `POST /me/pause/force`; `AgentMeResponseDto` gains `pendingState/pendingReason/pendingSince/activeWorkCount`.
  - `48060a7` — A5 flicker fix: cancel-and-apply to a NON-routable target (e.g. Offline) must also skip the `pending(null)` event (otherwise unpause-then-repause flickers); SET-before-publish ordering invariant enforced.
  - `a00f1b27` — A6 🔒: `PendingPauseDrainWorker` (leader-gated `pending-pause:sweep`, ~5 s, single-node `AlwaysLeader` stub) applying on natural drain, force-applying + audit `agent.pending_pause.forced_timeout` past the per-tenant timeout.
  - Gates: `dotnet build -warnaserror` 0 warnings; Queues 58, Storage.InMemory 152, Api.Tests 1235.
- **2026-06-06 — Phase B (client) shipped** via 2 commits on `w4-deferred-pause-web`:
  - `008c969` — pending UX in `agent-status-selector` ("{state} (pending)" + "finish N active items" + Apply-now/Cancel) + the long-standing casing fix (PascalCase `state`/`pendingState` normalized, `Break→on_break`) + `useCancelPendingPause`/`useForcePendingPause` hooks + `agent.state_changed` SSE invalidates `['agent-me']` + i18n in 3 locales.
  - `ab755af` — contextual toast ("pause pending" vs "state updated").
  - Gates: `npm run build` clean, lint 0, i18n parity OK, vitest 1264.
- **Two-stage reviews passed.** The A5 individual review caught + fixed the flicker case (cancel-and-apply to a non-routable target must skip the `pending(null)` event) and confirmed the SaveAsync-before-publish ordering invariant. The B2 (status selector) review confirmed the casing-normalization fix and the contextual toast. The A1/A4/A6 routing-sensitive reviews and the final holistic cross-repo review passed.
- **Deferred (recorded, not built):** Offline deferred sign-off (same machinery); a dedicated `agent.pending_state_changed` browser push for an instant cross-tab pending indicator; an admin UI to edit `PendingPauseTimeoutMinutes` (ADR-0009 W4.x).
- **2026-06-06 — Final holistic cross-repo review caught + fixed 2 Critical integration bugs** (invisible to all green unit tests — the value of the holistic pass): **C1** `495bb3c` — `AgentPendingStateChangedEvent` was registered only in `PlatformPushJsonContext`, not `ApiJsonContext`, so the SSE endpoint (which serializes via `ApiJsonContext`) would throw on every pause set/cancel in the AOT image (reflection off); registered it + added it to the `SseEndpointsTests` all-types AOT-strict guard. **C2** `bd057e1` — the Web sent `{state:"on_break"}` for Break, which is NOT a case variant of the `Break` enum member → 400 on "On Break"; added `toWireState` (`on_break→Break`) in a new `agent-status-tokens.ts` module + a contract test.
- **2026-06-06 — ✅ SHIPPED.** Both PRs **MERGED** to `main`: Platform **#43** → `0fc1760` (merge); Web **#77** → `c8b6233` (squash, CI green 6 checks). Plan `git mv`d `active/`→`completed/`. Branches `w4-deferred-pause`/`-web` retired (local + remote). **Next:** W5 (work failover — re-queues the stuck work W4 marks on timeout), then W6 (capacity) — ADR-0009 north-star.
