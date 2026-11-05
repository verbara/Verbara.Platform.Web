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
that resolves once the widget's frame is gone, usually within about two seconds. A `destroy()` called while an earlier
widget's frame is still being removed waits for that frame first, so it can take about two seconds for each frame still
pending. The visitor id and profile on the site's page are cleared at once; the conversation inside the frame is cleared
only if the page stays loaded until the promise resolves. Before navigating away, for example when a visitor logs out, wait for it:

```javascript
async function logout() {
  await VerbaraWebChat.destroy();
  location.assign('/logged-out');
}
```

Calling `init()` or `open()` again right after `destroy()` is safe: the new widget's frame is created only once the
previous frame is gone, so the previous frame's clear never touches the new conversation.

Events: `open`, `close`, `unread`, `message-sent`, `message-received`, `ready`, `identity`.

## Identify signed-in visitors

The widget can tell an agent who a visitor is. There are two levels, and Platform answers one of them, as
`identityLevel`, each time a session is created:

| `identityLevel` | How it is reached                                                 | The contact                                        | What the agent sees             |
| --------------- | ----------------------------------------------------------------- | -------------------------------------------------- | ------------------------------- |
| `Verified`      | Your server signed a token for the customer, and it verifies      | One per `external_id`, on every session and device | A "Verified" badge              |
| `Unverified`    | Level 1 is on, and the browser sends the widget's own `visitorId` | One per browser                                    | An "identity not verified" mark |
| `Anonymous`     | Neither                                                           | One per session                                    | No mark                         |

The agent sees the mark on the contact card, in the conversation header, on every row of the History tab and in the
transcript opened from a row. The visitor sees no difference, and the chat works the same at every level.

Level 1 knows a browser, not a person: two people who share a browser share its contact and that contact's history.
If your site has a login, use the token. The levels are not merged: someone who chats anonymously and later signs in has
two contacts.

The pre-chat form identifies nobody. Its name and e-mail never find or join contacts, and they never fill a `Verified`
contact, which takes its name and e-mail only from the token's `name` and `email` claims. A token with neither adds
neither.

### Level 1 stays off until the host turns it on

Level 1 is off by default. Until the host sets `WebChat:VisitorIdentity:Level1Enabled`, Platform treats every `visitorId`
as absent, so a browser with no verified token gets `Anonymous` and a contact of that session alone. The setting belongs
to whoever runs Platform, not to your site, and a verified token works with it on or off.

The host turns it on in this order, from the "Upgrading" note of the Platform release that added these levels
(Verbara.Platform #543):

1. Deploy that Platform release. Level 1 is off.
2. Deploy the console release that renders `data-identity-level`, because a linked contact's history must carry the
   unverified mark.
3. Have every agent reload the console, for example at the next shift change. A tab left open from before step 2 shows
   linked history without the mark.
4. Measure what a session create costs on your contacts table.
5. Set `WebChat__VisitorIdentity__Level1Enabled=true` and restart the Api. It is read once at start-up.

If both images are upgraded together, steps 2 to 5 happen at once; step 4 still comes before step 5.

**Measure first on a large tenant.** With the setting on, every session create with a `visitorId` looks the contact up
by its identity key. That lookup reads every contact of the tenant, because no index serves it, and it holds a database
connection and a lock on that key while it runs. On a table of many contacts, run `EXPLAIN (ANALYZE, BUFFERS)` of the
lookup against a copy of your data before turning the setting on, and judge the result against your session rate. The
same lookup runs for every session with a verified token, with the setting on or off, so a large tenant should know
this cost before it signs tokens as well.

Turning the setting off stops new linking at once. Contacts already linked keep their keys and still read `Unverified`.
That does not roll back the console: a console older than step 2 shows their linked history without the mark.

The `visitorId` must be the widget's own. It generates a random one per browser. Never write
`verbara-webchat-visitor:<tenantId>` yourself or send one constant id for every visitor, because visitors who send the
same id share one contact and its history. Platform reads an id that is not a version-4 GUID as `Anonymous`, and sends a
new session to an `Anonymous` contact of its own when the found contact already holds 5 or more open WebChat
conversations, on a best-effort count. Neither rule stops visitors who use one constant id one after another.

### Sign a token on your server

Set the secret first: the **Identity verification** section of the admin console's WebChat page generates one and shows it
once to copy. Keep it on your server, and never send it to a browser. Platform never shows a stored secret.

The token is a compact JWT signed with HS256, of at most 4096 characters. The key is the UTF-8 bytes of the secret's text
(32 to 512 characters): do not decode it first. `alg` must be exactly `HS256`, `typ` is optional and must be `JWT` when
present, and `kid` is ignored.

| Claim         | Type            | Required | Rule                                                                                                                                                                                     |
| ------------- | --------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `external_id` | string          | Yes      | 1 to 256 characters after trimming. Your own stable id of the customer. Use an opaque id, never an e-mail or a national id: it is stored and shown to agents in the contact's addresses. |
| `aud`         | string or array | Yes      | The Verbara tenant id, as a string or as a one-member array. An array with any other member is refused.                                                                                  |
| `iat`         | integer         | Yes      | Unix seconds: when you signed it.                                                                                                                                                        |
| `exp`         | integer         | Yes      | Unix seconds. `exp` is after `iat`, and `exp` - `iat` is at most 3600.                                                                                                                   |
| `name`        | string          | No       | At most 200 characters. Fills the contact's first name only when the contact has none.                                                                                                   |
| `email`       | string          | No       | At most 320 characters. Stored as the contact's custom field `webchatEmail` when it has none. It never becomes an Email channel address and never links contacts.                        |

The clock allows 300 seconds of difference: a token is refused when `iat` is more than 300 seconds in the future, or when
now is more than 300 seconds past `exp`. A token is not single-use: a reload or a second tab presents it again until then,
which is why its lifetime is capped at 3600 seconds.

Any JWT library works. With [`jose`](https://github.com/panva/jose) on Node.js:

```javascript
import { SignJWT } from 'jose';

// A placeholder: load the secret from your server's own configuration.
const secret = new TextEncoder().encode('YOUR_IDENTITY_TOKEN_SECRET');

export function signIdentityToken(customer, tenantId) {
  return new SignJWT({ external_id: customer.id, name: customer.name, email: customer.email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setAudience(tenantId)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(secret);
}
```

### Pass it to the widget

Call `init` from your own script, and **remove `data-tenant-id` from the script tag**. With that attribute the tag starts
the widget by itself, with no token, before your script runs, and the widget then forgets the signed-in customer's chat on
every page.

Do not write the token into the page's HTML or the script tag. A CDN or another cache can store that page and serve it to a
different customer, and the widget reads no token from the tag. Fetch it from a route of your own that answers only for
the customer signed in and sends `Cache-Control: no-store`:

```html
<script src="https://your-domain/webchat/v1/verbara-webchat.js"></script>
<script type="module">
  // Your route answers { "token": "<signed token>" }, or { "token": null } when nobody is signed in.
  const response = await fetch('/your-route/webchat-identity-token');
  const { token } = await response.json();
  VerbaraWebChat.init({ tenantId: 'YOUR_TENANT_ID', identityToken: token });
</script>
```

The token stays in memory and is never stored, so a reload loses it: pass one on every page that loads the widget for a
signed-in customer.

**Refresh** a token on a page that stays open, before the current one ends:

```javascript
VerbaraWebChat.setVisitor({ identityToken: newToken });
```

A token is checked only when a session is created, so a refreshed token for the same customer does not cut the live
chat. The next session create sends it.

**Sign out** with one of these:

```javascript
// Keeps the widget on the page, for the next visitor.
VerbaraWebChat.setVisitor({ identityToken: null });

// Removes the widget. Wait for it before navigating away (see Programmatic API).
await VerbaraWebChat.destroy();
```

### The three token states

| `identityToken` | Meaning                    | In `init`                                                         | In `setVisitor`                                        |
| --------------- | -------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| A string        | This customer is signed in | Starts or continues that customer                                 | The same. The same customer's new token keeps the chat |
| `null`          | Signed out                 | Forgets the signed-in customer, silently                          | The same                                               |
| Left out        | No statement               | After a signed-in customer: forgets and warns. Otherwise, nothing | Changes nothing                                        |

Left out of `init` after a sign-in, the widget cannot tell a page with no token from a sign-out you did not signal, so it
takes the safe reading. It forgets, and the browser console says:

```text
VerbaraWebChat: the widget state was forgotten because a signed-in visitor was last seen and no identityToken was passed. Pass the token on every signed-in page, and null (or destroy()) on sign-out.
```

**What forgetting does.** The widget ends the live session and clears what it kept in this browser, as `destroy()` does, and
its next session carries a new visitor id. It forgets in these cases:

- a token for a different `external_id`;
- `null`, or a token left out of `init`, after a signed-in customer;
- **the first token over anonymous state**: this browser already used the widget for this tenant with no token, so what it
  kept may be someone else's;
- a token whose payload cannot be read (below), after a signed-in customer.

When a token is in hand and the visitor had already opened the widget on this page, the new session starts at once. Every
open tab of your site ends the previous customer's chat, including a tab you did not call.

**A token whose payload cannot be read** has fewer than three dot-separated segments, a payload that is not base64url JSON,
or no string `external_id`. The widget still sends it unchanged, and Platform decides what it is worth. With no customer last seen,
nothing is forgotten. After a signed-in customer the widget cannot tell whether the customer changed, so it forgets, and
the console says, with no part of the token:

```text
VerbaraWebChat: the identityToken payload could not be read, so the widget state of the previously signed-in visitor was forgotten.
```

**Level 2 needs an `https` page.** Telling customers apart takes `crypto.subtle`, which browsers offer only on a secure page.
On plain `http` the widget still sends the token, but it keeps no record of the customer and forgets nothing when the
customer changes, and it warns once in the console.

### Read the outcome

Register after `init`, and again after a later `init` or `destroy()`, which remove the listeners:

```javascript
VerbaraWebChat.on('identity', ({ identityLevel, identityTokenRefusal }) => {
  if (identityTokenRefusal) reportToYourMonitoring(identityTokenRefusal);
});
```

The event fires each time the widget creates a session, not when it resumes a stored one. `identityTokenRefusal` is present
only when a token was sent and refused, and the console then shows the code alone. A refused token never refuses the
session: it opens at level 1 when that is on and the `visitorId` is usable, and at `Anonymous` otherwise, so a broken signer
costs the verification and not the chat.

| `identityTokenRefusal`             | When, in the order Platform checks                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `identity-token-not-configured`    | The tenant has no secret.                                                                                                                                            |
| `identity-token-malformed`         | The structure, the length, the base64url, the header's JSON or `alg`. After the signature, also a required claim that is absent, of the wrong type or out of bounds. |
| `identity-token-signature-invalid` | The signature matches neither the current secret nor the previous one inside its 24 hours.                                                                           |
| `identity-token-wrong-tenant`      | `aud` is not the tenant id of the session, or an `aud` array holds another tenant.                                                                                   |
| `identity-token-lifetime-too-long` | `exp` is not after `iat`, or `exp` - `iat` is over 3600.                                                                                                             |
| `identity-token-not-yet-valid`     | `iat` is more than 300 seconds in the future.                                                                                                                        |
| `identity-token-expired`           | Now is more than 300 seconds after `exp`.                                                                                                                            |

### Rotate the secret

In the **Identity verification** section of the WebChat page:

1. **Rotate secret** generates a new one and shows it once. Copy it, then save and confirm. The old secret keeps verifying
   for 24 hours from that moment.
2. Deploy the new secret to your signer within those 24 hours.
3. **Revoke previous secret** ends those 24 hours at once. Do it as soon as you no longer trust the old one.

**Turn off identity verification** removes both secrets. Every later token answers `identity-token-not-configured`, and
sessions open at level 1 or `Anonymous`.

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

When the site passes an `identityToken`, two more, so the widget can tell that the signed-in customer changed:

- `verbara-webchat-subject:<tenantId>` — an HMAC-SHA256 of the customer's id, never the id or the token
- `verbara-webchat-subject-key:<tenantId>` — the random key of that HMAC, of this browser and tenant

The token itself is never stored. `VerbaraWebChat.destroy()` clears the visitor UUID, the profile and the HMAC.

Inside the widget's frame, in its own storage:

- `verbara-webchat-session:<tenantId>` — the current session (id, socket URL, visitor UUID, last activity), so a
  reload or the next page within 30 minutes resumes it. It belongs to the visitor UUID above.
- `verbara-webchat-messages:<tenantId>:<visitorUUID>` — the last 100 messages shown to that visitor; another visitor
  UUID never reads them
- `verbara-webchat-queue:<tenantId>:<visitorUUID>` — messages typed while the socket was not open, sent when it opens
  into a session of that visitor UUID. When the widget starts, it deletes the queue of any other visitor UUID of the
  tenant

`VerbaraWebChat.destroy()` asks the frame to clear all three for the tenant and waits for its answer (about two seconds
at most) before removing it; a frame that was not opened on the page is loaded hidden to receive the request. If the
frame never answers, the next visitor still neither sees nor sends what was kept, and the widget's next start deletes
the queue. Call it
when the person using the browser changes, for example on a shared device.

## Mobile

Below 600px viewport width, the widget takes over the full screen. The bubble button hides; the chat header has a close button.

## Out of scope (deferred)

Notable deferrals: file uploads from visitor, voice/video, bot routing, NPM package, mobile-native SDK, external CDN.
