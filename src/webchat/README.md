# Verbara WebChat — Embedding Guide

This directory contains the customer-embeddable WebChat widget. See [Track 7C spec](../../docs/specs/2026-05-09-track-7c.md) for design rationale.

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
  apiBase: 'https://api.your-domain/api/v1',
  locale: 'auto',
  theme: { primaryColor: '#0d9488' },
  position: 'bottom-right',
  greeting: 'Hi! How can we help?',
});
```

## Programmatic API

```javascript
VerbaraWebChat.open();
VerbaraWebChat.close();
VerbaraWebChat.sendMessage('hello');
VerbaraWebChat.setVisitor({ name: 'Jane', email: 'jane@x.com' });
VerbaraWebChat.on('open', () => console.log('chat opened'));
VerbaraWebChat.on('unread', (count) => console.log('unread:', count));
VerbaraWebChat.destroy();
```

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

The widget uses `localStorage` (not cookies) to persist visitor identity across sessions. Two keys per tenant:

- `verbara-webchat-visitor:<tenantId>` — visitor UUID
- `verbara-webchat-profile:<tenantId>` — name + email

A "Reset" button in the widget settings clears both keys.

## Mobile

Below 600px viewport width, the widget takes over the full screen. The bubble button hides; the chat header has a close button.

## Out of scope (deferred)

See the [spec's Out of Scope section](../../docs/specs/2026-05-09-track-7c.md) for the full list. Notable deferrals: file uploads from visitor, voice/video, bot routing, NPM package, mobile-native SDK, external CDN.
