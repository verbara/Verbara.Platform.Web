# WebChat Customer Widget

**Date:** 2026-05-03
**Parent track:** v1.14.x roadmap — Track 7C (`v1.21.0`)
**Scope:** Greenfield. Producto en sí, separable del Web admin app. Embebible por clientes en sus propios sitios.

## Context

Backend Platform shipeó WebSocket transport para WebChat en v1.5.0 (spec `2026-04-09-v150-web-sync-design.md`, 62KB). El backend tiene endpoints de `/api/v1/webchat/...` y SignalR hub para conversaciones bidireccionales. **Cero código del widget en este repo.**

El widget NO es parte del admin app. Es un asset embebible por el cliente final (su sitio web público) para que sus visitantes inicien conversaciones contact-center. Características esperadas:

- Aislamiento del host (CSP, sandboxing)
- Personalización vía tenant (theming, posición, prompts)
- Transport real-time (SignalR sobre WebSocket)
- Funcionalidad: typing indicators, file attachments, transcript export
- Multi-locale (3 idiomas ya soportados en backend)

Ningún spec previo aborda **cómo** se embebe ni **cómo** se distribuye. Este spec define la arquitectura.

## Approved approach — Hybrid: JS SDK + iframe-rendered widget

Tras evaluar las 3 opciones (puro iframe, puro JS SDK, hybrid), se elige **hybrid**:

1. **JS SDK** (`asterisk-webchat.js`, ~5-15 KB gzipped) — un script tag que el cliente embebe:
   ```html
   <script src="https://cdn.<your-domain>/webchat/v1/asterisk-webchat.js"
           data-tenant-id="abc123" data-locale="auto"></script>
   ```
   El SDK carga lazy un iframe que apunta al widget app, pasando la config via `postMessage`.

2. **Widget app dentro de iframe** (`/webchat/embed/...`) — React app full, transport SignalR. Aislada del host vía `iframe sandbox="allow-scripts allow-popups"` y CSP estricto.

3. **Comunicación** — `postMessage` del iframe al SDK (host-side) para: notify unread count, request open/close, redirect on conversation end.

**Razón:** iframe puro no permite cambiar el "bubble" UI desde el host (el bubble es el botón flotante visible siempre). JS SDK puro requiere injectar CSS/DOM en el host (riesgo de conflict con CSS del cliente). Hybrid evita ambos.

### Repo layout

Separar el widget en su propio paquete dentro del monorepo (cuando se introduzca workspace) o como app sub-folder por ahora:

```
src/webchat/                          ← greenfield
  embed/                              ← React app dentro de iframe
    main.tsx                          ← entrypoint del iframe
    chat-widget.tsx                   ← UI principal
    transcript.tsx
    file-attach.tsx
    transport/
      signalr-client.ts
      offline-queue.ts
  sdk/                                ← código del JS SDK (host-side, vanilla)
    index.ts                          ← entrypoint del script tag
    bubble.ts                         ← botón flotante en host page
    iframe-loader.ts
    postmessage-bridge.ts
public/webchat/                       ← built assets
  embed/                              ← iframe app
  asterisk-webchat.js                 ← bundle del SDK (versionado: v1.js, v2.js)
```

### Build pipeline

- Vite multi-config: `vite.config.ts` (admin app) + `vite.webchat-sdk.config.ts` (SDK bundle, library mode) + `vite.webchat-embed.config.ts` (iframe app)
- Output del SDK: `public/webchat/asterisk-webchat.js` (UMD/IIFE, no module syntax para max compat)
- Output del embed: `public/webchat/embed/index.html` + assets
- Versioning del SDK: `/webchat/v1/asterisk-webchat.js` (mayor breaking) + `/webchat/asterisk-webchat.js` (alias del latest stable)

### Theming

API del SDK acepta `data-theme="..."` o configuración runtime:

```html
<script src="..." data-theme='{"primaryColor":"#FF5733","fontFamily":"Inter"}'></script>
```

Iframe app aplica el theme via CSS variables en runtime. Default theme matches branding del tenant (consultado via API).

### Security

- **CSP del iframe:** `default-src 'self' https://api.<your-domain>; connect-src wss://api.<your-domain>; img-src https://...`
- **Sandbox attributes:** `allow-scripts allow-popups allow-same-origin` (same-origin necesario para que el iframe acceda a su propio storage; popups para abrir preview de attachments)
- **CORS del API:** `Access-Control-Allow-Origin` whitelist de hosts del cliente (configurable por tenant). Backend ya soporta esto en Platform.
- **postMessage targetOrigin** — siempre validar, nunca `*`
- **Tenant API key** — el `data-tenant-id` no es secreto; auth real es via short-lived JWT que el SDK obtiene tras handshake (backend ya tiene endpoint `/api/v1/webchat/handshake`)

### Multi-locale

Reutilizar i18n stack del admin app pero con bundle separado (no cargar todos los namespaces — solo `webchat` namespace). Detección: `data-locale="auto"` (browser default) o explícito (`data-locale="es-419"`).

Tres locales soportados: es-419, en-US, pt-BR (matching admin).

### Transport

SignalR (ya existe `@microsoft/signalr` en deps del admin app). Hub: `/api/v1/webchat/hub` (backend confirma).

- Reconnect automático con exponential backoff
- Offline queue: mensajes en `localStorage` (clave per-tenant), se reenvían al reconectar
- Typing indicators: `chat.typing` event broadcast con throttle 500ms

## Implementation outline

1. Setup repo structure (`src/webchat/`)
2. Vite multi-config (`vite.webchat-*.config.ts`)
3. SDK MVP: bubble + iframe loader + postmessage bridge
4. Iframe app MVP: chat UI sin transport
5. Wire SignalR transport
6. Theming + i18n
7. Offline queue + reconnect
8. Demo page (`/webchat/demo.html`) embebiendo el SDK con tenant=demo
9. CDN + versioning strategy (decidir: GitHub Pages, Cloudflare Workers, S3+CloudFront)
10. Tests E2E: visitor opens widget, sends message, agent receives via admin app, agent replies, visitor receives

## Out of scope para v1

- File attachments avanzados (drag-drop multi-file, preview); v1 single-file simple
- Video/voice (out of scope absolutely; producto separado)
- Custom branding completo (logos, animaciones); v1 solo color + font
- Mobile-native SDK (iOS/Android); web-first
- Analytics widget-side; defer

## Open questions

1. **CDN choice:** Cloudflare Workers, GitHub Pages, S3+CloudFront, propio nginx? Decidir antes de v1.21.0 ship.
2. **Service Worker para offline?** Defer hasta validación del MVP.
3. **¿NPM package del SDK?** Útil para integraciones tipo Next.js/React. Defer hasta demanda real.
4. **¿Preview previo de iframe en sitios sin permisos?** El SDK debería degradar grácilmente.
5. **A11y compliance** — iframe widget debe cumplir WCAG; coordinar con Track 5C (a11y deeper) que probablemente se ship antes que este track.
6. **¿Telemetry del widget?** (cuántos opens, cuántos messages enviados) — coordinar con Track 1E (Sentry) o producto analytics dedicado.
