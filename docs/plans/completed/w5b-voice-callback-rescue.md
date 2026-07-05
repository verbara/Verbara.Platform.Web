# Plan — W5b (voz): Rescate del llamante por callback prioritario (Agent Presence north-star, track 5b — slice voz)

## Context

**Por qué:** W5 (digital) rescata las conversaciones digitales huérfanas cuando el agente queda Offline. **Voz quedó sin equivalente.** Hoy, cuando la pata SIP del agente muere a mitad de llamada (navegador/red caídos, tab cerrada, pod muerto), Asterisk puentea con `app_queue` nativo (`Queue(${QUEUE_NAME})`, sin opciones — [extensions.conf:24-26](../../../../Verbara.Platform/docker/asterisk-config/extensions.conf)) y en un puente de 2 patas **cuelga también al llamante**. El `VoiceConversationBridge.OnCallEndedAsync` solo lo marca `WrapUp`/`Abandoned`, libera capacidad y manda al agente a ACW — **el cliente queda colgado y olvidado**, sin rescate. W5b lo recupera: detecta la caída anormal causada por el agente y **devuelve la llamada al cliente automáticamente** (callback prioritario), enrutándolo al **frente** de su cola original hacia el próximo agente vivo.

**Por qué callback y no "mantenerlo en línea" (análisis profundo, confirmado por el usuario):** el rescate en vivo (Redirect reactivo del canal del llamante) **pierde la carrera** contra el teardown del puente `app_queue` → el llamante casi siempre ya colgó. La única forma fiable de mantenerlo en línea exigiría cambio de dialplan (`Queue(...,c)` + re-entrada) con clasificación normal-vs-anormal y toca infra/realtime con timing frágil; la re-arquitectura ARI (puentes Stasis controlados por la Plataforma) es el norte real pero es multi-track. **Callback es la opción fiable que reusa ~70% de lo existente** y encaja en el ritmo Platform+Web de W1–W5.

## Confirmed decisions (usuario, tras análisis profundo)

1. **Semántica = callback prioritario** (no "mantener en línea", no re-arquitectura ARI ahora).
2. **Detección = en capas** (resultado del análisis profundo sobre la señal; "faltaba" el Nivel 2):
   - **Nivel 2 (núcleo, reuso sin plumbing AMI):** causa de cuelgue **por-pata** ya poblada en el `CallSession` que el bridge YA sostiene — `session.Participants[i]` lleva `Role` (Agent/Caller), `HangupCause` y `LeftAt` ([SessionParticipant.cs:5-18](../../../../Verbara.Sdk/src/Verbara.Sdk.Sessions/SessionParticipant.cs)). Mata el falso positivo de "colgó normal → se fue luego" (la causa es del instante exacto). `HangupCause.NormalClearing = 16` es "deliberado"; cualquier otra causa en la pata del agente que se fue **antes/junto** al llamante ⇒ muerte anormal del agente.
   - **Nivel 3 (corroboración, ya existe):** liveness W3 (`IAgentLivenessStore.IsAliveAsync` / `Agent.OfflineSince`) como segundo testigo independiente — cubre ambigüedad de códigos de causa de Asterisk.
   - **Disparo:** worker líder-gated con **ventana de gracia** evalúa "callback-digno = (causa anormal del agente) **OR** (agente confirmado no-vivo dentro de la gracia)". La gracia da cancel-on-return / anti-flap gratis.
   - **Nivel 1 (AMI crudo `HangupEvent`) NO en la ruta crítica** — `IAmiConnection.Subscribe` existe pero sin uso; queda documentado como acelerador futuro (causa+`TechCause` SIP al instante).
3. **Prioridad = saltar al FRENTE** de la cola origen (`queue_priority = -1`, como W5) + **tope de re-intentos = 3** (const, como W5): tras 3 callbacks fallidos → escalar (marcar `callbackStuck` + audit + visible en la vista supervisor de "trabajo atascado" de W5c, ahora con voz).
4. **Voz = NUEVA conversación de callback** (la original ya cerró; el callback es una llamada saliente nueva al cliente), enlazada por `rescuedFrom`. La original pasa a terminal con `callbackEnqueued`.

## Diseño núcleo

- **D1 — Estampar hechos en el call-end (bridge), decidir en el worker (política).** Extender `VoiceConversationBridge.OnCallEndedAsync` ([VoiceConversationBridge.cs:340-391](../../../../Verbara.Platform/src/Verbara.Platform.Api/Services/VoiceConversationBridge.cs)): cuando `wasActive` (la llamada estaba `Active` y cae a `WrapUp`), inspeccionar `session.Participants` → encontrar el participante `Role==Agent`, leer su `HangupCause` y `LeftAt` vs el `Caller`. Estampar en `Conversation.Metadata`: `pendingCallbackEval="true"`, `agentLegAbnormal` (bool: causa agente ∉ {NormalClearing} y agente se fue ≤ llamante), `callbackNumber` (del `Caller.CallerIdNum` o resuelto vía `Contact.Addresses` Voice), `callbackEvalSince={now:O}`, conservar `originQueueId` (ya estampado por `QueueDistributionWorker` en el offer). El estado sigue `WrapUp` — no se altera el flujo existente. **Helper** `AbnormalAgentHangup(session)` puro y testeable.
- **D2 — `CallbackRescueWorker` (nuevo, líder-gated, calca [WorkFailoverWorker.cs](../../../../Verbara.Platform/src/Verbara.Platform.Api/Services/WorkFailoverWorker.cs)).** Resource `callback-rescue:sweep` + stub `AlwaysLeader` single-node. Loop abajo. EventIds 9140–9144.
- **D3 — Origination del callback (reuso).** Calcar el patrón "originate-al-cliente → en respuesta `Queue(...)`" del dialer Pro ([DefaultOriginateBuilder.cs](../../../../Verbara.Sdk.Pro/src/Verbara.Sdk.Pro.Dialer/Execution/DefaultOriginateBuilder.cs)) + el gate de Originate de [AgentOutboundDialService.cs:91-202](../../../../Verbara.Platform/src/Verbara.Platform.Api/Services/AgentOutboundDialService.cs) (líder-gated + circuit-breaker ya incluidos). Nuevo `[outbound-callback]` en el dialplan que hace `Queue(${QUEUE_NAME})`. La llamada al cliente, al ser contestada, **entra a la cola origen** y `VoiceConversationBridge.OnCallQueued` la trackea como conversación nueva; una **variable de canal** (`VERBARA_CALLBACK_RESCUE={origConvId}`) hace que el bridge la marque `queue_priority=-1` + `rescuedFrom`. NO se fija al agente muerto: la sirve el próximo agente vivo de la cola.
- **D4 — Anti-loop + idempotencia.** `Metadata["callbackAttempts"]` incrementado y guardado **antes** de originar (ordering invariant W5). Tras 3 → `callbackStuck` + audit `conversation.callback.escalated`. Un solo callback por caída: al lanzar, limpiar `pendingCallbackEval` y marcar `callbackEnqueued`; la original → terminal (`Resolved`/`Closed` según el state machine).
- **D5 — Config por-tenant.** `TenantAuthConfig.VoiceCallbackGraceSeconds` (default 25; `<=0` deshabilita el rescate de voz para el tenant). `MaxCallbackAttempts = 3` const en MVP. Migración **032**.
- **Refinamientos decididos:** sin evento cross-pod nuevo (reusar `ConversationStateChangedEvent` + audit; **si se agregara alguno, va en `ApiJsonContext` Y `PlatformPushJsonContext` + guard SSE — lección W4**). Brecha conocida: el ConfigMap K8s omite hoy `[stasis-queue]` ([asterisk-configmap.yaml:45-69](../../../../Verbara.Platform/infra/k8s/helm/asterisk/templates/asterisk-configmap.yaml)) — agregar AMBOS contextos (`[stasis-queue]` + `[outbound-callback]`) al Docker `extensions.conf` y al Helm values, y dejar nota de que la completitud del deploy de voz en K8s es su propio asunto (env load-test usa config simplificada).

### CallbackRescueWorker loop (SweepOnceAsync)

```
if (!_leader.IsLeader) return;                                  // líder-gated; followers no-op
now; graceCache(tenant->seconds).
await foreach (conv in _conv.ListPendingCallbackEvalAsync(ct)):  // WrapUp + Metadata["pendingCallbackEval"]=="true", tenants activos
  grace = cache[tenant] ??= cfg.VoiceCallbackGraceSeconds ?? 25; if (grace<=0) { clearPending(conv); continue; }   // tenant deshabilitado
  evalSince = parse(Metadata["callbackEvalSince"]); if (now - evalSince < grace) continue;     // gracia + ventana cancel-on-return
  // re-load + re-check (idempotente): aún WrapUp, aún pendingCallbackEval, no callbackStuck
  attempts = Metadata["callbackAttempts"] ?? 0;
  if (attempts >= 3 || has callbackStuck): markStuck + audit escalated("max_attempts"); clearPending; continue;
  abnormal = Metadata["agentLegAbnormal"]=="true";
  agentDead = original owner agente AND (!liveness.IsAliveAsync(tenant, agentId) OR agent.State==Offline);
  worthy = abnormal || agentDead;
  if (!worthy): clearPending(conv); continue;       // fin normal + agente vivo → NO callback (suprime falso positivo / cancel-on-return)
  number = Metadata["callbackNumber"]; originQueueId = Metadata["originQueueId"];
  if (number is null || originQueueId is null): markStuck + audit escalated("no_number_or_queue"); clearPending; continue;
  // incrementar + guardar ANTES de originar (ordering invariant)
  Metadata["callbackAttempts"]=attempts+1; Metadata["callbackEvalSince"]=now; save;
  ok = await _callbackOriginator.OriginateCallbackAsync(tenant, number, originQueueId, rescuedFrom: conv.Id, ct);
  if (ok): clearPending + Metadata["callbackEnqueued"]="true"; transition original → terminal; audit requeued("callback.enqueued");
  else: leave pendingCallbackEval (reintenta próx. sweep; attempts ya contado); audit failed;
        if (attempts+1 >= 3): markStuck + audit escalated("originate_failed");
```

## Phase A — Backend (`Verbara.Platform` + dialplan, rama `w5b-voice-callback-rescue`)

> FCM: A2∥A3 batch. 🔒 individual: A1, A4, A5, A6, A7. AOT/source-gen, TreatWarningsAsErrors, test naming `Method_ShouldExpected_WhenCondition`. Migración **032** (`tenant_auth_config.voice_callback_grace_seconds`). EventIds 9140s.

- **A1 🔒** — Detección de causa por-pata: helper `AbnormalAgentHangup(CallSession)` (lee `Participants` Role/HangupCause/LeftAt; `NormalClearing`=no) + extender `VoiceConversationBridge.OnCallEndedAsync` para estampar `pendingCallbackEval`/`agentLegAbnormal`/`callbackNumber`/`callbackEvalSince` cuando `wasActive`. Tests: abnormal-agent-leg→flagged, normal-clearing→not-flagged, caller-hung-up-first→not-flagged, number-from-callerid, number-fallback-from-contact.
- **A2** — `TenantAuthConfig.VoiceCallbackGraceSeconds=25` end-to-end (record + `PostgresTenantAuthConfigStore` threading; columna en migración 032). Tests: default-25, round-trip.
- **A3** — `IConversationStore.ListPendingCallbackEvalAsync(ct)` (conv en `WrapUp` con `Metadata["pendingCallbackEval"]="true"`, por tenant activo) Postgres+InMemory. Tests: yields-only-pending-wrapup, across-tenants, excludes-stuck.
- **A4 🔒** — Origination: `ICallbackOriginator`/`CallbackOriginator.OriginateCallbackAsync(tenant, number, originQueueId, rescuedFrom, ct)` reusando el gate Originate (líder-gated + circuit-breaker) → `[outbound-callback]` context + var `VERBARA_CALLBACK_RESCUE`. Tests: builds-originate-to-customer, routes-to-origin-queue, stamps-rescue-var, returns-false-on-originate-fail.
- **A5 🔒** — Marcado de la conversación de callback en `VoiceConversationBridge.OnCallQueued`: si la sesión trae `VERBARA_CALLBACK_RESCUE`, crear la conv nueva con `queue_priority=-1` + `rescuedFrom` + `callbackAttempts` heredado. Tests: rescue-var→front-priority+rescuedFrom, normal-inbound→unchanged.
- **A6 🔒** — `CallbackRescueLeaderResources.Sweep="callback-rescue:sweep"` + `CallbackRescueWorker` (loop arriba) + `Program.cs` (lease en el MISMO bloque cluster que W3/W4/W5 + stub `AlwaysLeader` en el MISMO else + `AddHostedService`); audit `conversation.callback.enqueued`/`.escalated`. EventIds 9140–9144. Tests: no-op-not-leader, no-callback-bajo-gracia, callback-tras-gracia-al-frente, no-callback-si-fin-normal-y-agente-vivo (cancel-on-return), callback-si-abnormal, callback-si-agente-offline, escalate-tras-3, skip-sin-number/queue→escalate, idempotente, grace<=0-deshabilita.
- **A7 🔒** — Extender la query supervisor de "stuck" (W5c, `SupervisorEndpoints.cs`) para incluir voz `callbackStuck` (conv `WrapUp` con `Metadata["callbackStuck"]`), con un campo `channel` en el DTO para que el Web distinga voz/digital. Tests: voice-callback-stuck-listed, channel-field-set, digital+voice-mixed.
- **A8 dialplan** — `[outbound-callback]` en [docker/asterisk-config/extensions.conf](../../../../Verbara.Platform/docker/asterisk-config/extensions.conf) (originate→cliente→`Queue(${QUEUE_NAME})`) + mismo contexto **y** `[stasis-queue]` faltante en [asterisk-configmap.yaml](../../../../Verbara.Platform/infra/k8s/helm/asterisk/templates/asterisk-configmap.yaml). No-código; revisar en holística.
- **A9 gate** — `dotnet build -warnaserror` + `dotnet test` verdes.

## Phase B — Client (`Verbara.Platform.Web`, rama `w5b-voice-callback-rescue-web`)

> Gate: `npm run build` + `npm run lint`(+i18n:check) + `npm run test`. Cambio Web mínimo (la tab stuck-work ya existe de W5c).

- **B1** — `use-supervisor.ts`: el tipo `StuckConversation` gana `channel` ('voice'|'digital'…); el hook `useStuckConversations()` ya trae la lista (ahora incluye voz). Tests: parse channel.
- **B2** — `stuck-work-tab.tsx`: mostrar ítems de voz con indicador de canal + etiqueta "Callback falló N×" para `callbackStuck`; para voz la acción "Reasignar a cola/agente" se reemplaza por "Reintentar callback" / "Cerrar" (el cliente ya no está en línea). i18n 3 locales (`operations.json`: `stuck_work.channel_voice`, `stuck_work.callback_failed`, `stuck_work.retry_callback`).
- **B3** — tests: voice-item-renders-channel, callback-failed-label, retry-callback-calls-hook.

## Docs (Web repo, como W3/W4/W5)

- ADR-0009: sección **W5b** (VOZ shipped: callback prioritario; detección por-pata-causa + liveness en gracia; re-arquitectura ARI y AMI-crudo explícitamente diferidos; cierra la dependencia "stuck work" en voz). Marcar W5b como el slice de voz que W5 difirió.
- Spec `docs/specs/2026-06-06-w5b-voice-callback-rescue.md` (modelo: detección por-pata, ventana de gracia + liveness, originate→cola, anti-loop, dialplan `[outbound-callback]`, worker loop, supervisor voz).
- Mirror del plan a `docs/plans/active/w5b-voice-callback-rescue.md` (→ `completed/` al mergear).

## Phase C — Secuencia y review

**Cierre W5 primero (al salir de plan mode):** sync `main` en ambos repos, `git mv` plan W5 `active/`→`completed/`, retirar ramas W5 (`w5-work-failover`/`-web`), actualizar memorias/roadmaps/CLAUDE.md a SHIPPED (PRs #44 Platform / #78 Web, mergeados). Luego ramar W5b desde `main`.

Orden: A1 🔒 → (A2∥A3) → A4 🔒 → A5 🔒 → A6 🔒 → A7 🔒 → A8 dialplan → A9 gate → B1 → B2 → B3 → gate B → docs → **holística cross-repo final** (mismo rigor que atrapó 2 Critical en W4) → finishing (Push + PR ambos repos, confirmando antes). Subagent-Driven + review de dos etapas por tarea + 🔒 individual en las riesgosas.

## Critical files

Backend: `Api/Services/VoiceConversationBridge.cs` (estampar hechos call-end + marcar callback en OnQueued) · `Api/Services/CallbackRescueWorker.cs`+`CallbackRescueLeaderResources.cs` (nuevos, calcan WorkFailoverWorker) · `Api/Services/CallbackOriginator.cs` (nuevo, reusa Originate gate de `AgentOutboundDialService.cs`) · `Conversations/IConversationStore.cs` (+`ListPendingCallbackEvalAsync`) + `Conversations/Conversation.cs` (Metadata, ya tiene Set/RemoveMetadata, queue*priority) · `Conversations/Contact.cs` (Addresses→número Voice) · `Identity/TenantAuthConfig.cs` (+`VoiceCallbackGraceSeconds`) + `Storage.Postgres/Stores/{PostgresConversationStore,PostgresTenantAuthConfigStore}.cs` + `Storage.InMemory/*`+`Migrations/032\*\*.sql`·`Api/Endpoints/SupervisorEndpoints.cs` (+`channel`en stuck DTO, incluir voz callbackStuck) +`Serialization/ApiJsonContext.cs`·`Api/Program.cs`(lease+stub+AddHostedService) ·`docker/asterisk-config/extensions.conf`+`infra/k8s/helm/asterisk/templates/asterisk-configmap.yaml` (`[outbound-callback]`+`[stasis-queue]`).
SDK (solo lectura/consumo): `Verbara.Sdk.Sessions/{CallSession,SessionParticipant}.cs`(causa por-pata) ·`Verbara.Sdk/Enums/HangupCause.cs`(NormalClearing=16) ·`Verbara.Sdk.Pro.Dialer/Execution/DefaultOriginateBuilder.cs`(patrón originate→Queue).
Cliente:`src/core/api/hooks/use-supervisor.ts`(+channel) ·`src/operations/monitor/stuck-work-tab.tsx`(voz) ·`public/locales/{en-US,es-419,pt-BR}/operations.json`.

## Verification

- Backend: `dotnet build -warnaserror` + `dotnet test` (AbnormalAgentHangup clasificación, estampado call-end, ListPendingCallbackEval, CallbackOriginator, marcado OnQueued, worker: gracia/cancel-on-return/callback-front/no-callback-fin-normal/escalate-3/skip-sin-number/grace<=0, supervisor voz stuck).
- Cliente: build + lint(+i18n) + test (stuck voz, callback-failed, retry hook).
- E2E manual: agente en llamada de voz → mata el navegador → tras la gracia (~25s) el cliente recibe un **callback** que entra al frente de su cola origen y lo atiende otro agente; el agente "vuelve" / la llamada terminó normal → **NO** hay callback; 3 callbacks fallidos → escala + visible en la vista supervisor con indicador de voz.

## Open questions (resueltas; reconfirmar en review si aplica)

1. AMI crudo `HangupEvent` → **diferido** (acelerador futuro; Nivel 2 por-pata basta para MVP). 2. Mantener-en-línea (`Queue(...,c)`) → **descartado** (carrera de puente). 3. Re-arquitectura ARI → **norte, fuera de alcance**. 4. MaxAttempts → **const 3**. 5. Original tras callback → **terminal** (Resolved/Closed por state machine). 6. ConfigMap K8s `[stasis-queue]` faltante → **agregar ambos contextos** (nota: completitud K8s de voz es su propio asunto).

## Conventions

Subagent-Driven Development con FCM batching. Conventional Commits, sin `Co-Authored-By`/referencias a IA. AOT/no-reflection, source-gen JSON (cualquier evento/DTO nuevo en `ApiJsonContext` **y** `PlatformPushJsonContext` + guard SSE si cruza pods — lección W4). Cross-repo (backend + Web) — entrega coordinada como W1–W5. `finishing-a-development-branch` al cierre (Push + PR en ambos repos, confirmando antes).
