---
persona: smb-owner
journey: 01-day1-setup-and-webchat
title: "Día 1 — Setup inicial + Canal WebChat"
version: v2.5.4
locale: es-419
status: draft
authored: 2026-05-28
audience: "Operador SMB que acaba de levantar el stack con docker compose y va a configurar Verbara por primera vez."
estimated_time: "20–25 minutos"
prerequisites:
  - "Stack Verbara SMB arriba — todos los servicios `healthy` (manual 02-arranque-stack.md)."
  - "Acceso al frontend web en `http://{server-ip}/` desde un navegador."
  - "Un email + password fuerte (mínimo 12 caracteres) para el platform admin."
---

# Día 1 — Setup inicial + Canal WebChat

> Este manual cubre el **primer arranque** de Verbara después de que el stack
> Docker está corriendo. Al terminar vas a tener: un platform admin creado,
> una queue de atención, un agente operativo, y el canal WebChat habilitado
> con un snippet HTML listo para embeber en el sitio web del cliente.
>
> Es el equivalente combinado de los manuales [03-setup-inicial.md](../../../smb/03-setup-inicial.md)
> y [04-canal-webchat.md](../../../smb/04-canal-webchat.md) escritos a mano,
> pero **generado automáticamente desde un test E2E** — cada captura de aquí
> abajo es la pantalla real que ve el operador en una corrida limpia del
> producto.

## Arquitectura del Día 1

Antes de empezar, el siguiente diagrama muestra qué se va a crear:

```
   Operador SMB (browser)
         │
         │  (1) POST /api/v1/setup   ← endpoint anónimo, una sola vez
         ▼
   Verbara — Platform Admin creado
         │
         │  (2) Wizard 5 pasos    ← welcome → queue → agente → canal → test
         ▼
   Queue + Agente + WebChat habilitado
         │
         │  (3) Snippet HTML listo para embeber
         ▼
   Sitio del cliente con la burbuja flotante
```

> 🔒 **El endpoint `POST /api/v1/setup` es anónimo solo la primera vez.**
> Apenas existe un admin, el endpoint queda bloqueado y devuelve
> `HTTP 409 Conflict` con `"Setup already completed"`. No es un bug — es
> diseño para evitar credenciales por defecto y para que nadie pueda
> "resetear" tu workspace recreando el admin.

## Paso 1 — Abrir la página de setup

Abrí `http://{server-ip}/` en el navegador. Verbara detecta que todavía no
hay ningún usuario en la base de datos y te redirige automáticamente a
`/setup`. Vas a ver un formulario con 4 campos.

{{step:01-setup-page-open}}

> 💡 Si en lugar del formulario te aparece la pantalla de login, alguien ya
> ejecutó el setup. Saltá al manual [03-setup-inicial.md](../../../smb/03-setup-inicial.md)
> §2 ("Login al Web UI").

## Paso 2 — Completar el formulario

| Campo | Qué poner |
|---|---|
| **Email** | El email del responsable del workspace (`admin@tu-empresa.com`). Se usa para login y para notificaciones de billing/auditoría. |
| **Password** | Mínimo 12 caracteres. Mezclá mayúsculas, minúsculas, números y símbolos. Guardalo en un gestor de contraseñas antes de continuar — no hay recuperación si lo perdés. |
| **Display name** | El nombre que verán otros usuarios y agentes (`Admin Verbara`, `Juan Pérez`, etc.). Es editable después. |
| **Platform name** | El nombre comercial del workspace tal como debería aparecer en emails, reports y la UI (`Verbara - Mi Empresa`). |

{{step:02-setup-form-filled}}

Click **Crear platform admin** para enviar.

## Paso 3 — Guardar el Management API Key

El backend responde con un modal que muestra una sola vez el
**Management API Key**. Este key da acceso administrativo total al tenant
`platform` vía el header `X-Api-Key` — útil para automatizaciones,
scripts de provisioning y monitoring sin tener que loguearte cada vez.

{{step:03-setup-success}}

> 🔒 **Copiar y pegar en tu gestor de contraseñas AHORA.** Después de
> cerrar este modal el key no se vuelve a mostrar nunca — se guarda
> hasheado en el backend. Si lo perdés, hay que crear uno nuevo y el viejo
> queda inservible.

Click **Done / Entendido** para cerrar el modal.

## Paso 4 — Iniciar sesión con el admin recién creado

> ⚠️ **Comportamiento real vs lo que dice el manual escrito a mano:** El
> endpoint `/setup` crea el platform admin pero **no emite una cookie de
> sesión automáticamente**. El frontend te redirige a `/login` después de
> cerrar el modal del Management API Key. Tenés que loguearte una vez con
> las credenciales que acabás de elegir.
>
> Esto contradice lo que dice el manual `03-setup-inicial.md` §1 ("queda
> logueado y aterrizado en `/admin`"). Detectar este tipo de drift entre
> manual escrito a mano y comportamiento real del producto es exactamente
> el motivo por el cual este manual se genera **desde el test E2E**, no se
> escribe a mano: si el código cambia, el manual lo refleja
> automáticamente.

{{step:04-login-form}}

Completá `Email` y `Password` con las credenciales del paso 2 y click
**Iniciar sesión**.

## Paso 5 — Aterrizar en el admin dashboard

Después del login, Verbara te lleva a `/admin`. Vas a ver el dashboard
principal con un **banner amarillo** arriba indicando que el setup inicial
está incompleto.

{{step:05-admin-landing}}

> El banner es una sugerencia, no una obligación — podés navegar a
> `/admin/queues`, `/admin/agents`, `/admin/channels`, etc. directamente.
> Pero el wizard hace exactamente lo mismo paso a paso y es lo
> recomendado para la primera vez.

Click **Comenzar wizard** (o navegá manualmente a `/admin/setup`).

## Paso 6 — Welcome del wizard

Pantalla introductoria que explica los 4 pasos que siguen.

{{step:06-wizard-welcome}}

Click **Get started / Comenzar**.

## Paso 7 — Crear la primera Queue

Las **queues** son las colas de atención donde los agentes reciben las
conversaciones — independientemente del canal por donde lleguen
(WebChat, Email, SMS, Voz, etc.). Para empezar alcanza con una sola.

| Campo | Valor sugerido |
|---|---|
| **Nombre** | `Atención General` |

{{step:07-wizard-queue}}

Click **Crear queue y continuar / Next**.

> 💡 Más adelante podés crear queues por línea de negocio (`Soporte
> Técnico`, `Ventas`, `Cobros`) con estrategias de asignación distintas
> (longest-idle, skill-based, round-robin) y configurar el routing
> inbound para que las conversaciones aterricen en la queue correcta
> según metadata (URL de origen, idioma, hora del día, etc.).

## Paso 8 — Crear el primer Agente

Un **agente** es un usuario con permisos para atender conversaciones,
**distinto del platform admin** que administra la plataforma. El wizard
te pide email y nombre para crear una cuenta nueva con role `Agent`.

| Campo | Valor sugerido |
|---|---|
| **Email** | `maria@tu-empresa.com` |
| **Display name** | `María González` |

{{step:08-wizard-agent}}

> 🆕 **A partir de v2.5.5 (ADR-0026 Phase A.4):** el wizard ya no ofrece
> seleccionar un usuario existente como agente — siempre crea uno nuevo
> con role Agent. El platform admin queda separado del operador que
> atiende conversaciones, lo cual es la separación de roles correcta.
> Para promover un usuario existente a agente, usá `/admin/agents/new`
> después del setup.

Click **Crear agente y continuar / Next**.

> 🔗 **A partir de v2.5.5 (ADR-0026 Phase A.1 + A.3):** el wizard asocia
> automáticamente al agente con la queue del paso anterior creando una
> `QueueMembership(source=manual)`. Por defecto el agente queda habilitado
> para **todos los canales** que la queue acepte (`allowed_channels=NULL`);
> podés restringirlo a canales específicos después en
> `/admin/agents/{id}/queues`.

## Paso 9 — Habilitar el canal WebChat

El paso 4 del wizard te permite habilitar un primer canal. Para Día 1
elegimos **WebChat** porque es el único que funciona out-of-the-box, sin
credenciales externas, sin webhooks, sin firewall NAT. Es ideal para
validar el flujo end-to-end en < 5 min.

| Campo | Valor sugerido |
|---|---|
| **Channel** | `WebChat` (recomendado) |
| **Display name** | `Chat del sitio web` |
| **Allowed origins** | `http://localhost,https://tu-sitio.com` |

{{step:09-wizard-channel-webchat}}

> ⚠️ **`allowedOrigins` no acepta `*`.** El backend valida el header
> `Origin:` de cada sesión WebSocket contra esta lista — permitir `*`
> desactivaría el control CORS y un atacante podría iniciar sesiones desde
> cualquier dominio. Para pruebas locales agregá `http://localhost`
> explícitamente; para producción usá el dominio real del sitio del
> cliente (sin wildcards).

Click **Habilitar canal y continuar / Next**.

## Paso 10 — Validar con un mensaje de prueba

El último paso del wizard te muestra un resumen y te invita a enviar
un mensaje de prueba al canal recién configurado. La pantalla incluye
un panel de testing para validar que el widget WebChat responde
correctamente:

{{step:10-wizard-test-step}}

Click **Finalizar wizard / Finish**.

> ✅ **A partir de v2.5.5 (ADR-0026 Phase A.2):** el wizard ahora se puede
> completar end-to-end sin workarounds. Antes (v2.5.4), un bug AOT en la
> serialización de `TenantChannelConfig` y los anonymous types del audit
> trail bloqueaba este paso — ver historial en
> [docs/decisions/0026-queue-membership-executive-routing.md](../../../docs/decisions/0026-queue-membership-executive-routing.md).

## Paso 11 — Confirmar que el wizard se completó

Verbara te lleva de vuelta a `/admin` con todos los counters actualizados:
queue creada, agente provisionado y atado a la queue, canal habilitado.

{{step:11-wizard-done}}

## Paso 12 — Ver el snippet HTML del widget

Navegá a `/admin/channels` y entrá a la fila **WebChat**, o directo a
`/admin/webchat`. Vas a ver el snippet HTML que tenés que pegar en el
sitio del cliente, antes del cierre de `</body>`:

{{step:12-admin-channels-webchat}}

| Atributo | Valor | Notas |
|---|---|---|
| `src` | URL del JS del widget servido por el nginx-gateway | `https://` si tu Web está bajo TLS; `http://{server-ip}/webchat/v1/...` para pruebas locales |
| `data-tenant-id` | El ID del tenant que recibe las conversaciones | `platform` si tenés un solo tenant; el slug del tenant si es multi-tenant |
| `data-locale` | `auto` / `es-419` / `pt-BR` / `en-US` | `auto` detecta del navegador del visitante |
| `data-position` | `bottom-right` / `bottom-left` / `top-right` / `top-left` | Posición de la burbuja flotante en el sitio del cliente |

Click el botón **Copiar snippet** y pegalo en el HTML de prueba.

## Paso 13 — Probar el widget con la página demo

Verbara incluye una página de prueba en `/webchat/demo.html` con el
snippet ya embebido. Útil para validar antes de tocar el sitio del
cliente:

{{step:13-webchat-snippet-visible}}

La burbuja flotante (bottom-right por defecto) abre el iframe del widget
al hacer click. Desde allí cualquier visitante anónimo puede iniciar una
conversación que aterriza en la queue **Atención General**.

## Verificación final via API

Desde el host o cualquier máquina con acceso al server:

```bash
$ TOKEN={el-accessToken-del-paso-3}
$ curl -sS -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: platform" \
    http://{server-ip}/api/v1/admin/queues | jq

$ curl -sS -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: platform" \
    http://{server-ip}/api/v1/admin/agents | jq

$ curl -sS -H "Authorization: Bearer $TOKEN" -H "X-Tenant-Id: platform" \
    http://{server-ip}/api/v1/admin/channels | jq
```

Esperado: cada llamada retorna al menos una entrada con los datos que
acabás de configurar (`name: "Atención General"`,
`displayName: "María González"`, `id: "webchat", enabled: true`).

## Próximos pasos

| Día | Manual | Tiempo | Qué vas a configurar |
|---|---|---|---|
| 2 | `02-day2-email-channel.md` | 30 min | Canal Email (SMTP outbound + IMAP inbound o OAuth M365/Gmail) |
| 3 | `03-day3-voice-sip.md` | 60–90 min | Canal Voz/SIP (trunk SIP del carrier + firewall NAT) |
| 7 | `04-day7-first-report.md` | 20 min | Primer reporte de conversaciones + métricas básicas de queue |
| 30 | `05-day30-troubleshooting.md` | abierto | Troubleshooting de la primera semana de operación |
