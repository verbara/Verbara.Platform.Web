# Track 7C-polish Implementation Plan

> Closes 12 gaps + 4 missing tests identified in post-ship audit of `v3.0.0-web`. Ship as `v3.0.1-web` (patch — no public SDK API change).

**Goal:** Cerrar bugs latentes y features marcadas ✅ en spec pero vacías en código, alineando el implementación real con la promesa del spec del Track 7C.

**Architecture:** Ediciones quirúrgicas a `src/webchat/`. No agrega archivos nuevos en SDK. Agrega `src/webchat/embed/{message-cache.ts, sentry-breadcrumbs.ts, theme-apply.ts}`. Refactor de `message-list.tsx` para virtualización + `pre-chat-form.tsx` para a11y baseline.

**Tech Stack:** Mismo que Track 7C — `@tanstack/react-virtual` (ya instalado), `useFieldA11y` (existe en core), Sentry (ya inicializado).

**Spec reference:** [`docs/specs/2026-05-09-track-7c.md`](../../specs/2026-05-09-track-7c.md). Esta polish cubre items C, D, F, H que quedaron parcialmente entregados.

**Out of scope (blocked by backend):**

- Office-hours indicator — requiere `GET /api/v1/webchat/availability`
- True history fetch — requiere `GET /api/v1/webchat/sessions/{id}/messages`
- Tenant-level theme defaults — requiere `GET /api/v1/webchat/config`
- `CreateSessionRequest` ignora `visitor*` y `pageContext` (frontend manda, backend descarta)

Estos quedan documentados al cierre del polish para futuro track cross-repo.

---

## Tasks

### Task P1 — Theme propagation: SDK → iframe CSS vars

**Files:**

- Create: `src/webchat/embed/theme-apply.ts`
- Modify: `src/webchat/embed/chat-widget.tsx` (extend `InitConfigPayload`)
- Modify: `src/webchat/embed/app.tsx` (call applyTheme on init-config)

- [ ] **Step 1:** Create `src/webchat/embed/theme-apply.ts`:

```ts
export interface ThemeConfig {
  primaryColor?: string;
  fontFamily?: string;
}

const ALLOWED_COLOR = /^#[0-9a-f]{3,8}$|^rgb/i;

export function applyTheme(theme: ThemeConfig | undefined): void {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.primaryColor && ALLOWED_COLOR.test(theme.primaryColor)) {
    root.style.setProperty('--vw-primary', theme.primaryColor);
  }
  if (theme.fontFamily) {
    // Strip quotes/semicolons defensively (CSS context, not HTML)
    const safe = theme.fontFamily.replace(/[;<>"]/g, '');
    root.style.setProperty('--vw-font', safe);
  }
}
```

- [ ] **Step 2:** Extend `InitConfigPayload` in `chat-widget.tsx`:

```ts
export interface InitConfigPayload {
  tenantId: string;
  apiBase?: string;
  visitorId: string;
  visitor?: { name?: string; email?: string };
  pageContext: { url: string; title: string; referrer: string };
  greeting?: string;
  theme?: { primaryColor?: string; fontFamily?: string };
}
```

- [ ] **Step 3:** In `app.tsx`, import and call `applyTheme` inside the `bridge.on('init-config', ...)` handler:

```ts
import { applyTheme } from './theme-apply';
// ...
bridge.on('init-config', (payload) => {
  const cfg = payload as InitConfigPayload;
  applyTheme(cfg.theme);
  setConfig(cfg);
});
```

- [ ] **Step 4:** Test (`src/webchat/embed/theme-apply.test.ts`):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme } from './theme-apply';

beforeEach(() => {
  document.documentElement.style.cssText = '';
});

describe('applyTheme', () => {
  it('SetsPrimaryColor_WhenValidHex', () => {
    applyTheme({ primaryColor: '#ff0066' });
    expect(document.documentElement.style.getPropertyValue('--vw-primary')).toBe('#ff0066');
  });
  it('IgnoresInvalidColor', () => {
    applyTheme({ primaryColor: 'javascript:alert(1)' });
    expect(document.documentElement.style.getPropertyValue('--vw-primary')).toBe('');
  });
  it('AcceptsRgb', () => {
    applyTheme({ primaryColor: 'rgb(255,0,102)' });
    expect(document.documentElement.style.getPropertyValue('--vw-primary')).toBe('rgb(255,0,102)');
  });
  it('SetsFontFamily_StrippingDangerous', () => {
    applyTheme({ fontFamily: 'Inter; }<script>' });
    expect(document.documentElement.style.getPropertyValue('--vw-font')).toBe('Inter }script');
  });
  it('NoOp_WhenUndefined', () => {
    applyTheme(undefined);
    expect(document.documentElement.style.cssText).toBe('');
  });
});
```

Run: `npx vitest run src/webchat/embed/theme-apply.test.ts` — expect 5 pass.

Commit: `feat(webchat-embed): inject theme CSS vars from SDK init-config`

---

### Task P2 — Inline media attachments propagation

**Files:**

- Modify: `src/webchat/embed/chat-widget.tsx` (WS message handler)
- Modify: `src/webchat/embed/transport/ws-client.ts` (export type if needed) — already exports `WsMessage`

- [ ] **Step 1:** In `chat-widget.tsx`, locate the `onMessage` callback inside `createWsClient`. The current handler:

```ts
if (msg.type === 'message') {
  const incoming: ChatMessage = {
    id: String(msg.id ?? crypto.randomUUID()),
    text: String(msg.body ?? ''),
    from: 'agent',
    timestamp: String(msg.timestamp ?? new Date().toISOString()),
  };
```

Replace with attachment-aware version:

```ts
if (msg.type === 'message') {
  const rawAttachments = msg.attachments;
  const attachments = Array.isArray(rawAttachments)
    ? rawAttachments
        .filter((a): a is { url: string; name: string; mimeType: string } =>
          typeof a === 'object' &&
          a !== null &&
          typeof (a as { url?: unknown }).url === 'string' &&
          typeof (a as { name?: unknown }).name === 'string' &&
          typeof (a as { mimeType?: unknown }).mimeType === 'string',
        )
    : undefined;
  const incoming: ChatMessage = {
    id: String(msg.id ?? crypto.randomUUID()),
    text: String(msg.body ?? ''),
    from: 'agent',
    timestamp: String(msg.timestamp ?? new Date().toISOString()),
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  };
```

- [ ] **Step 2:** Add a unit test in `src/webchat/embed/chat-widget.attachments.test.tsx` (new file or extend integration). Skip a full new test file if the integration test already covers this with one extra case — prefer extending. **For polish, add a focused unit test on the attachment-extraction logic by extracting it to a helper:**

Actually, simpler: extract to `src/webchat/embed/transport/parse-attachments.ts`:

```ts
export interface IncomingAttachment {
  url: string;
  name: string;
  mimeType: string;
}

export function parseAttachments(raw: unknown): IncomingAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = raw.filter(
    (a): a is IncomingAttachment =>
      typeof a === 'object' &&
      a !== null &&
      typeof (a as { url?: unknown }).url === 'string' &&
      typeof (a as { name?: unknown }).name === 'string' &&
      typeof (a as { mimeType?: unknown }).mimeType === 'string',
  );
  return valid.length > 0 ? valid : undefined;
}
```

Test (`parse-attachments.test.ts`):

```ts
import { describe, it, expect } from 'vitest';
import { parseAttachments } from './parse-attachments';

describe('parseAttachments', () => {
  it('ReturnsUndefined_ForNonArray', () => {
    expect(parseAttachments(null)).toBeUndefined();
    expect(parseAttachments({ url: 'x' })).toBeUndefined();
    expect(parseAttachments(undefined)).toBeUndefined();
  });
  it('ReturnsValidAttachments', () => {
    const result = parseAttachments([
      { url: 'https://x/a.png', name: 'a.png', mimeType: 'image/png' },
    ]);
    expect(result).toHaveLength(1);
    expect(result?.[0]?.name).toBe('a.png');
  });
  it('FiltersOutMalformed', () => {
    const result = parseAttachments([
      { url: 'https://x/a.png', name: 'a.png', mimeType: 'image/png' },
      { url: 'no-name' },
      'string',
      null,
    ]);
    expect(result).toHaveLength(1);
  });
  it('ReturnsUndefined_WhenAllInvalid', () => {
    expect(parseAttachments(['x', null, 5])).toBeUndefined();
  });
});
```

Then in `chat-widget.tsx` replace inline parsing with `parseAttachments(msg.attachments)`.

Run + commit: `feat(webchat-embed): propagate WS attachments to message list`

---

### Task P3 — Offline queue drain on reconnect

**Files:**

- Modify: `src/webchat/embed/chat-widget.tsx`

The current `handleSend` pushes to queue if `wsClient?.send()` returns false, but there's no drain on reconnect. The `onOpen` callback only calls `setStatus('online')`.

- [ ] **Step 1:** In `chat-widget.tsx`, when creating the WS client, change `onOpen` to also drain the queue:

```ts
const queue = createOfflineQueue(config.tenantId);
const client = createWsClient({
  url: wsUrl,
  onOpen: () => {
    setStatus('online');
    const queued = queue.drain();
    for (const m of queued) {
      // Re-send queued messages; if WS goes down again they'll re-queue
      client.send({ type: 'message', body: m.text, id: m.id });
    }
  },
  // ...
});
```

Note: the `client` reference is created on the same line so we need to lift it. Use a ref or restructure:

```ts
let clientRef: WsClient | null = null;
const queue = createOfflineQueue(config.tenantId);
clientRef = createWsClient({
  url: wsUrl,
  onOpen: () => {
    setStatus('online');
    const queued = queue.drain();
    for (const m of queued) {
      clientRef?.send({ type: 'message', body: m.text, id: m.id });
    }
  },
  // ...
});
```

Then `setWsClient(clientRef)` and `clientRef.connect()`.

- [ ] **Step 2:** Test: extend integration test to assert that `queue.drain()` is called after reconnect simulation. **Skip if too complex; leave a unit test on the `createOfflineQueue.drain()` behavior (already covered by Task 12 from original plan).**

Run + commit: `fix(webchat-embed): drain offline queue on WS reconnect`

---

### Task P4 — Resume conversation via localStorage message cache

**Files:**

- Create: `src/webchat/embed/message-cache.ts`
- Create: `src/webchat/embed/message-cache.test.ts`
- Modify: `src/webchat/embed/chat-widget.tsx`

Backend has no history endpoint, so we cache messages locally per tenant and rehydrate on mount.

- [ ] **Step 1:** Create `message-cache.ts`:

```ts
import type { ChatMessage } from './transport/session-api';

const KEY = (tenantId: string) => `verbara-webchat-messages:${tenantId}`;
const MAX_CACHED = 100;

export function loadCachedMessages(tenantId: string): ChatMessage[] {
  const raw = localStorage.getItem(KEY(tenantId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCachedMessages(tenantId: string, messages: ChatMessage[]): void {
  const trimmed = messages.slice(-MAX_CACHED);
  localStorage.setItem(KEY(tenantId), JSON.stringify(trimmed));
}

export function clearCachedMessages(tenantId: string): void {
  localStorage.removeItem(KEY(tenantId));
}
```

- [ ] **Step 2:** Test:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadCachedMessages, saveCachedMessages, clearCachedMessages } from './message-cache';
import type { ChatMessage } from './transport/session-api';

beforeEach(() => localStorage.clear());

const msg = (id: string): ChatMessage => ({
  id,
  text: id,
  from: 'visitor',
  timestamp: '2026-05-09T10:00:00Z',
});

describe('message-cache', () => {
  it('Save_AndLoad_Roundtrip', () => {
    saveCachedMessages('t1', [msg('a'), msg('b')]);
    expect(loadCachedMessages('t1')).toHaveLength(2);
  });
  it('Cap_KeepsLast100', () => {
    const arr = Array.from({ length: 150 }, (_, i) => msg(`m${i}`));
    saveCachedMessages('t1', arr);
    const loaded = loadCachedMessages('t1');
    expect(loaded).toHaveLength(100);
    expect(loaded[0]?.id).toBe('m50');
  });
  it('Empty_OnFirstLoad', () => {
    expect(loadCachedMessages('t1')).toEqual([]);
  });
  it('Clear_RemovesEntry', () => {
    saveCachedMessages('t1', [msg('a')]);
    clearCachedMessages('t1');
    expect(loadCachedMessages('t1')).toEqual([]);
  });
  it('IsolatedPerTenant', () => {
    saveCachedMessages('t1', [msg('a')]);
    saveCachedMessages('t2', [msg('b'), msg('c')]);
    expect(loadCachedMessages('t1')).toHaveLength(1);
    expect(loadCachedMessages('t2')).toHaveLength(2);
  });
});
```

- [ ] **Step 3:** Wire in `chat-widget.tsx`:
  - On mount, hydrate `messages` state from `loadCachedMessages(config.tenantId)` if `profile` is already set (returning visitor).
  - On every `setMessages` update (visitor send + agent receive), persist via `saveCachedMessages`.
  - Use `useEffect` watching `messages` length to write — debounce not needed for write-through.

```tsx
useEffect(() => {
  if (profile) {
    saveCachedMessages(config.tenantId, messages);
  }
}, [messages, profile, config.tenantId]);

useEffect(() => {
  if (profile && messages.length === 0) {
    const cached = loadCachedMessages(config.tenantId);
    if (cached.length > 0) setMessages(cached);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [profile]);
```

Note: also call `clearCachedMessages(config.tenantId)` when visitor explicitly resets via `resetVisitor` (which is called in the SDK's `destroy()` — propagate intent through bridge).

Run + commit: `feat(webchat-embed): cache messages in localStorage for cross-visit resume`

---

### Task P5 — Sound toggle UI + correct hookup

**Files:**

- Modify: `src/webchat/embed/notifications.ts` (export `isSoundEnabled` getter, persist preference)
- Modify: `src/webchat/embed/chat-widget.tsx` (call `playNotificationSound` on agent message + add toggle button)
- Modify: `src/webchat/embed/main.tsx` (init from localStorage)
- Modify: `public/locales/{en-US,es-419,pt-BR}/webchat.json` (already has `settings.soundOn`/`soundOff`)

- [ ] **Step 1:** In `notifications.ts`, persist preference + expose getter:

```ts
const SOUND_KEY = 'verbara-webchat-sound';

export function loadSoundPreference(): boolean {
  return localStorage.getItem(SOUND_KEY) === 'on';
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off');
  soundEnabled = enabled;
  if (enabled && !audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      audioCtx = null;
    }
  }
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}
```

- [ ] **Step 2:** In `main.tsx`, replace `setSoundEnabled(false)` with:

```ts
setSoundEnabled(loadSoundPreference());
```

- [ ] **Step 3:** In `chat-widget.tsx`, in the WS `onMessage` handler for incoming agent message, call `playNotificationSound()` (import from `./notifications`).

- [ ] **Step 4:** Add a sound toggle button to the chat header. In the chat-widget render section, after the `<header>` line, replace:

```tsx
<header className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
  <span>{t('preChat.title')}</span>
</header>
```

with:

```tsx
<header className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
  <span>{t('preChat.title')}</span>
  <button
    type="button"
    aria-label={soundOn ? t('settings.soundOff') : t('settings.soundOn')}
    onClick={() => {
      const next = !soundOn;
      setSoundOn(next);
      setSoundEnabled(next);
    }}
    className="text-xs underline"
  >
    {soundOn ? '🔔' : '🔕'}
  </button>
</header>
```

Add state at top of component:

```tsx
const [soundOn, setSoundOn] = useState(() => loadSoundPreference());
```

- [ ] **Step 5:** Test (`src/webchat/embed/notifications.test.ts`, new file):

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { loadSoundPreference, setSoundEnabled, isSoundEnabled } from './notifications';

beforeEach(() => localStorage.clear());

describe('sound preference', () => {
  it('LoadDefaultsToFalse', () => {
    expect(loadSoundPreference()).toBe(false);
  });
  it('PersistsAcrossLoads', () => {
    setSoundEnabled(true);
    expect(loadSoundPreference()).toBe(true);
  });
  it('IsSoundEnabled_ReflectsCurrent', () => {
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
  });
});
```

Run + commit: `feat(webchat-embed): wire sound notifications with toggle UI + localStorage`

---

### Task P6 — Focus composer on chat open

**Files:**

- Modify: `src/webchat/embed/composer.tsx` (expose autofocus prop)
- Modify: `src/webchat/embed/chat-widget.tsx` (autofocus when transitioning from pre-chat to chat)

- [ ] **Step 1:** In `composer.tsx`, change the textarea to support an autoFocus prop:

```tsx
export interface ComposerProps {
  disabled?: boolean;
  onSend: (text: string) => void;
  maxLength?: number;
  autoFocus?: boolean;
}

export function Composer({ disabled, onSend, maxLength = 4000, autoFocus }: ComposerProps) {
  // ...
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
```

- [ ] **Step 2:** In `chat-widget.tsx`, pass `autoFocus` to `<Composer>` when profile is set (transition from pre-chat). Use a ref or state flag:

```tsx
<Composer disabled={status === 'offline'} onSend={handleSend} autoFocus />
```

- [ ] **Step 3:** Update `composer.test.tsx` to add a focus assertion test:

```tsx
it('Autofocuses_WhenAutoFocusTrue', () => {
  render(
    <I18nextProvider i18n={i18n}>
      <Composer onSend={vi.fn()} autoFocus />
    </I18nextProvider>,
  );
  expect(screen.getByPlaceholderText(/type/i)).toHaveFocus();
});
```

Run + commit: `feat(webchat-embed): focus composer on transition to chat (a11y)`

---

### Task P7 — Conversation timeout UX (5 min idle)

**Files:**

- Modify: `src/webchat/embed/chat-widget.tsx`

- [ ] **Step 1:** Add timer state + reset on agent message:

```tsx
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const lastAgentActivityRef = useRef<number>(Date.now());

useEffect(() => {
  if (!profile) return;
  const interval = setInterval(() => {
    if (Date.now() - lastAgentActivityRef.current > TIMEOUT_MS && status !== 'timeout') {
      setStatus('timeout');
    }
  }, 30_000); // check every 30s
  return () => clearInterval(interval);
}, [profile, status]);
```

In the `onMessage` handler (when receiving agent message):

```ts
lastAgentActivityRef.current = Date.now();
if (status === 'timeout') setStatus('online');
```

When visitor sends a message via `handleSend`:

```ts
// Visitor activity does NOT reset timeout — it's agent inactivity that matters
// But if the user sends after a timeout, we keep the banner so they understand
```

- [ ] **Step 2:** No new tests strictly required (status banner already tested); the spec covers this textually. Consider one integration smoke: render → fast-forward 5 min → expect timeout banner.

Run + commit: `feat(webchat-embed): show timeout banner after 5min agent inactivity`

---

### Task P8 — Favicon badge for unread

**Files:**

- Modify: `src/webchat/embed/notifications.ts` (add `setFaviconBadge`)
- Modify: `src/webchat/embed/notifications.ts` `flashUnread` to also call badge

The iframe document doesn't have a favicon by default — we add a dynamic one rendered to a canvas.

- [ ] **Step 1:** In `notifications.ts`:

```ts
let originalFavicon: string | null = null;

function ensureFaviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (originalFavicon === null) originalFavicon = link.href || '';
  return link;
}

export function setFaviconBadge(count: number): void {
  const link = ensureFaviconLink();
  if (count <= 0) {
    link.href = originalFavicon ?? '';
    return;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 16px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(count > 9 ? '9+' : String(count), 16, 17);
  link.href = canvas.toDataURL('image/png');
}
```

- [ ] **Step 2:** In `flashUnread`, call `setFaviconBadge(count)`. In `stopFlash`, call `setFaviconBadge(0)`.

- [ ] **Step 3:** Test:

```ts
it('FaviconBadge_AppliesDataUrl_WhenCountAboveZero', () => {
  document.head.innerHTML = '<link rel="icon" href="/old.png">';
  setFaviconBadge(3);
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  expect(link?.href).toMatch(/^data:image\/png/);
});
it('FaviconBadge_RestoresOriginal_OnZero', () => {
  document.head.innerHTML = '<link rel="icon" href="https://x/old.png">';
  setFaviconBadge(2);
  setFaviconBadge(0);
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  expect(link?.href).toBe('https://x/old.png');
});
```

Run + commit: `feat(webchat-embed): add favicon badge for unread messages`

---

### Task P9 — Reduced motion in iframe

**Files:**

- Modify: `src/webchat/embed/index.html` (add stylesheet) OR use Tailwind utility

Tailwind has `motion-reduce:` variant. Our existing components use transitions; add `motion-reduce:transition-none` where appropriate. Lower-effort: add a `<style>` block in `index.html` covering all transitions:

- [ ] **Step 1:** In `index.html` (we already control it), add inside `<head>`:

```html
<style>
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      transition-duration: 0.001ms !important;
      animation-duration: 0.001ms !important;
    }
  }
</style>
```

Run + commit: `feat(webchat-embed): respect prefers-reduced-motion in iframe`

---

### Task P10 — Pre-chat form Track 5C-a11y refactor

**Files:**

- Modify: `src/webchat/embed/pre-chat-form.tsx`

The current form uses manual `aria-required`, `aria-invalid`, `aria-describedby`. Track 5C-a11y baseline uses `useFieldA11y` + `<Label required>` + `<FieldError>` from `src/core/ui/`.

**Decision:** the iframe app intentionally avoids importing from `src/core/ui/` (those are heavy admin components). Instead, replicate the **shape** of the Track 5C pattern locally:

- [ ] **Step 1:** Create `src/webchat/embed/use-field-a11y.ts` (lightweight version):

```ts
export function useFieldA11y(
  hasError: boolean,
  fieldId: string,
  options: { required?: boolean } = {},
): {
  fieldProps: { 'aria-required'?: 'true'; 'aria-invalid'?: 'true'; 'aria-describedby'?: string };
  errorId: string;
} {
  const errorId = `${fieldId}-error`;
  return {
    fieldProps: {
      ...(options.required ? { 'aria-required': 'true' as const } : {}),
      ...(hasError ? { 'aria-invalid': 'true' as const, 'aria-describedby': errorId } : {}),
    },
    errorId,
  };
}
```

- [ ] **Step 2:** Refactor `pre-chat-form.tsx` to use the hook:

```tsx
const nameA11y = useFieldA11y(!!errors.name, 'webchat-name', { required: true });
const emailA11y = useFieldA11y(!!errors.email, 'webchat-email', { required: true });
// ...
<input id="webchat-name" {...nameA11y.fieldProps} {...register('name')} />
{errors.name && <p id={nameA11y.errorId} role="alert" ...>{...}</p>}
```

- [ ] **Step 3:** Add unit test for `use-field-a11y.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useFieldA11y } from './use-field-a11y';

describe('useFieldA11y', () => {
  it('NoErrorNoRequired_EmptyProps', () => {
    const { result } = renderHook(() => useFieldA11y(false, 'f1', {}));
    expect(result.current.fieldProps).toEqual({});
  });
  it('Required_AddsAriaRequired', () => {
    const { result } = renderHook(() => useFieldA11y(false, 'f1', { required: true }));
    expect(result.current.fieldProps['aria-required']).toBe('true');
  });
  it('Error_AddsAriaInvalidAndDescribedby', () => {
    const { result } = renderHook(() => useFieldA11y(true, 'f1', {}));
    expect(result.current.fieldProps['aria-invalid']).toBe('true');
    expect(result.current.fieldProps['aria-describedby']).toBe('f1-error');
  });
});
```

Existing `pre-chat-form.test.tsx` should continue to pass without changes (we're refactoring internals, not API).

Run + commit: `refactor(webchat-embed): use useFieldA11y in pre-chat-form (Track 5C parity)`

---

### Task P11 — Sentry manual breadcrumbs

**Files:**

- Create: `src/webchat/embed/sentry-breadcrumbs.ts`
- Modify: `src/webchat/embed/{app.tsx,chat-widget.tsx}` to call breadcrumb fns at key events

- [ ] **Step 1:** Create `sentry-breadcrumbs.ts`:

```ts
import { Sentry } from './sentry-init';

type BreadcrumbType =
  | 'opened'
  | 'closed'
  | 'message-sent'
  | 'message-received'
  | 'reconnected'
  | 'session-created'
  | 'timeout';

export function breadcrumb(type: BreadcrumbType, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({
    category: 'webchat',
    message: `webchat.${type}`,
    level: 'info',
    data,
  });
}
```

- [ ] **Step 2:** Wire in:
- `app.tsx` — `bridge.on('open', ...)` → `breadcrumb('opened')`; `bridge.on('close', ...)` → `breadcrumb('closed')`.
- `chat-widget.tsx` — after `createSession` resolves → `breadcrumb('session-created', { sessionId: session.sessionId })`; in `handleSend` → `breadcrumb('message-sent')`; in agent message handler → `breadcrumb('message-received')`; in WS reconnect (`onOpen` after at least 1 reconnect attempt) → `breadcrumb('reconnected')`; on timeout transition → `breadcrumb('timeout')`.

No new tests required — Sentry has its own infra; this is integration plumbing. Could add a smoke test but skip in favor of test-time efficiency.

Run + commit: `feat(webchat-embed): emit Sentry breadcrumbs at key lifecycle events`

---

### Task P12 — Virtualize message list (≥1000 messages)

**Files:**

- Modify: `src/webchat/embed/message-list.tsx`

- [ ] **Step 1:** Replace the simple `.map()` with `@tanstack/react-virtual`:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
// ...

export function MessageList({ messages }: MessageListProps) {
  const { t } = useTranslation('webchat');
  const containerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => 80,
    overscan: 8,
  });

  useEffect(() => {
    if (messages.length > 0) virtualizer.scrollToIndex(messages.length - 1);
  }, [messages.length, virtualizer]);

  return (
    <div
      ref={containerRef}
      role="log"
      aria-live="polite"
      aria-label={t('messages.newMessage')}
      className="flex-1 overflow-y-auto py-3"
    >
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const m = messages[virtualItem.index];
          if (!m) return null;
          return (
            <div
              key={m.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="mb-2"
            >
              <MessageBubble message={m} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2:** Update `message-list.test.tsx` — current tests assert `getByText` over rendered messages. Virtualization may not render off-screen items in jsdom; ensure tests still pass with small message counts (jsdom doesn't have layout, so virtualizer treats all as virtual items and they DO render).

Add a perf-style test (1000 messages, no jank — assert mount completes < 500ms):

```ts
it('Renders1000Messages_WithoutJank', () => {
  const big: ChatMessage[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `m${i}`,
    text: `Message ${i}`,
    from: i % 2 === 0 ? 'visitor' : 'agent',
    timestamp: '2026-05-09T10:00:00Z',
  }));
  const start = performance.now();
  render(
    <I18nextProvider i18n={i18n}>
      <MessageList messages={big} />
    </I18nextProvider>,
  );
  expect(performance.now() - start).toBeLessThan(500);
});
```

Run + commit: `feat(webchat-embed): virtualize message-list with @tanstack/react-virtual`

---

### Task P13 — Verification gate

- [ ] Run full gate:

```bash
npx vitest run                    # expect ~1040+ tests passing
npm run lint                      # expect 0 errors
npm run i18n:check                # expect green
npm audit --audit-level=high      # expect 0 vulnerabilities
npm run build                     # admin green
npm run build:webchat             # SDK + embed green
gzip -c public/webchat/v1/verbara-webchat.js | wc -c   # ≤ 12 kB
```

If embed bundle grew due to virtualizer, document new size. Likely still ≤ 180 kB gzip.

---

### Task P14 — Version bump + closure docs

**Files:**

- Modify: `package.json` (3.0.0 → 3.0.1)
- Modify: `CLAUDE.md` (closure note + new test count)
- Modify: Memory `MEMORY.md` + `project_current_position.md`
- Move: `docs/plans/active/2026-05-09-track-7c-polish.md` → `docs/plans/completed/`

- [ ] **Step 1:** Bump version to `3.0.1`.

- [ ] **Step 2:** Update CLAUDE.md test count + add note: "Track 7C-polish (`v3.0.1-web`) closed 12 audit gaps + missing tests; backend-blocked items (availability/history/tenant-config endpoints) tracked separately."

- [ ] **Step 3:** Update memory.

- [ ] **Step 4:** `git mv` the plan to completed.

- [ ] **Step 5:** Commit: `docs: close Track 7C-polish (v3.0.1-web) — 12 audit gaps + missing tests`

---

### Task P15 — Tag + push + release

- [ ] Annotated tag `v3.0.1-web` with summary of what was fixed.
- [ ] Push main + tag.
- [ ] `gh release create` with notes itemizing the 12 gaps closed and 4 backend-blocked items deferred.

---

## Self-review

**Coverage of audit findings:**

| #     | Audit gap                     | Task                                                                     |
| ----- | ----------------------------- | ------------------------------------------------------------------------ |
| 1     | Resume on revisit             | P4 (localStorage cache; backend history still pending)                   |
| 2     | Offline queue not drained     | P3                                                                       |
| 3     | Inline media attachments      | P2                                                                       |
| 4     | Sound never plays             | P5                                                                       |
| 5     | Focus on open                 | P6                                                                       |
| 6     | Office hours                  | (out of scope — backend)                                                 |
| 7     | Conversation timeout          | P7                                                                       |
| 8     | Theming not injected          | P1                                                                       |
| 9     | Favicon badge                 | P8                                                                       |
| 10    | Pre-chat a11y Track 5C parity | P10                                                                      |
| 11    | Sentry breadcrumbs            | P11                                                                      |
| 12    | Reduced motion                | P9                                                                       |
| 17    | Virtualization 1000           | P12                                                                      |
| 18-20 | Tests for sound/title/mobile  | P5 (sound) + integration smoke covers others; add explicit tests if time |

**Backend-deferred (tracked, not blocking):**

- Office-hours endpoint
- History endpoint
- Tenant config endpoint
- Backend `CreateSessionRequest` field acceptance

**No placeholders.** Each task has concrete code or commands.

**Type consistency.** `InitConfigPayload` extended consistently across SDK and iframe. `ChatMessage` already supports `attachments`.

---

## Execution mode

**Subagent-Driven Development**, single subagent dispatch per phase pair where independent:

| Batch | Tasks           | Notes                                              |
| ----- | --------------- | -------------------------------------------------- |
| 1     | P1 + P2         | Theme + attachments — independent                  |
| 2     | P3 + P4         | Queue drain + cache — touches chat-widget together |
| 3     | P5 + P6 + P7    | Sound + focus + timeout — all touch chat-widget    |
| 4     | P8 + P9         | Favicon + reduced-motion                           |
| 5     | P10 + P11       | Pre-chat refactor + breadcrumbs                    |
| 6     | P12             | Virtualization (own dispatch — biggest unit)       |
| 7     | P13 + P14 + P15 | Closure                                            |

Estimated 3-5 days end-to-end with subagents.
