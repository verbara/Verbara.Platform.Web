# Plan — W3: Liveness server-side / anti-zombi (Agent Presence north-star, track 3)

> Mirrored from the approved ExitPlanMode plan (2026-06-06). ADR: [0009](../../decisions/0009-agent-presence-session-work-continuity.md) (W3 section) · Spec: [W3 design](../../specs/2026-06-06-w3-agent-liveness.md). Execute via **Subagent-Driven Development** with FCM batching. Auth/routing-sensitive tasks flagged 🔒 get individual focused review. (Cross-repo: backend in `Verbara.Platform`, client here — coordinated delivery like W1+W2.)

## Context

**Por qué:** Cuando el navegador de un agente desaparece de golpe (corte de luz/internet, pestaña cerrada sin avisar), el servidor **sigue creyéndolo routable** y la ACD le manda llamadas/chats/correos que nadie contesta (el "zombi de enrutamiento"). El usuario lo reportó explícitamente ("el backend tiene como detectar si el agente se desconectó sin avisar"). W3 es darle al servidor una señal de liveness **confiable** que lo saque de enrutamiento (Offline) para que deje de recibir **trabajo nuevo**. (El rescate del trabajo **en curso** es W5 — fuera de alcance.)

**Análisis profundo (3 rondas de exploración + verificación de factibilidad) corrigió el norte original de ADR-0009.** ADR-0009 asumía puentear el delta `PresenceTracker.AgentOffline` (SignalR) → routing. La realidad verificada en código:

- **Topología split (ADR-0022 Phase A):** SSE vive en **Platform.Api** (canal universal, siempre abierto); SignalR + `PresenceTracker` viven en **Platform.Realtime** (otro proceso) y están **detrás de un feature-flag** (`realtimePushSignalR`).
- El delta SignalR **solo cubre el subconjunto con SignalR activo**, cruza proceso, y acopla la presencia-**display** (que por diseño está separada de routing) con routing.
- SSE **no tiene registro de conexiones por-agente**; `RequestAborted` es **poco confiable** ante corte abrupto (TCP cuelga; nginx sin `proxy_buffering off` puede sostener el upstream). → **sin una prueba-de-vida del cliente, "se desconectó sin avisar" no se detecta a tiempo.**

**Decisión del usuario (tras el análisis profundo): Opción 1 "en capas".** Una autoridad universal agnóstica al transporte + aceleradores baratos, en Platform.Api (donde vive el routing). El fast-path SignalR y el backstop SIP/Asterisk se **documentan en ADR como diferidos**, no se construyen.

## Confirmed decisions

1. **Autoridad — heartbeat + TTL + reaper:** el cliente hace `POST /api/v1/agents/me/heartbeat` cada **~20 s** (fijo, independiente de la actividad) → la Api escribe `presence:agent:{tenant}:{agentId}` en Redis con TTL = `AgentLivenessTimeoutSeconds`. Un `BackgroundService` **líder-gated** barre cada ~15 s: agente **routable en Postgres** ({Available,Busy}) cuya clave Redis **falta** → `ForceOffline` → publica `AgentStateChangedEvent` → `RealtimeStateBridge` lo pausa en Asterisk.
2. **Umbral:** `AgentLivenessTimeoutSeconds` default **60**, configurable por-tenant en `TenantAuthConfig` (mismo patrón que `SessionIdleTimeoutMinutes`/`ImpersonationAutoTimeoutMinutes`). `<=0` deshabilita el reaping para ese tenant.
3. **Invariante de desacople:** intervalo de heartbeat cliente (**20 s, fijo**) ≪ TTL servidor (**60 s, por-tenant**), margen ≥2× → 1–2 heartbeats perdidos no causan falso reap. El TTL **no** se expone en `TokenResponse` (server-only).
4. **El heartbeat es independiente de la actividad** — un agente esperando llamadas está quieto pero **vivo y routable**; NO se reusa el tracking de actividad de W2.
5. **Acelerador — beacon graceful:** en `pagehide` el cliente llama `POST /api/v1/agents/me/offline` vía `fetch(keepalive:true)` con header `Authorization` (NO `sendBeacon` — el token es Bearer en memoria, no cookie) → Offline **instantáneo** al cerrar pestaña. `visibilitychange:hidden` **NO** dispara salida (cambiar de pestaña ≠ irse).
6. **Manual — endpoint admin force-offline** (RBAC doble): el supervisor saca a un zombi/atascado, con opción de revocar la sesión (family-revoke de W1).
7. **Reaping = "Postgres dice routable Y Redis dice muerto".** Postgres es la verdad de "quién debería estar routable"; Redis la prueba-de-vida.
8. **Diferidos (solo ADR):** fast-path SignalR (`PresenceTracker.AgentOffline` cross-proceso) y backstop Asterisk `ContactStatus`/registro PJSIP (solo-voz).

---

## Phase A — Backend (`Verbara.Platform`, rama `w3-agent-liveness`)

> FCM: A1+A2+A5a batch (fundacionales independientes). A4, A5, A6 review individual 🔒. AOT: cada DTO nuevo = `sealed record` en `ApiJsonContext`; valor Redis con su propio source-gen context. TreatWarningsAsErrors on. Tests `Method_ShouldExpected_WhenCondition`.

- **A1 — `IAgentLivenessStore` (presence-key Redis).** Crear `Queues/Services/IAgentLivenessStore.cs` (`TouchAsync(tenant,agent,ttl,nodeId,ct)`, `IsAliveAsync`, `RemoveAsync`), impl Redis (`Identity.Redis/RedisAgentLivenessStore.cs`: `db.StringSetAsync(key,json,ttl)`, `KeyExistsAsync`, `KeyDeleteAsync`) e InMemory (`Storage.InMemory`, con `TimeProvider` para tests). Key `presence:agent:{tenant}:{agentId}`; valor JSON diagnóstico `{nodeId,touchedAt}` vía `AgentLivenessJsonContext` source-gen. Presencia = existencia de la clave (el reaper usa `KeyExists` exacto, no scan → prefix-agnóstico). DI: Redis dentro del bloque `identityRedis` de `Program.cs:717-730`, InMemory fallback single-node. **Tests:** alive-within-ttl / not-after-ttl / never-touched / remove / refresh-expiry.
- **A2 — `TenantAuthConfig.AgentLivenessTimeoutSeconds = 60` end-to-end.** Record + XML doc; `PostgresTenantAuthConfigStore` (SELECT ~73-79, INSERT/VALUES/ON CONFLICT 85-110, bind 111-135, row prop ~158, `Map` ~187, `ToTenantAuthConfig` ~217); `InMemoryTenantAuthConfigStore`; `CachedTenantAuthConfigStore` auto-sigue (verificar). **Migración** `Storage.Postgres/Migrations/029_AgentLivenessTimeout.sql` → `ALTER TABLE tenant_auth_config ADD COLUMN IF NOT EXISTS agent_liveness_timeout_seconds integer NOT NULL DEFAULT 60;` (el `.csproj:30` ya globea `Migrations\*.sql`). **Tests:** default-60-when-unset / round-trip-custom.
- **A5a — `IAgentStore.StreamRoutableAgentsAsync(ct)` (cross-tenant, unpaged).** `IAgentStore.cs` no tiene listado de routables (confirmado: solo `GetById/GetByUserId/GetByExtension/List(paged,single-state)/Save/Delete`). Agregar `IAsyncEnumerable<Agent> StreamRoutableAgentsAsync(CancellationToken ct)`; Postgres `SELECT ... WHERE state IN (1,2)` con reader streaming (reusa `AgentRow.Map`/`ToAgent`); InMemory `Where(IsRoutable).yield`. **Tests:** yields-only-available-busy / across-tenants / empty-when-none.
- **A3 — `POST /api/v1/agents/me/heartbeat`.** En `AgentEndpoints.cs` (grupo `/agents`, `RequireAuthorization("Authenticated").RequireOperationalTenant()`). Resuelve tenant + user (cascada `sub→user_id→NameIdentifier`, `GetByUserIdAsync`); lee `AgentLivenessTimeoutSeconds` (default 60; `<=0` → `NoContent` sin escribir); `livenessStore.TouchAsync(...)`; **no cambia estado**. Responde `NoContent` (sin DTO). **Tests:** no-content / makes-alive / not-found-no-agent / no-state-change-when-busy / no-key-when-timeout-zero.
- **A4 🔒 — `POST /api/v1/agents/me/offline`.** Mismo grupo. Resuelve agente; `oldState=agent.State`; `agent.ForceOffline()` (bypass `EnsureTransition`); `SaveAsync`; `livenessStore.RemoveAsync`; publica `AgentStateChangedEvent(...,oldState,"Offline")` **solo si** `oldState != Offline` (idempotente, evita spam de QueuePause); `NoContent`. **Tests:** sets-offline-when-routable / publishes-event-when-from-routable / no-event-when-already-offline / removes-key / no-content-idempotent / not-found.
- **A5 🔒 INDIVIDUAL — `AgentLivenessReaper : BackgroundService`.** `Api/Services/AgentLivenessReaper.cs`, calca `ImpersonationSessionTimeoutService` (`SweepOnceAsync` público, `PeriodicTimer(_sweepInterval=15s,_clock)`, OCE-shutdown swallow, fatal rethrow, `[LoggerMessage]` EventIds nuevos tras 9101). Deps: `IAgentStore, IAgentLivenessStore, ITenantAuthConfigStore, PlatformEventBus, IAuditService, [FromKeyedServices("agent-liveness:sweep")] IClusterLeader, ILogger, TimeProvider?, TimeSpan?`. Loop: `if(!_leader.IsLeader) return;` cachea ttl por-tenant por-sweep; `await foreach(StreamRoutableAgentsAsync)`: `ttl<=0`→skip; `IsAliveAsync`→skip; **re-load `GetByIdAsync` + re-check `IsRoutable`** (anti-stale/idempotente); `oldState`; `ForceOffline`; `SaveAsync`; publica evento `"Offline"`; audit `action:"agent.liveness.force_offline" severity:"warning" actorType:"system"`. Registrar `AddHostedService` (junto a `:663`) + `AgentLivenessLeaderResources.Sweep="agent-liveness:sweep"`. **Tests:** force-offline-when-no-key / publishes-offline / no-reap-when-alive / no-reap-when-non-routable / nothing-when-not-leader / skip-when-timeout-zero / emits-audit / idempotent-twice / per-tenant-timeout.
- **A6 🔒 INDIVIDUAL — `POST /api/v1/admin/agents/{agentId}/force-offline`.** Nuevo `Endpoints/ManagementAgentEndpoints.cs`, grupo `/admin/agents` `RequireAuthorization("AdminOnly").RequireOperationalTenant()`, tenant-scoped (sin cross-tenant). `GetByIdAsync`; `ForceOffline`+`SaveAsync`+`RemoveAsync`; publica evento si `oldState!=Offline`; **opcional** `RevokeAllForUserAsync` si `body.RevokeSessions`; audit `action:"agent.force_offline"`. DTO `ForceOfflineRequest(bool RevokeSessions)` en `ApiJsonContext`. `app.MapManagementAgentEndpoints()` en `Program.cs`. **Tests:** sets-offline-when-admin / publishes-event / removes-key / not-found-cross-tenant / revokes-tokens-when-true / no-revoke-when-false / emits-audit / idempotent.
- **A7 — Gate:** `dotnet build -warnaserror` + `dotnet test` (Queues / Api / Storage.InMemory / Storage.Postgres) verdes; AOT analyzer feliz con el source-gen context Redis.

## Phase B — Client (`Verbara.Platform.Web`, rama `w3-agent-liveness-web`)

> Gate: `npm run build` (tsc -b) + `npm run lint` (eslint + i18n:check) + `npm run test`. Nuevo módulo `src/core/presence/` (separado de `core/session`).

- **B1 — `use-agent-heartbeat.ts`.** `HEARTBEAT_INTERVAL_MS=20_000` (fijo, activity-independent). Hook: 1 beat inmediato al montar + cada 20 s mientras autenticado, `customFetch POST /agents/me/heartbeat`; **sigue latiendo con la pestaña oculta** (la salida real la maneja B2); errores silenciados; `clearInterval` al desmontar. **Tests:** posts-immediately / every-20s / stops-on-unmount / keeps-when-hidden / swallows-error.
- **B2 🔒 INDIVIDUAL — `agent-departure.ts`.** `sendOfflineBeacon()`: lee `accessToken` (`useAuthStore`); guard routable reusando la normalización de `agent-teardown.ts` (`(agent.state??'').toLowerCase()`, `ROUTABLE_STATES={available,busy}`); `fetch('/api/v1/agents/me/offline',{method:'POST',keepalive:true,headers:{Authorization:Bearer, 'X-Tenant-Id'}})` best-effort (**NO** `customFetch`, **NO** `sendBeacon`). `useAgentDeparture()`: registra `pagehide`→beacon; `visibilitychange:hidden`→**no** salida (evita falso-zombi al cambiar de pestaña). **Tests:** fetch-with-auth-header / uses-keepalive / skip-non-routable / skip-no-token / pagehide-sends / visibility-hidden-no-send / removes-listeners.
- **B3 — Montaje.** `pages/agent/agent-layout.tsx`: `useAgentHeartbeat()` + `useAgentDeparture()` junto a `useSoftphone()` (scoped a `/agent`); sin timers duplicados. **Test:** starts-heartbeat-when-mounted.
- **B4 — UI admin force-offline: DIFERIDA fuera de W3.** El endpoint (A6) sí entra en W3 (testeable solo); el botón UI + 3 i18n keys se difieren (mantener W3 enfocado y no abrir la superficie de paridad i18n por una conveniencia no crítica). Documentar como follow-up.
- **B5 — Gate:** build + lint(+i18n, sin keys nuevas) + test verdes.

## Cross-cutting (OPCIONAL, higiene SSE — NO requerido por W3)

W3 no depende del cierre de socket, así que es solo higiene: `X-Accel-Buffering: no` en la respuesta SSE + `proxy_buffering off;` en el `location /api/` de nginx. Marcar opcional; confirmar ruta del nginx.conf.

## Phase C — Secuencia y review

Backend: **A1+A2+A5a (batch)** → A7 build/test → **A3 + A4 🔒** → **A5 🔒** → **A6 🔒** → A7 gate. Cliente: **B1 + B2 🔒** → B3 → B5 gate. Review individual 🔒: **A4 (offline endpoint), A5 (reaper), A6 (admin endpoint), B2 (beacon)**.

## ADR / Docs (post-approval)

- **ADR-0009** (`docs/decisions/0009-...md`): marcar **W3 designed**; registrar la decisión **Opción 1 en capas** (heartbeat+TTL+reaper líder-gated + beacon graceful + admin manual); **opciones rechazadas** N1 (TCP keepalive), N2 (registro SSE+RequestAborted), A2 (piggyback tráfico); **diferidos** fast-path SignalR cross-proceso y backstop Asterisk ContactStatus/PJSIP — con la razón (la reconciliación Postgres-vs-Redis es la vía autoritativa; los diferidos son optimización de latencia / backstop solo-voz).
- **Spec W3** `docs/specs/2026-06-06-w3-agent-liveness.md`: invariante 20s≪60s, las 3 columnas, key shape, regla del reaper, argumento de idempotencia, el guard de visibilitychange-NO-usado, diferral de UI.
- **Mirror** de este plan a `docs/plans/active/w3-agent-liveness.md`.

## Critical files

Backend: `Api/Endpoints/AgentEndpoints.cs` · `Api/Endpoints/ManagementAgentEndpoints.cs` (nuevo) · `Api/Services/AgentLivenessReaper.cs` (nuevo, calca `ImpersonationSessionTimeoutService.cs`) · `Queues/Services/IAgentLivenessStore.cs` (nuevo) · `Queues/IAgentStore.cs` (+`StreamRoutableAgentsAsync`) · `Identity/TenantAuthConfig.cs` + `Storage.Postgres/Stores/PostgresTenantAuthConfigStore.cs` + `Migrations/029_*.sql` · `Api/Program.cs` (DI: store, reaper, leader lease, map endpoint).
Cliente: `src/core/presence/{use-agent-heartbeat.ts, agent-departure.ts}` (nuevos) · `src/pages/agent/agent-layout.tsx` · reuso de `src/core/session/agent-teardown.ts` (normalización).

## Verification

- **Backend:** `dotnet build -warnaserror` + `dotnet test` (presence-store, config round-trip + migración, heartbeat/offline endpoints, reaper con `FakeTimeProvider`+fake leader+bus capture, admin endpoint RBAC+revoke+audit).
- **Cliente:** build + lint(+i18n) + test (heartbeat fake-timers, beacon keepalive+auth+guard, pagehide vs visibilitychange).
- **E2E manual:** (1) abrir `/agent` → `POST /heartbeat` 204 inmediato y cada ~20 s; clave Redis con TTL ~60. (2) **matar red** → ≤60 s el reaper (líder) lo deja Offline en Postgres + `QueuePause Paused=true` a Asterisk + audit `agent.liveness.force_offline`. (3) **cerrar pestaña** → `pagehide` → Offline **inmediato** (sin esperar 60 s). (4) **cambiar de pestaña** (no cerrar) → sigue routable, heartbeat continúa (valida el guard). (5) **admin force-offline** con permiso → Offline+QueuePause+tokens revocados; sin permiso → 403. (6) **multi-réplica:** solo el líder barre; failover → un follower retoma el lease.

## Open questions (resolver en implementación/review)

1. **🔴 Registro del leader-lease vs gating de voz (A5):** el `RegisterLeader` existente está gated por flags de voz; el lease de liveness debe correr también en deploys sin voz. Confirmar si múltiples `AddVerbaraCluster(...RegisterLeader)` componen aditivamente o si hay que consolidar; decidir fallback single-node (stub always-leader vs gatear el registro del reaper). **El mayor riesgo.**
2. Default Redis-vs-InMemory del liveness store (A1) y si la exigencia de Redis en multi-réplica aplica.
3. Token exacto de permiso admin (A6) que usa la UI de agents.
4. Helper de streaming en `Verbara.Sdk.Data.Npgsql` (A5a) o `await using` reader a mano.
5. Ruta del nginx.conf (higiene SSE, opcional).

## Conventions

Subagent-Driven Development con FCM batching. Conventional Commits, sin `Co-Authored-By`/referencias a Claude. AOT/no-reflection, source-gen JSON. Cross-repo (backend + Web) — coordinar entrega como W1+W2. `finishing-a-development-branch` al cierre (Push + PR en ambos repos, confirmando antes).

## Status log

- **2026-06-06 — Plan approved.** Branches `w3-agent-liveness` (Platform) and `w3-agent-liveness-web` (Web) created from `main`; ADR-0009 W3 section updated, W3 spec written, and this plan mirrored to `docs/plans/active/`.
- **2026-06-06 — Phase A (backend) shipped** via 5 commits on `w3-agent-liveness`:
  - `6143610` — foundations (A1+A2+A5a): `IAgentLivenessStore` (Redis + InMemory) with the `AgentLivenessJsonContext` source-gen context, per-tenant `TenantAuthConfig.AgentLivenessTimeoutSeconds` (default 60) end-to-end + migration `029_AgentLivenessTimeout.sql`, and `IAgentStore.StreamRoutableAgentsAsync`.
  - `a120333` — heartbeat + offline endpoints (A3 + A4 🔒): `POST /agents/me/heartbeat` (204, activity-independent, no state change) and `POST /agents/me/offline` (ForceOffline + remove key + idempotent event publish).
  - `7cfa7b3` — reaper + leader gating + stub (A5 🔒): `AgentLivenessReaper : BackgroundService` modeled on `ImpersonationSessionTimeoutService`, leader-gated on `agent-liveness:sweep`, with the single-node `AlwaysLeader` stub.
  - `b270060` — admin force-offline (A6 🔒): `POST /admin/agents/{id}/force-offline` (AdminOnly + RequireOperationalTenant, tenant-scoped, optional token-family revoke + audit).
  - `cb72e575` — cross-tenant + already-offline hardening tests.
  - Gates: `dotnet build -warnaserror` 0 warnings; Queues.Tests 52, Storage.InMemory.Tests 142, Api.Tests 1211.
- **2026-06-06 — Phase B (client) shipped** via `2453144` on `w3-agent-liveness-web`: `use-agent-heartbeat.ts` + `agent-departure.ts` (new `src/core/presence/*`), mounted in `pages/agent/agent-layout.tsx`. Gates: `npm run build` clean, lint 0, i18n parity OK, vitest 1258 (14 new presence tests).
- **Two-stage reviews passed.** The A5 reaper individual review confirmed the latent migration-gate fix (the `cluster_distributed_lock` gate broadened from `clusterConn && Ari:BaseUrl` → `clusterConn` alone, so the leader-lease lock table migrates on AMI-only deployments). The A6 (admin endpoint) and B2 (departure beacon) security reviews passed — tenant-scoping, RBAC, and the in-memory-Bearer `fetch(keepalive)` (not `sendBeacon`) choice all confirmed.
- **Deferred (recorded, not built):** B4 admin force-offline UI button + i18n; the optional SSE/nginx buffering hygiene; the SignalR cross-process fast-path and the Asterisk `ContactStatus`/PJSIP backstop (ADR-0009 W3.x).
- **2026-06-06 — ✅ SHIPPED.** Both PRs merged to `main` and final holistic cross-repo review passed: Platform **#42** → merge commit `1b5491e9`; Web **#76** → squash `6147654`. Web CI green (6 checks: audit/build/coverage/i18n/lint/test). Feature branches retired (local + remote). Plan `git mv`d from `active/` → `completed/`. **Next:** W4 (deferred "pause-when-free"), then W5 (work failover), W6 (capacity) — ADR-0009 north-star.
