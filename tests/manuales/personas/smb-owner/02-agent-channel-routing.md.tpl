---
persona: smb-owner
journey: 02-agent-channel-routing
title: "Día 2 — Restringir un agente a un canal específico"
version: v2.5.5
locale: es-419
status: draft
authored: 2026-05-28
audience: "Operador SMB que ya completó el Día 1 y quiere que el primer agente atienda sólo WebChat (no llamadas de voz todavía)."
estimated_time: "5–8 minutos"
prerequisites:
  - "El manual [01-day1-setup-and-webchat.md](01-day1-setup-and-webchat.md) está completado: existe el platform admin, la queue Atención General, el agente María González y el canal WebChat habilitado."
  - "Acceso al frontend web (`http://{server-ip}/`) con las credenciales del Día 1."
---

# Día 2 — Restringir un agente a un canal específico

> Este manual cubre el **editor de membership channel-aware** introducido en
> v2.5.5 con [ADR-0026 Phase A.6](../../../../decisions/0026-queue-membership-executive-routing.md).
> Al terminar vas a haber restringido a María González al canal WebChat
> únicamente: las conversaciones de WebChat seguirán llegándole, pero el PBX
> Asterisk no la va a ofrecer para llamadas de voz hasta que vos vuelvas a
> habilitarla.

## ¿Por qué importa?

En el wizard del Día 1 la membership se creó con `allowed_channels=NULL`,
que significa "**todos** los canales que acepta la queue". Asterisk recibe la
entrada en `queue_members` y la marca como elegible para enrutar llamadas. Si
todavía no instalaste un trunk SIP de voz (cubierto en
[03-day3-voice-sip.md](03-day3-voice-sip.md)), no pasa nada visible — pero el
día que conectes voz, María empezaría a ricibir llamadas sin querer.

Channel-aware membership resuelve esto: vos elegís exactamente qué canales
atiende cada agente, y Verbara sincroniza Asterisk solamente cuando **Voice**
está incluido. Restringir a WebChat = membership digital-only, sin sync a
Asterisk.

```
   Antes (Día 1)            Después (este manual)
   ─────────────            ─────────────────────
   AllowedChannels=NULL     AllowedChannels=['WebChat']
   Voice → Asterisk ✅       Voice → Asterisk ❌
   WebChat ✅               WebChat ✅
   Email, WhatsApp, …  ✅    Email, WhatsApp, …  ❌
```

## Paso 1 — Iniciar sesión con el admin del Día 1

Abrí `http://{server-ip}/login` y autenticate con las credenciales que
elegiste en el Día 1 (`admin@verbara.local` + la password que pusiste,
ejemplo `DocumentationDemo2026!`). El tenant es `platform`.

{{step:01-login-form}}

> **Tip:** El input `Tenant ID` puede aparecer oculto si tu deployment está
> en un subdominio `customer.verbara.io` que pre-llena el tenant. En local
> el input se muestra siempre; si no aparece, click en el toggle "Cambiar
> de tenant".

## Paso 2 — Abrir el listado de agentes

Desde `/admin`, andá a **Agentes** en el menú lateral, o directo a
`/admin/agents`. Vas a ver la tabla con María González (creada por el
wizard del Día 1).

{{step:02-admin-agents-list}}

## Paso 3 — Abrir el detalle del agente

Click sobre la fila de **María González**. Aterrizás en
`/admin/agents/{agentId}` con la información del agente y un nuevo botón
**Manage queues** debajo de la sección "Skills".

{{step:03-agent-detail-with-cta}}

> ✅ **Novedad v2.5.5:** la sección "Queue memberships" del detalle del
> agente ahora redirige al editor channel-aware en lugar de mostrar un
> contador read-only. Es el cambio principal que entrega ADR-0026 Phase A.6.

## Paso 4 — Abrir el editor channel-aware

Click en **Manage queues**. Verbara navega a
`/admin/agents/{agentId}/queues` y carga el editor con:

- Un **banner azul** explicando el modelo channel-aware.
- Una sub-tarjeta **Add to queue** (vacía: María ya está en su única
  queue).
- La **tarjeta de membership** para *Atención General* con el badge
  **Voice → Asterisk** indicando que actualmente Asterisk recibe el sync.

{{step:04-agent-queues-editor}}

## Paso 5 — Inspeccionar la membership existente

Antes de cambiar nada, fijate en el estado inicial:

{{step:05-membership-card-before}}

| Campo | Valor inicial | Significado |
|---|---|---|
| **Penalty** | `0` | Prioridad máxima en la queue (0 = primero en recibir conversaciones). |
| **All channels** | `[x]` activado | `AllowedChannels=NULL` en la DB. Todos los canales que acepta la queue se ofrecen al agente. |
| Chips | Todos opacos (deshabilitados) | Sin sentido tocarlos mientras "All channels" esté activado. |
| Badge | `Voice → Asterisk` | Asterisk tiene un `queue_members` row para esta combinación tenant + queue + agente. |

## Paso 6 — Desactivar "All channels" y elegir WebChat

1. Click el checkbox **All channels** para desactivarlo. Los chips se
   activan visualmente — ahora podés clickearlos.
2. Click el chip **WebChat**. Se pinta de azul (estado seleccionado).
3. Dejá los demás chips sin tocar (Voice queda fuera ⇒ Asterisk perderá
   este agente cuando guardes).

El badge en el header de la tarjeta cambia a **Digital only** en tiempo
real (preview en el frontend antes de persistir):

{{step:06-restricted-to-webchat}}

> ⚠️ **Empty list es inválido.** Si quitás "All channels" y no seleccionás
> ningún chip, el backend rechaza el PATCH con
> `HTTP 400 Bad Request: AllowedChannels must be null (= all channels) or
> contain at least one channel. Empty arrays are not allowed; use
> IsExcluded=true for that semantic.` El editor te previene de llegar a ese
> estado (el botón **Save** mantiene la restricción dirty hasta que
> selecciones al menos un canal).

## Paso 7 — Guardar la restricción

Click el botón **Save**. La mutation PATCH va a
`/api/v1/queues/{queueId}/members/{agentId}` con
`{ "allowedChannels": ["WebChat"] }`. El backend:

1. Valida que `WebChat` es un valor conocido del enum `ChannelType`.
2. Persiste `allowed_channels=ARRAY['WebChat']::text[]` en la fila de
   `queue_memberships`.
3. Detecta el voice-diff (antes: voice incluido, ahora: voice fuera) y
   llama a `IRealtimeSyncService.RemoveQueueMemberAsync` → Asterisk
   elimina la fila correspondiente de `queue_members`.
4. Registra un audit log con `action=queue.members.updated` que incluye
   el before/after de `AllowedChannels`.

Aparece un toast de confirmación:

{{step:07-saved-with-toast}}

## Verificación via API

Desde una terminal con acceso al server:

```bash
$ TOKEN={tu-accessToken-del-login}
$ AGENT_ID={el-agentId-de-María}

$ curl -sS -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: platform" \
    "http://{server-ip}/api/v1/admin/agents/$AGENT_ID/queue-memberships" | jq
```

Esperado:

```json
[
  {
    "queueId": "...",
    "queueName": "Atención General",
    "penalty": 0,
    "isExcluded": false,
    "allowedChannels": ["WebChat"],
    "source": "Manual"
  }
]
```

## Verificación en Postgres

Si querés validar el estado al nivel de la base de datos:

```bash
$ docker exec -it verbara-postgres psql -U platform -d verbara -c \
    "SELECT q.name, a.display_name, qm.allowed_channels, qm.source
     FROM queue_memberships qm
     JOIN queues q ON q.queue_id = qm.queue_id
     JOIN agents a ON a.agent_id = qm.agent_id
     WHERE a.display_name = 'María González';"
```

Esperado:

```
      name        | display_name   | allowed_channels | source
------------------+----------------+------------------+--------
 Atención General | María González | {WebChat}        | manual
```

## Verificación en Asterisk

Para confirmar que Asterisk también recibió el unsync:

```bash
$ docker exec -it verbara-asterisk asterisk -rx "queue show Atención General"
```

Esperado: la membership de María González **no aparece** en la lista de
miembros del queue, porque su `allowed_channels` excluye voz.

> 💡 **Reversibilidad.** Si volvés al editor y activás "All channels" otra
> vez, el backend hace un PUT con `ClearAllowedChannels=true` y le manda
> `AddQueueMemberAsync` a Asterisk con la penalty y el display name — el
> `queue_members` row vuelve a aparecer en la siguiente recarga del PBX.

## Próximos pasos

| Día | Manual | Tiempo | Qué vas a configurar |
|---|---|---|---|
| 3 | `03-day3-voice-sip.md` | 60–90 min | Canal Voz/SIP (trunk del carrier + DID + NAT). Después de instalar voz vas a querer revisar este manual y agregar `Voice` al chip de María cuando esté lista. |
| 7 | `04-day7-first-report.md` | 20 min | Primer reporte de conversaciones — los logs de auditoría incluyen los cambios de channel routing como `queue.members.updated`. |
