# Track 3A — lint-cleanup-2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all 131 ESLint problems (116 errors + 15 warnings → 0) and make lint a blocking CI gate.

**Architecture:** Fix errors by category in dependency order — config/infrastructure first (eslint config, globalIgnores), then mechanical bulk fixes (dead exports, as-any removal), then case-by-case refactors (React Compiler violations, incompatible-library warnings). Final step flips lint to blocking in CI.

**Tech Stack:** ESLint 9, TypeScript 5.9, React 19, React Hook Form 7.72, TanStack Table 8.21, Vite 8

---

## Phase A — Foundation (eslint config + dead code removal)

Mechanical changes that eliminate the majority of errors without touching component logic.

### Task 1: ESLint config — globalIgnores + router override + cleanup

**Files:**

- Modify: `eslint.config.js`

- [ ] **Step 1: Update eslint.config.js**

```js
// Replace:
globalIgnores(['dist']),

// With:
globalIgnores(['dist', 'coverage']),
```

Add router override after the E2E override block:

```js
{
  // router.tsx is routing infrastructure (lazy() declarations + createBrowserRouter
  // config), not a React component — the refresh rule is semantically irrelevant.
  files: ['src/router.tsx'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
},
```

Remove the deferred-work comment block (lines 8-12):

```js
// DELETE these lines:
// Deferred to track "lint-cleanup-2" (separate plan):
//   - 92x react-refresh/only-export-components (barrel-export refactor)
//   - 39x @typescript-eslint/no-explicit-any in src/ (typing audit)
//   - 8x react-hooks/incompatible-library (third-party compat)
//   - 1x react-hooks/purity, 1x react-hooks/immutability (case-by-case)
```

- [ ] **Step 2: Verify reduction**

Run: `npx eslint . 2>&1 | tail -3`
Expected: error count drops from 116 to 31 (85 router + 6 coverage warnings eliminated = 91 less)

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "refactor(lint): add coverage to globalIgnores + router.tsx override"
```

### Task 2: Remove dead CVA variant exports

**Files:**

- Modify: `src/core/ui/badge.tsx`
- Modify: `src/core/ui/button.tsx`
- Modify: `src/core/ui/tabs.tsx`

- [ ] **Step 1: badge.tsx — remove badgeVariants from export**

```tsx
// Replace line 52:
export { Badge, badgeVariants };

// With:
export { Badge };
```

- [ ] **Step 2: button.tsx — remove buttonVariants from export**

```tsx
// Replace line 58:
export { Button, buttonVariants };

// With:
export { Button };
```

- [ ] **Step 3: tabs.tsx — remove tabsListVariants from export**

```tsx
// Replace line 80:
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };

// With:
export { Tabs, TabsList, TabsTrigger, TabsContent };
```

- [ ] **Step 4: Verify no consumer breaks**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors (no external consumer imports these variants)

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/badge.tsx src/core/ui/button.tsx src/core/ui/tabs.tsx
git commit -m "refactor(ui): remove dead CVA variant exports from badge/button/tabs"
```

### Task 3: Extract channel domain logic to channel-fields.ts

**Files:**

- Create: `src/admin/channels/channel-fields.ts`
- Modify: `src/admin/channels/channel-config-form.tsx`
- Modify: `src/admin/setup/steps/channel-step.tsx`

- [ ] **Step 1: Create channel-fields.ts**

Create `src/admin/channels/channel-fields.ts` with the extracted content:

```ts
import { z } from 'zod';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'password';
}

export const channelFields: Record<string, FieldDef[]> = {
  whatsapp: [
    { key: 'ApiToken', label: 'Business API Token', type: 'password' },
    { key: 'PhoneNumber', label: 'Phone Number', type: 'text' },
    { key: 'WebhookVerifyToken', label: 'Webhook Verify Token', type: 'text' },
  ],
  sms: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'SenderNumber', label: 'Sender Number', type: 'text' },
  ],
  email: [
    { key: 'SmtpHost', label: 'SMTP Host', type: 'text' },
    { key: 'SmtpPort', label: 'SMTP Port', type: 'text' },
    { key: 'SmtpUser', label: 'SMTP Username', type: 'text' },
    { key: 'SmtpPassword', label: 'SMTP Password', type: 'password' },
    { key: 'FromAddress', label: 'From Address', type: 'text' },
  ],
  webchat: [
    { key: 'WidgetKey', label: 'Widget Key', type: 'text' },
    { key: 'AllowedOrigins', label: 'Allowed Origins', type: 'text' },
  ],
  voice: [
    { key: 'TrunkHost', label: 'SIP Trunk Host', type: 'text' },
    { key: 'TrunkUser', label: 'Trunk Username', type: 'text' },
    { key: 'TrunkPassword', label: 'Trunk Password', type: 'password' },
    { key: 'CallerIdNumber', label: 'Caller ID Number', type: 'text' },
  ],
  messenger: [
    { key: 'PageAccessToken', label: 'Page Access Token', type: 'password' },
    { key: 'AppSecret', label: 'App Secret', type: 'password' },
    { key: 'VerifyToken', label: 'Verify Token', type: 'text' },
  ],
  instagram: [
    { key: 'AccessToken', label: 'Access Token', type: 'password' },
    { key: 'AppSecret', label: 'App Secret', type: 'password' },
  ],
  telegram: [
    { key: 'BotToken', label: 'Bot Token', type: 'password' },
    { key: 'WebhookUrl', label: 'Webhook URL', type: 'text' },
  ],
  twitter: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'BearerToken', label: 'Bearer Token', type: 'password' },
  ],
  video: [
    { key: 'ApiKey', label: 'API Key', type: 'password' },
    { key: 'ApiSecret', label: 'API Secret', type: 'password' },
    { key: 'RoomPrefix', label: 'Room Prefix', type: 'text' },
  ],
  rcs: [
    { key: 'AgentId', label: 'Agent ID', type: 'text' },
    { key: 'ServiceAccountKey', label: 'Service Account Key', type: 'password' },
  ],
};

export function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodType> = { isActive: z.boolean() };
  for (const field of fields) {
    shape[field.key] = z.string().min(1, 'admin:channels.validation.fieldRequired');
  }
  return z.object(shape);
}

export function buildDefaults(fields: FieldDef[]): Record<string, string | boolean> {
  const defaults: Record<string, string | boolean> = { isActive: false };
  for (const field of fields) {
    defaults[field.key] = '';
  }
  return defaults;
}
```

- [ ] **Step 2: Update channel-config-form.tsx imports**

Remove the `FieldDef` interface, `channelFields` constant, `buildSchema` function, and `buildDefaults` function declarations. Remove their `export` keywords. Replace with an import from the new file:

```tsx
// Add at top (after existing imports):
import { channelFields, buildSchema, buildDefaults } from './channel-fields';
```

Remove lines 21-90 (the `FieldDef` interface, `channelFields` object, and `buildSchema` function) and lines 197-203 (the `buildDefaults` function) from the component file.

- [ ] **Step 3: Update channel-step.tsx imports**

Change the import path from:

```tsx
import {
  channelFields,
  buildSchema,
  buildDefaults,
  type FieldDef,
} from '../channels/channel-config-form';
```

to:

```tsx
import {
  channelFields,
  buildSchema,
  buildDefaults,
  type FieldDef,
} from '../../admin/channels/channel-fields';
```

Note: verify the actual import path used in channel-step.tsx and adjust the relative path accordingly.

- [ ] **Step 4: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm run test -- --run --reporter=dot 2>&1 | tail -5`
Expected: 0 type errors, 800/800 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/admin/channels/channel-fields.ts src/admin/channels/channel-config-form.tsx src/admin/setup/steps/channel-step.tsx
git commit -m "refactor(channels): extract channel-fields domain logic to dedicated module"
```

### Task 4: Remove stale exports and directives

**Files:**

- Modify: `src/admin/license/license-page.tsx`
- Modify: `src/admin/cases/cases-page.tsx`

- [ ] **Step 1: license-page.tsx — remove export from parseGraceDuration**

```tsx
// Replace line 70:
export function parseGraceDuration(value: string | null | undefined): number | null {

// With:
function parseGraceDuration(value: string | null | undefined): number | null {
```

Also remove the comment on line 69 ("Exported for the StatCard test harness.") since it's now inaccurate.

- [ ] **Step 2: cases-page.tsx — remove stale eslint-disable directive**

```tsx
// Remove line 132:
/* eslint-disable react-hooks/preserve-manual-memoization */
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/admin/license/license-page.tsx src/admin/cases/cases-page.tsx
git commit -m "refactor: remove stale export (license) and eslint-disable (cases)"
```

---

## Phase B — Critical fixes (no-explicit-any + React Compiler)

These require understanding each call site. Individual focused work.

### Task 5: Remove zodResolver `as any` casts (13 files)

**Files:**

- Modify: `src/admin/billing/quotas-page.tsx`
- Modify: `src/admin/billing/rate-card-form.tsx`
- Modify: `src/admin/bots/bot-form.tsx`
- Modify: `src/admin/cluster/cluster-page.tsx`
- Modify: `src/admin/gdpr/retention-policy-section.tsx`
- Modify: `src/admin/realtime/profile-form.tsx`
- Modify: `src/admin/reports/report-form.tsx`
- Modify: `src/admin/routes/route-form.tsx`
- Modify: `src/admin/surveys/survey-form.tsx`
- Modify: `src/admin/tenants/tenants-page.tsx`
- Modify: `src/admin/trunks/trunk-form.tsx`

- [ ] **Step 1: Remove `as any` from all zodResolver calls**

In each file, find the pattern `zodResolver(someSchema) as any` and replace with just `zodResolver(someSchema)`. The explicit generic on `useForm<FormValues>` can stay — with `@hookform/resolvers` 4.x, the types resolve correctly.

Search pattern: `zodResolver(` ... `) as any`
Replace: remove ` as any`

Files and approximate lines:

- `quotas-page.tsx:128` — `zodResolver(quotaSchema) as any` → `zodResolver(quotaSchema)`
- `rate-card-form.tsx:94` — `zodResolver(rateCardSchema) as any` → `zodResolver(rateCardSchema)`
- `bot-form.tsx:63` — `zodResolver(botSchema) as any` → `zodResolver(botSchema)`
- `cluster-page.tsx:137,230,296` — three instances
- `retention-policy-section.tsx:69` — `zodResolver(retentionSchema) as any` → `zodResolver(retentionSchema)`
- `profile-form.tsx:66` — `zodResolver(profileSchema) as any` → `zodResolver(profileSchema)`
- `report-form.tsx:95` — `zodResolver(reportSchema) as any` → `zodResolver(reportSchema)`
- `route-form.tsx:60` — `zodResolver(routeSchema) as any` → `zodResolver(routeSchema)`
- `survey-form.tsx:110` — `zodResolver(surveySchema) as any` → `zodResolver(surveySchema)`
- `tenants-page.tsx:105` — `zodResolver(createSchema) as any` → `zodResolver(createSchema)`
- `trunk-form.tsx:58` — `zodResolver(trunkSchema) as any` → `zodResolver(trunkSchema)`

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors. If any file fails, use `as Resolver<FormValues>` with `import { type Resolver } from 'react-hook-form'` instead of `as any`.

- [ ] **Step 3: Run tests**

Run: `npm run test -- --run --reporter=dot 2>&1 | tail -5`
Expected: 800/800 pass

- [ ] **Step 4: Commit**

```bash
git add src/admin/billing/quotas-page.tsx src/admin/billing/rate-card-form.tsx src/admin/bots/bot-form.tsx src/admin/cluster/cluster-page.tsx src/admin/gdpr/retention-policy-section.tsx src/admin/realtime/profile-form.tsx src/admin/reports/report-form.tsx src/admin/routes/route-form.tsx src/admin/surveys/survey-form.tsx src/admin/tenants/tenants-page.tsx src/admin/trunks/trunk-form.tsx
git commit -m "fix(types): remove zodResolver as-any casts across 11 form files"
```

### Task 6: Type RetentionFieldRowProps properly

**Files:**

- Modify: `src/admin/gdpr/retention-policy-section.tsx`

- [ ] **Step 1: Replace `any` types with RHF generics**

Add import at top:

```tsx
import {
  useForm,
  Controller,
  type Control,
  type UseFormWatch,
  type UseFormSetValue,
} from 'react-hook-form';
```

Replace the interface (around line 137-142):

```tsx
// Replace:
interface RetentionFieldRowProps {
  config: RetentionFieldConfig;
  control: any;
  watch: any;
  setValue: any;
}

// With:
interface RetentionFieldRowProps {
  config: RetentionFieldConfig;
  control: Control<RetentionFormValues>;
  watch: UseFormWatch<RetentionFormValues>;
  setValue: UseFormSetValue<RetentionFormValues>;
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "retention" | head -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/admin/gdpr/retention-policy-section.tsx
git commit -m "fix(types): replace any with typed RHF generics in RetentionFieldRowProps"
```

### Task 7: Fix kiosk-wrapper — derive state from URL

**Files:**

- Modify: `src/operations/wallboard/kiosk-wrapper.tsx`

- [ ] **Step 1: Remove isKiosk state, derive from searchParams**

Replace the entire component with:

```tsx
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Maximize2 } from 'lucide-react';

interface KioskWrapperProps {
  children: React.ReactNode;
}

export function KioskWrapper({ children }: KioskWrapperProps) {
  const { t } = useTranslation('operations');
  const [searchParams, setSearchParams] = useSearchParams();
  const isKiosk = searchParams.get('kiosk') === 'true';

  const exitKiosk = useCallback(() => {
    setSearchParams((prev) => {
      prev.delete('kiosk');
      return prev;
    });
  }, [setSearchParams]);

  const enterKiosk = useCallback(() => {
    setSearchParams((prev) => {
      prev.set('kiosk', 'true');
      return prev;
    });
  }, [setSearchParams]);

  if (isKiosk) {
    return (
      <div
        className="fixed inset-0 z-50 overflow-auto bg-slate-950 p-6"
        onKeyDown={(e) => {
          if (e.key === 'Escape') exitKiosk();
        }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">{t('wallboard.title')}</h1>
            <button
              type="button"
              onClick={exitKiosk}
              className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
            >
              {t('wallboard.kiosk_exit')}
            </button>
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('wallboard.title')}
        </h1>
        <button
          type="button"
          onClick={enterKiosk}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <Maximize2 className="h-4 w-4" />
          {t('wallboard.kiosk_enter')}
        </button>
      </div>
      {children}
    </div>
  );
}
```

Key changes: removed `useState`, removed `useEffect` syncing URL→state, removed `useEffect` for keydown (moved to `onKeyDown` on the container div). The `isKiosk` value is now derived directly from `searchParams`.

Note: The `onKeyDown` on the div requires the element to be focusable. If ESC doesn't work after this change, add a `useEffect` with `document.addEventListener('keydown', ...)` back — but without the `setIsKiosk` setState call (just call `exitKiosk()` directly). The compiler error was about `setIsKiosk(...)` inside the effect, not about the event listener itself.

- [ ] **Step 2: Verify lint + typecheck**

Run: `npx eslint src/operations/wallboard/kiosk-wrapper.tsx && npx tsc --noEmit 2>&1 | grep kiosk`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/operations/wallboard/kiosk-wrapper.tsx
git commit -m "refactor(wallboard): derive kiosk state from URL params instead of syncing via effect"
```

### Task 8: Fix auth-sessions-page — move timeAgo outside component

**Files:**

- Modify: `src/admin/system/auth-sessions-page.tsx`

- [ ] **Step 1: Extract timeAgo and formatUserAgent above the component**

Move both helper functions outside the component body. For `timeAgo`, pass `t` and `formatDateShort` as parameters:

```tsx
function formatUserAgent(ua: string | null): string {
  if (!ua) return '-';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return ua.slice(0, 30);
}

function timeAgo(
  dateStr: string,
  now: number,
  t: (key: string, opts?: Record<string, unknown>) => string,
  formatDateShort: (d: string) => string,
): string {
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('admin:auth.just_now', { defaultValue: 'Just now' });
  if (mins < 60) return t('admin:auth.minutes_ago', { defaultValue: '{{count}} min ago', count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('admin:auth.hours_ago', { defaultValue: '{{count}} hr ago', count: hours });
  return formatDateShort(dateStr);
}

export default function AuthSessionsPage() {
  // ...
  const now = useMemo(() => Date.now(), [sessions]);
  // Then in JSX use: timeAgo(session.startedAt, now, t, formatDateShort)
```

Add `useMemo` to the import from React. The `now` value recalculates only when `sessions` data changes (new query result), making it pure relative to the render cycle.

- [ ] **Step 2: Verify lint on that file**

Run: `npx eslint src/admin/system/auth-sessions-page.tsx`
Expected: 0 errors (purity violation gone)

- [ ] **Step 3: Commit**

```bash
git add src/admin/system/auth-sessions-page.tsx
git commit -m "refactor(auth-sessions): extract timeAgo outside component for React Compiler purity"
```

### Task 9: Fix agent-assist-config-page — eliminate setState-in-effect

**Files:**

- Modify: `src/admin/agent-assist/agent-assist-config-page.tsx`

- [ ] **Step 1: Replace useEffect→setState pattern with direct initialization**

The file has two sections (`KeywordRulesSection` and `ComplianceRulesSection`) that each do:

```tsx
const [localRules, setLocalRules] = useState<SomeType[]>([]);
useEffect(() => {
  setLocalRules(rules);
}, [rules]);
```

Replace with initializing state from the query data and using a `key` to reset:

For `KeywordRulesSection` (around line 146-167):

```tsx
// Replace:
const [localRules, setLocalRules] = useState<KeywordRule[]>([]);
// ...
useEffect(() => {
  setLocalRules(rules);
}, [rules]);

// With:
const [localRules, setLocalRules] = useState<KeywordRule[]>(rules);
const prevRulesRef = useRef(rules);
if (prevRulesRef.current !== rules) {
  prevRulesRef.current = rules;
  setLocalRules(rules);
}
```

This uses the "sync external store" pattern that React recommends — updating state during render (before returning JSX) is allowed and doesn't trigger the Compiler error. The effect is eliminated entirely.

Apply the same pattern to `ComplianceRulesSection` (around line 496-498).

Add `useRef` to the React import at the top of the file.

- [ ] **Step 2: Verify lint + tests**

Run: `npx eslint src/admin/agent-assist/agent-assist-config-page.tsx && npm run test -- --run --reporter=dot 2>&1 | tail -3`
Expected: 0 lint errors, tests pass

- [ ] **Step 3: Commit**

```bash
git add src/admin/agent-assist/agent-assist-config-page.tsx
git commit -m "refactor(agent-assist): replace setState-in-effect with render-time sync pattern"
```

### Task 10: Fix queue-form — move reset to event handler

**Files:**

- Modify: `src/admin/queues/queue-form.tsx`

- [ ] **Step 1: Replace effect with onOpenChange handler**

Remove the problematic effect (lines 100-106):

```tsx
// DELETE:
useEffect(() => {
  if (open) {
    reset(defaults);
    setSkillInput('');
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, reset]);
```

Add an `onOpenChange` wrapper that resets on open:

```tsx
const handleOpenChange = (nextOpen: boolean) => {
  if (nextOpen) {
    reset(defaults);
    setSkillInput('');
  }
  onOpenChange(nextOpen);
};
```

Use `handleOpenChange` in the JSX wherever `onOpenChange` is passed to the dialog/sheet.

- [ ] **Step 2: Verify lint**

Run: `npx eslint src/admin/queues/queue-form.tsx`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/admin/queues/queue-form.tsx
git commit -m "refactor(queue-form): move form reset to event handler instead of effect"
```

### Task 11: Fix reply-composer — use key for conversationId reset

**Files:**

- Modify: `src/agent/conversation/reply-composer.tsx`
- Modify: the parent that renders `<ReplyComposer>` (find the consumer)

- [ ] **Step 1: Identify the parent component**

Run: `grep -rn "ReplyComposer" src/ --include="*.tsx" | grep -v "reply-composer.tsx"`

- [ ] **Step 2: Add key prop on ReplyComposer in parent**

In the parent component, add `key={conversationId}`:

```tsx
<ReplyComposer key={conversationId} conversationId={conversationId} contactName={contactName} />
```

- [ ] **Step 3: Remove the effect from reply-composer.tsx**

Remove lines 46-51:

```tsx
// DELETE:
// Restore draft when conversation switches
useEffect(() => {
  setText(draft);
  setCannedOpen(false);
  setAttachments([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [conversationId]);
```

Initialize `text` from `draft` directly:

```tsx
// Replace:
const [text, setText] = useState('');

// With:
const [text, setText] = useState(draft);
```

Since the component remounts on `conversationId` change (via key), `draft` will be the correct value for the new conversation, and `attachments`/`cannedOpen` will reset to their initial values automatically.

- [ ] **Step 4: Verify lint + tests**

Run: `npx eslint src/agent/conversation/reply-composer.tsx && npm run test -- --run --reporter=dot 2>&1 | tail -3`
Expected: 0 lint errors, tests pass

- [ ] **Step 5: Commit**

```bash
git add src/agent/conversation/reply-composer.tsx <parent-file>
git commit -m "refactor(reply-composer): use key prop for conversation reset instead of effect"
```

### Task 12: Fix use-sse — self-referencing useCallback via ref

**Files:**

- Modify: `src/core/hooks/use-sse.ts`

- [ ] **Step 1: Refactor connect to use ref-based self-reference**

Replace the current pattern:

```ts
const connect = useCallback(() => {
  // ...
  source.onerror = () => {
    // ...
    setTimeout(connect, delay); // self-reference
  };
}, [accessToken, queryClient, navigate, t]);

useEffect(() => {
  connect();
  return () => {
    sourceRef.current?.close();
    sourceRef.current = null;
  };
}, [connect]);
```

With:

```ts
const connectRef = useRef<(() => void) | null>(null);

const connect = useCallback(() => {
  if (!accessToken || sourceRef.current) return;

  const url = `/api/v1/events/stream?token=${encodeURIComponent(accessToken)}`;
  const source = new EventSource(url);
  sourceRef.current = source;

  source.onopen = () => {
    reconnectAttemptRef.current = 0;
  };

  // ... all event listeners stay the same ...

  source.onerror = () => {
    source.close();
    sourceRef.current = null;
    queryClient.invalidateQueries({ queryKey: ['notifications'] });

    const attempt = reconnectAttemptRef.current;
    if (attempt >= 10) {
      toast.error(t('toasts.sse.connectionLost'));
      return;
    }
    const delay = Math.min(2000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
    reconnectAttemptRef.current = attempt + 1;
    setTimeout(() => connectRef.current?.(), delay);
  };
}, [accessToken, queryClient, navigate, t]);

connectRef.current = connect;

useEffect(() => {
  connect();
  return () => {
    sourceRef.current?.close();
    sourceRef.current = null;
  };
}, [connect]);
```

The only change is in `source.onerror`: `setTimeout(connect, delay)` becomes `setTimeout(() => connectRef.current?.(), delay)`.

- [ ] **Step 2: Verify lint**

Run: `npx eslint src/core/hooks/use-sse.ts`
Expected: 0 errors (immutability violation gone)

- [ ] **Step 3: Commit**

```bash
git add src/core/hooks/use-sse.ts
git commit -m "refactor(sse): use ref for reconnect self-reference to satisfy React Compiler"
```

---

## Phase C — Integration (incompatible-library warnings + CI flip)

### Task 13: Migrate watch() → useWatch() for inline render usage

**Files:**

- Modify: `src/admin/channels/channel-config-form.tsx`
- Modify: `src/admin/dialer-settings/dialer-settings-page.tsx`
- Modify: `src/admin/reports/report-form.tsx`
- Modify: `src/admin/surveys/survey-form.tsx`
- Modify: `src/admin/system/system-page.tsx`

- [ ] **Step 1: channel-config-form.tsx**

Replace `watch` with `useWatch` for the inline render call:

```tsx
// Add to imports:
import { useForm, useWatch } from 'react-hook-form';

// Remove `watch` from the useForm destructure:
const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({...});

// Replace line 125:
// const isActive = watch('isActive') as boolean;
// With:
const isActive = useWatch({ control, name: 'isActive' }) as boolean;
```

Note: this requires adding `control` to the destructure from `useForm`:

```tsx
const { register, handleSubmit, reset, control, setValue, formState: { errors, isSubmitting } } = useForm({...});
```

- [ ] **Step 2: dialer-settings-page.tsx**

```tsx
// Add useWatch to import
import { useForm, useWatch } from 'react-hook-form';

// Remove `watch` from destructure, add `control`:
const { register, handleSubmit, control, ... } = useForm({...});

// Replace:
// const blendModeEnabled = watch('blendModeEnabled');
// With:
const blendModeEnabled = useWatch({ control, name: 'blendModeEnabled' });
```

- [ ] **Step 3: report-form.tsx**

```tsx
// Same pattern:
// Replace: const schedule = watch('schedule');
// With: const schedule = useWatch({ control, name: 'schedule' });
```

- [ ] **Step 4: survey-form.tsx**

This is more complex — `watch` is called inside a `.map()` with a dynamic field name:

```tsx
const qType = watch(`questions.${index}.type`);
```

Replace with `useWatch` at the field level. Since this is inside a map, extract a sub-component:

```tsx
function QuestionTypeField({
  control,
  index,
}: {
  control: Control<SurveyFormValues>;
  index: number;
}) {
  const qType = useWatch({ control, name: `questions.${index}.type` as const });
  // ... render logic that depends on qType
}
```

If extraction is too complex, use a file-level eslint-disable for this specific warning instead.

- [ ] **Step 5: system-page.tsx**

```tsx
// Replace watch calls in JSX:
// watch('defaultTimezone') → useWatch({ control, name: 'defaultTimezone' })
// watch('defaultLanguage') → useWatch({ control, name: 'defaultLanguage' })
```

- [ ] **Step 6: Verify lint on all 5 files**

Run: `npx eslint src/admin/channels/channel-config-form.tsx src/admin/dialer-settings/dialer-settings-page.tsx src/admin/reports/report-form.tsx src/admin/surveys/survey-form.tsx src/admin/system/system-page.tsx 2>&1 | grep -c "warning\|error"`
Expected: 0

- [ ] **Step 7: Commit**

```bash
git add src/admin/channels/channel-config-form.tsx src/admin/dialer-settings/dialer-settings-page.tsx src/admin/reports/report-form.tsx src/admin/surveys/survey-form.tsx src/admin/system/system-page.tsx
git commit -m "refactor(forms): migrate watch() to useWatch() for React Compiler compatibility"
```

### Task 14: Suppress incompatible-library for subscription patterns + TanStack Table

**Files:**

- Modify: `src/admin/flows/property-panel.tsx`
- Modify: `src/admin/setup/steps/channel-step.tsx`
- Modify: `src/admin/shared/data-table.tsx`

- [ ] **Step 1: property-panel.tsx — add file-level suppress**

Add at top of file (after imports):

```tsx
/* eslint-disable react-hooks/incompatible-library -- RHF watch() subscription pattern has no hook alternative */
```

- [ ] **Step 2: channel-step.tsx — add file-level suppress**

Add at top of file (after imports):

```tsx
/* eslint-disable react-hooks/incompatible-library -- RHF watch() subscription + useFormContext patterns */
```

- [ ] **Step 3: data-table.tsx — add file-level suppress**

Add at top of file (after imports):

```tsx
/* eslint-disable react-hooks/incompatible-library -- TanStack Table useReactTable() internal subscriptions */
```

- [ ] **Step 4: Verify lint**

Run: `npx eslint src/admin/flows/property-panel.tsx src/admin/setup/steps/channel-step.tsx src/admin/shared/data-table.tsx`
Expected: 0 errors, 0 warnings

- [ ] **Step 5: Commit**

```bash
git add src/admin/flows/property-panel.tsx src/admin/setup/steps/channel-step.tsx src/admin/shared/data-table.tsx
git commit -m "refactor(lint): suppress incompatible-library for RHF subscriptions and TanStack Table"
```

### Task 15: Make lint blocking in CI

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Remove continue-on-error and update comments**

In `.github/workflows/ci.yml`:

Replace the header comment (lines 11-12):

```yaml
#   - lint      NON-BLOCKING (continue-on-error) - eslint baseline preserved
#                            until Track 3A clears 111 deferred errors.
```

With:

```yaml
#   - lint      blocking - eslint (0 errors enforced since Track 3A)
```

Replace the job definition (lines 151-157):

```yaml
lint:
  name: lint (non-blocking)
  runs-on: ubuntu-latest
  timeout-minutes: 5
  # Non-blocking until Track 3A (lint-cleanup-2) clears 111 deferred errors.
  # This job runs to surface lint signal in PR checks but does not gate merges.
  continue-on-error: true
```

With:

```yaml
lint:
  name: lint
  runs-on: ubuntu-latest
  timeout-minutes: 5
```

Also update the branch protection comment (line 14):

```yaml
# Branch protection on main requires: build, test, coverage, i18n, audit
```

To:

```yaml
# Branch protection on main requires: build, test, coverage, i18n, audit, lint
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: make lint job blocking (Track 3A complete — 0 errors)"
```

### Task 16: Final verification + version bump

**Files:**

- Modify: `package.json` (version bump)

- [ ] **Step 1: Run full lint**

Run: `npm run lint`
Expected: exits 0 with no output (0 errors, 0 warnings)

- [ ] **Step 2: Run full test suite**

Run: `npm run test -- --run`
Expected: 800/800 pass

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: exits 0, no type errors

- [ ] **Step 4: Bump version to 1.16.0**

In `package.json`, change `"version"` from `"1.15.5"` to `"1.16.0"`.

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore(release): bump version to 1.16.0 (Track 3A lint-cleanup-2 complete)"
```

---

## Verification Checklist

After all tasks complete:

```bash
npm run lint          # 0 errors, 0 warnings
npm run build         # type-check + production build green
npm run test -- --run # 800/800 tests pass
npx eslint . 2>&1 | grep -c "error\|warning"  # 0
```
