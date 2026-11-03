# Verbara WebChat — Embedding Guide

This directory contains the customer-embeddable WebChat widget (Track 7C).

## Quick start

Add this snippet to your site (just before `</body>`):

```html
<script
  src="https://your-domain/webchat/v1/verbara-webchat.js"
  data-tenant-id="YOUR_TENANT_ID"
  data-locale="auto"
  data-position="bottom-right"
></script>
```

## Configuration

All `data-*` attributes on the script tag are passed to `VerbaraWebChat.init()`. Or initialize programmatically:

```javascript
VerbaraWebChat.init({
  tenantId: 'YOUR_TENANT_ID',
  // Optional. Defaults to the origin that served the SDK script.
  apiBase: 'https://your-domain/api/v1',
  locale: 'auto',
  theme: { primaryColor: '#0d9488' },
  position: 'bottom-right',
  greeting: 'Hi! How can we help?',
});
```

## Embedding on another domain

The widget runs on any site, whatever its domain. Its frame, its API calls and its socket all use the origin that
served the SDK script (`https://your-domain` above), or the origin of `apiBase` when you pass one; never the origin
of the page the tag sits on. Inside the frame, the session and the socket always stay on the frame's own origin.
The frame talks over `postMessage` only with the page that embeds it: it learns that page's origin from
`location.ancestorOrigins`, or, in browsers without it, from a `hostOrigin` parameter the SDK adds to the frame's
address.

## Programmatic API

```javascript
VerbaraWebChat.open();
VerbaraWebChat.close();
VerbaraWebChat.sendMessage('hello');
VerbaraWebChat.setVisitor({ name: 'Jane', email: 'jane@x.com' });
VerbaraWebChat.on('open', () => console.log('chat opened'));
VerbaraWebChat.on('unread', (count) => console.log('unread:', count));
await VerbaraWebChat.destroy();
```

`destroy()` removes the widget and clears the conversation it kept in the browser (see Privacy). It returns a promise
that resolves once the widget's frame is gone, at most about two seconds later. The visitor id and profile on the
site's page are cleared at once; the conversation inside the frame is cleared only if the page stays loaded until the
promise resolves. Before navigating away, for example when a visitor logs out, wait for it:

```javascript
async function logout() {
  await VerbaraWebChat.destroy();
  location.assign('/logged-out');
}
```

Calling `init()` or `open()` again right after `destroy()` is safe: the new widget's frame is created only once the
previous frame is gone, so the previous frame's clear never touches the new conversation.

Events: `open`, `close`, `unread`, `message-sent`, `message-received`, `ready`.

## CSP requirements

Hosts using strict CSP must allowlist:

- `script-src https://your-domain` (for the SDK)
- `frame-src https://your-domain` (for the iframe)
- `connect-src https://your-domain wss://your-domain` (for API + WebSocket)

## Browser support

Modern browsers (ES2020+ syntax). IE11 not supported. Safari 14+, Chrome 90+, Firefox 88+, Edge 90+.

## Versioning

Path-based: `/webchat/v1/verbara-webchat.js`. Breaking changes will publish to `/webchat/v2/`. The unversioned `/webchat/verbara-webchat.js` always points to the latest stable.

## Theming

CSS custom properties exposed inside the iframe:

- `--vw-primary`, `--vw-primary-foreground`, `--vw-bg`, `--vw-fg`, `--vw-border`, `--vw-muted`, `--vw-radius`, `--vw-font`

Override via `theme` config; the SDK injects them as inline styles into the iframe document.

## Privacy

The widget uses `localStorage` (not cookies) to persist visitor identity across sessions. Two keys per tenant, in
the site's own storage (the SDK):

- `verbara-webchat-visitor:<tenantId>` — visitor UUID
- `verbara-webchat-profile:<tenantId>` — name + email

`VerbaraWebChat.destroy()` clears both keys.

Inside the widget's frame, in its own storage:

- `verbara-webchat-session:<tenantId>` — the current session (id, socket URL, visitor UUID, last activity), so a
  reload or the next page within 30 minutes resumes it. It belongs to the visitor UUID above.
- `verbara-webchat-messages:<tenantId>:<visitorUUID>` — the last 100 messages shown to that visitor; another visitor
  UUID never reads them
- `verbara-webchat-queue:<tenantId>` — messages typed while the socket was not open, sent when it opens

`VerbaraWebChat.destroy()` asks the frame to clear all three for the tenant and waits for its answer (about two seconds
at most) before removing it; a frame that was not opened on the page is loaded hidden to receive the request. Call it
when the person using the browser changes, for example on a shared device.

## Mobile

Below 600px viewport width, the widget takes over the full screen. The bubble button hides; the chat header has a close button.

## Out of scope (deferred)

Notable deferrals: file uploads from visitor, voice/video, bot routing, NPM package, mobile-native SDK, external CDN.
