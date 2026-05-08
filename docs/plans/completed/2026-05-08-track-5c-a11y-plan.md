# Track 5C-a11y Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the web app to WCAG 2.1 AA compliance by adding three reusable a11y primitives (`<SkipLink>`, `<LiveRegion>`, `<FieldError>`), three hooks (`useFieldA11y`, `useDocumentTitle`, `<html lang>` sync), one centralized form-error wiring pattern, two new dev dependencies (`eslint-plugin-jsx-a11y`, `@axe-core/playwright`), and ~15 targeted edits across components — preventing regressions through CI lint + E2E coverage.

**Architecture:** Two patches. **5C.1 (foundation, `2.0.3`)** ships primitives, hooks, lint plugin, axe-core baseline spec, and foundational fixes (button contrast, html lang, prefers-reduced-motion, skip-link wiring). **5C.2 (application, `2.0.4` with tag `v2.0.4-web`)** applies form helpers to Tier 1 forms (~8), enables aria attributes across 6 components (DataTable, LoadingOverlay, Skeleton, ErrorBoundary, RouteErrorBoundary, Sonner), adds the InboxPanel announcer, and finishes targeted edits.

**Tech Stack:** React 19, TypeScript 6 strict, Vitest 4.1, Playwright, react-hook-form 7, Sonner 2.0.7, `eslint-plugin-jsx-a11y` ^6, `@axe-core/playwright` ^4, Tailwind 4.

**Spec:** [`2026-05-08-track-5c-a11y.md`](2026-05-08-track-5c-a11y.md)

---

## File Structure

| Path                                              | Action           | Responsibility                                          |
| ------------------------------------------------- | ---------------- | ------------------------------------------------------- |
| `package.json`                                    | modify           | add deps + version bumps (2.0.3, 2.0.4)                 |
| `eslint.config.js`                                | modify           | activate `eslint-plugin-jsx-a11y`                       |
| `src/core/ui/skip-link.tsx`                       | create           | visible-on-focus anchor primitive                       |
| `src/core/ui/skip-link.test.tsx`                  | create           | unit tests                                              |
| `src/core/ui/live-region.tsx`                     | create           | aria-live wrapper primitive                             |
| `src/core/ui/live-region.test.tsx`                | create           | unit tests                                              |
| `src/core/ui/field-error.tsx`                     | create           | error renderer with role="alert"                        |
| `src/core/ui/field-error.test.tsx`                | create           | unit tests                                              |
| `src/core/ui/label.tsx`                           | modify           | optional `required` prop renders asterisk + sr-only     |
| `src/core/ui/label.test.tsx`                      | create or modify | required-prop tests                                     |
| `src/core/ui/button.tsx`                          | modify           | disabled style preserves contrast                       |
| `src/core/ui/button.test.tsx`                     | modify           | disabled-contrast tests                                 |
| `src/core/ui/data-table.tsx`                      | modify           | scope="col"; search input aria-label                    |
| `src/core/ui/loading-overlay.tsx`                 | modify           | aria-busy="true"                                        |
| `src/core/ui/skeleton.tsx`                        | modify           | role="status" + aria-busy + sr-only text                |
| `src/core/ui/sonner.tsx`                          | modify           | i18n containerAriaLabel                                 |
| `src/core/hooks/use-field-a11y.ts`                | create           | aria-invalid + aria-describedby + aria-required         |
| `src/core/hooks/use-field-a11y.test.ts`           | create           | unit tests                                              |
| `src/core/hooks/use-document-title.ts`            | create           | sets document.title while mounted                       |
| `src/core/hooks/use-document-title.test.ts`       | create           | unit tests                                              |
| `src/core/i18n/language-switcher.tsx`             | modify           | sync `document.documentElement.lang`                    |
| `src/core/error-boundary.tsx`                     | modify           | role="alert" + autoFocus                                |
| `src/core/ui/route-error-boundary.tsx`            | modify           | role="alert" + autoFocus                                |
| `src/shell/app-shell.tsx`                         | modify           | `<SkipLink>` + `<main id="main-content" tabIndex={-1}>` |
| `src/agent/inbox/inbox-panel.tsx`                 | modify           | `<LiveRegion>` announcer                                |
| `src/admin/routes/routes-page.tsx`                | modify           | drag handle aria-label                                  |
| `src/admin/roles/roles-page.tsx`                  | modify           | div→button                                              |
| `src/core/auth/mfa-verify.tsx`                    | modify           | autoComplete + pattern                                  |
| `src/index.css`                                   | modify           | `@media (prefers-reduced-motion: reduce)` block         |
| `src/pages/admin/admin-layout.tsx`                | modify           | useDocumentTitle                                        |
| `src/pages/agent/agent-layout.tsx`                | modify           | useDocumentTitle                                        |
| `src/pages/analytics/analytics-layout.tsx`        | modify           | useDocumentTitle                                        |
| `src/pages/operations/operations-layout.tsx`      | modify           | useDocumentTitle                                        |
| `public/locales/{en-US,es-419,pt-BR}/common.json` | modify           | a11y keys                                               |
| `tests/e2e/tests/a11y/wcag-baseline.spec.ts`      | create           | axe-core scan of 6 routes                               |
| **Tier 1 forms**                                  | modify           | apply form helpers; verify focus-on-error               |
| `src/core/auth/login-page.tsx`                    | modify           | useFieldA11y + FieldError + Label required              |
| `src/core/auth/forgot-password-page.tsx`          | modify           | same                                                    |
| `src/core/auth/reset-password-page.tsx`           | modify           | same                                                    |
| `src/core/auth/mfa-verify.tsx`                    | modify           | same (in addition to autoComplete)                      |
| `src/admin/users/user-form.tsx`                   | modify           | same                                                    |
| `src/admin/queues/queue-form.tsx`                 | modify           | same                                                    |
| `src/admin/setup/steps/agent-step.tsx`            | modify           | same                                                    |
| `src/admin/security/mfa/mfa-admin-page.tsx`       | modify           | same (MFA setup)                                        |
| **Search/utility inputs**                         | modify           | aria-label additions                                    |
| `src/admin/shared/data-table.tsx` (search)        | modify           | aria-label on search input                              |
| `src/admin/shared/contact-search-panel.tsx`       | modify           | aria-label                                              |
| `src/admin/flows/flow-toolbar.tsx`                | modify           | aria-label                                              |
| `src/admin/system/auth-events-page.tsx`           | modify           | aria-label on filter                                    |
| `src/agent/context/knowledge-tab.tsx`             | modify           | aria-label on search                                    |
| **Heading hierarchy**                             | modify           | per-page during 5C.2 (list discovered)                  |
| `CLAUDE.md`                                       | modify           | reflect Track 5C-a11y closure                           |
| `MEMORY.md` (auto-memory)                         | modify           | mark closed; queue 5C-export next                       |

---

# Patch 5C.1 — Foundation (target: `2.0.3`, no tag)

### Task 1: Add dev dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install dependencies**

```bash
cd /media/Data/Source/Verbara/Verbara.Platform.Web
npm install --save-dev eslint-plugin-jsx-a11y@^6 @axe-core/playwright@^4
```

- [ ] **Step 2: Verify install**

```bash
npm ls eslint-plugin-jsx-a11y @axe-core/playwright
```

Expected: prints both packages with no `UNMET DEPENDENCY` warnings.

- [ ] **Step 3: Verify build still passes**

```bash
npm run build
```

Expected: typecheck + Vite bundle succeed, no warnings.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add eslint-plugin-jsx-a11y and @axe-core/playwright"
```

---

### Task 2: Activate `jsx-a11y` plugin in warn mode + capture baseline violations

**Files:**

- Modify: `eslint.config.js`

- [ ] **Step 1: Edit eslint.config.js to add jsx-a11y as warn-level**

Add to the imports at top:

```js
import jsxA11y from 'eslint-plugin-jsx-a11y';
```

In the main `files: ['**/*.{ts,tsx}']` config block, after `extends`, add a `plugins` field and merge the plugin's `recommended` rules at WARN level:

```js
    plugins: { 'jsx-a11y': jsxA11y },
    rules: {
      // ... existing rules ...
      // jsx-a11y recommended preset, demoted to warn for the rollout.
      // Promoted to error in Task 4 once violations are addressed.
      ...Object.fromEntries(
        Object.entries(jsxA11y.configs.recommended.rules).map(([rule, level]) => [
          rule,
          level === 'error' || level === 2 ? 'warn' : level,
        ]),
      ),
    },
```

- [ ] **Step 2: Run lint to capture violation list**

```bash
npm run lint 2>&1 | tee /tmp/jsx-a11y-baseline.txt
```

Expected: Lint runs to completion; warnings listed but no errors yet. Note total warning count.

- [ ] **Step 3: Commit the warn-level activation**

```bash
git add eslint.config.js
git commit -m "chore(lint): activate eslint-plugin-jsx-a11y at warn level"
```

---

### Task 3: Fix all `jsx-a11y` violations surfaced in baseline

**Files:**

- Multiple, identified by `/tmp/jsx-a11y-baseline.txt`

- [ ] **Step 1: Categorize violations**

```bash
grep -E "warning.*jsx-a11y" /tmp/jsx-a11y-baseline.txt | awk '{print $NF}' | sort | uniq -c | sort -rn
```

This prints the number of occurrences per rule. Common offenders:

- `jsx-a11y/click-events-have-key-events` — interactive divs
- `jsx-a11y/no-static-element-interactions` — same root cause
- `jsx-a11y/anchor-is-valid` — `<a href="#">` anti-pattern
- `jsx-a11y/label-has-associated-control` — `<Label>` not linked
- `jsx-a11y/no-noninteractive-tabindex` — `tabIndex` on non-interactive
- `jsx-a11y/alt-text` — images / icons missing alt
- `jsx-a11y/no-autofocus` — autoFocus on non-modal

- [ ] **Step 2: Fix violations rule-by-rule**

For each rule, open the offending files (paths in the lint output) and apply the canonical fix per the rule's docs at https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/tree/main/docs/rules. Common fixes:

- Interactive `<div onClick>` → `<button type="button" onClick>`
- `<a href="#">` → `<button type="button">`
- Add `aria-label` to icon-only interactive elements
- Add `<Label htmlFor="x">` + `<Input id="x">` pairs (or use existing pairs)

After each batch of fixes, re-run lint to confirm progress:

```bash
npm run lint 2>&1 | grep -c "jsx-a11y"
```

- [ ] **Step 3: Run full lint + tests + build**

```bash
npm run lint && npx vitest run && npm run build
```

Expected: lint shows 0 jsx-a11y warnings; 889/889 tests pass; build clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(a11y): resolve all jsx-a11y baseline violations"
```

If the violation set is large (>30) and benefits from semantic grouping, split into multiple commits per rule (e.g., one for `click-events-have-key-events`, one for `label-has-associated-control`, etc.).

---

### Task 4: Promote `jsx-a11y` to error level

**Files:**

- Modify: `eslint.config.js`

- [ ] **Step 1: Replace the warn-level mapping with the recommended preset directly**

Edit `eslint.config.js`. In the `rules` section, replace the warn-mapping block:

```js
      // jsx-a11y recommended preset, demoted to warn for the rollout.
      // Promoted to error in Task 4 once violations are addressed.
      ...Object.fromEntries(
        Object.entries(jsxA11y.configs.recommended.rules).map(([rule, level]) => [
          rule,
          level === 'error' || level === 2 ? 'warn' : level,
        ]),
      ),
```

with:

```js
      // jsx-a11y recommended preset at error level (CI gate).
      ...jsxA11y.configs.recommended.rules,
```

- [ ] **Step 2: Verify lint passes at error level**

```bash
npm run lint
```

Expected: PASS (Task 3 fixed everything).

- [ ] **Step 3: Commit**

```bash
git add eslint.config.js
git commit -m "chore(lint): promote eslint-plugin-jsx-a11y to error level"
```

---

### Task 5: Implement `<SkipLink>` primitive (TDD)

**Files:**

- Create: `src/core/ui/skip-link.tsx`
- Create: `src/core/ui/skip-link.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/core/ui/skip-link.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipLink } from './skip-link';

describe('SkipLink', () => {
  it('Renders_AnchorWithHrefToTargetId', () => {
    const { container } = render(<SkipLink targetId="main-content">Skip to main</SkipLink>);
    const a = container.querySelector('a') as HTMLAnchorElement;
    expect(a).toBeInTheDocument();
    expect(a.getAttribute('href')).toBe('#main-content');
    expect(a.textContent).toBe('Skip to main');
  });

  it('IsVisuallyHiddenByDefault_AndVisibleOnFocus', () => {
    const { container } = render(<SkipLink targetId="main-content">Skip</SkipLink>);
    const a = container.querySelector('a') as HTMLAnchorElement;
    expect(a.className).toContain('sr-only');
    expect(a.className).toContain('focus:not-sr-only');
  });

  it('Merges_CustomClassName', () => {
    const { container } = render(
      <SkipLink targetId="main-content" className="custom-x">
        Skip
      </SkipLink>,
    );
    const a = container.querySelector('a') as HTMLAnchorElement;
    expect(a.className).toContain('custom-x');
    expect(a.className).toContain('sr-only');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/ui/skip-link.test.tsx
```

Expected: FAIL — `Cannot find module './skip-link'`.

- [ ] **Step 3: Implement SkipLink**

Create `src/core/ui/skip-link.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SkipLinkProps {
  readonly targetId: string;
  readonly children: ReactNode;
  readonly className?: string;
}

function SkipLink({ targetId, children, className }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        'sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50',
        'focus:rounded focus:bg-background focus:px-3 focus:py-2 focus:text-foreground focus:shadow',
        className,
      )}
    >
      {children}
    </a>
  );
}

export { SkipLink };
export type { SkipLinkProps };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/core/ui/skip-link.test.tsx
```

Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/skip-link.tsx src/core/ui/skip-link.test.tsx
git commit -m "feat(ui): add SkipLink primitive for keyboard navigation"
```

---

### Task 6: Implement `<LiveRegion>` primitive (TDD)

**Files:**

- Create: `src/core/ui/live-region.tsx`
- Create: `src/core/ui/live-region.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/core/ui/live-region.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LiveRegion } from './live-region';

describe('LiveRegion', () => {
  it('DefaultsTo_PoliteRoleStatus', () => {
    const { container } = render(<LiveRegion>hello</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('role')).toBe('status');
    expect(div.getAttribute('aria-live')).toBe('polite');
    expect(div.getAttribute('aria-atomic')).toBe('true');
  });

  it('Maps_AssertivePoliteness_ToRoleAlert', () => {
    const { container } = render(<LiveRegion politeness="assertive">err</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('role')).toBe('alert');
    expect(div.getAttribute('aria-live')).toBe('assertive');
  });

  it('Allows_NonAtomic_WhenAtomicFalse', () => {
    const { container } = render(<LiveRegion atomic={false}>x</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.getAttribute('aria-atomic')).toBe('false');
  });

  it('IsScreenReaderOnly_ByDefault', () => {
    const { container } = render(<LiveRegion>x</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('sr-only');
  });

  it('Merges_CustomClassName_WithSrOnly', () => {
    const { container } = render(<LiveRegion className="extra">x</LiveRegion>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('extra');
    expect(div.className).toContain('sr-only');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/ui/live-region.test.tsx
```

Expected: FAIL — `Cannot find module './live-region'`.

- [ ] **Step 3: Implement LiveRegion**

Create `src/core/ui/live-region.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface LiveRegionProps {
  readonly politeness?: 'polite' | 'assertive';
  readonly atomic?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

function LiveRegion({
  politeness = 'polite',
  atomic = true,
  children,
  className,
}: LiveRegionProps) {
  const role = politeness === 'assertive' ? 'alert' : 'status';
  return (
    <div
      role={role}
      aria-live={politeness}
      aria-atomic={atomic}
      className={cn('sr-only', className)}
    >
      {children}
    </div>
  );
}

export { LiveRegion };
export type { LiveRegionProps };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/core/ui/live-region.test.tsx
```

Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/live-region.tsx src/core/ui/live-region.test.tsx
git commit -m "feat(ui): add LiveRegion primitive for aria-live announcements"
```

---

### Task 7: Implement `useDocumentTitle` hook (TDD)

**Files:**

- Create: `src/core/hooks/use-document-title.ts`
- Create: `src/core/hooks/use-document-title.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/hooks/use-document-title.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDocumentTitle } from './use-document-title';

describe('useDocumentTitle', () => {
  let originalTitle: string;

  beforeEach(() => {
    originalTitle = document.title;
  });

  afterEach(() => {
    document.title = originalTitle;
  });

  it('Sets_DocumentTitle_OnMount', () => {
    renderHook(() => useDocumentTitle('Users'));
    expect(document.title).toBe('Users · Verbara');
  });

  it('Updates_DocumentTitle_WhenTitleChanges', () => {
    const { rerender } = renderHook(({ title }) => useDocumentTitle(title), {
      initialProps: { title: 'Users' },
    });
    expect(document.title).toBe('Users · Verbara');
    rerender({ title: 'Queues' });
    expect(document.title).toBe('Queues · Verbara');
  });

  it('Restores_PreviousTitle_OnUnmount', () => {
    document.title = 'Initial';
    const { unmount } = renderHook(() => useDocumentTitle('Temp'));
    expect(document.title).toBe('Temp · Verbara');
    unmount();
    expect(document.title).toBe('Initial');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/hooks/use-document-title.test.ts
```

Expected: FAIL — `Cannot find module './use-document-title'`.

- [ ] **Step 3: Implement the hook**

Create `src/core/hooks/use-document-title.ts`:

```ts
import { useEffect } from 'react';

const TITLE_SUFFIX = ' · Verbara';

function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title}${TITLE_SUFFIX}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export { useDocumentTitle };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/core/hooks/use-document-title.test.ts
```

Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/hooks/use-document-title.ts src/core/hooks/use-document-title.test.ts
git commit -m "feat(hooks): add useDocumentTitle for SR-friendly route titles"
```

---

### Task 8: Apply `useDocumentTitle` to all 4 layout shells

**Files:**

- Modify: `src/pages/admin/admin-layout.tsx`
- Modify: `src/pages/agent/agent-layout.tsx`
- Modify: `src/pages/analytics/analytics-layout.tsx`
- Modify: `src/pages/operations/operations-layout.tsx`

- [ ] **Step 1: Inspect one layout to learn the pattern**

```bash
cat /media/Data/Source/Verbara/Verbara.Platform.Web/src/pages/admin/admin-layout.tsx
```

Note the existing component shape (likely `<Outlet />` inside an app shell).

- [ ] **Step 2: Wire useDocumentTitle in each layout**

Each layout uses i18n. Add an import and call the hook with a key like `nav.admin` (verify the actual key in `public/locales/en-US/common.json` under the navigation section). Pattern for `admin-layout.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/core/hooks/use-document-title';
// ... existing imports ...

export default function AdminLayout() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.admin'));
  // ... existing render ...
}
```

Apply identical pattern to `agent-layout.tsx` (key `nav.agent`), `analytics-layout.tsx` (`nav.analytics`), `operations-layout.tsx` (`nav.operations`). Verify the keys exist in `common.json`; if not, add them (with i18n parity across all 3 locales).

- [ ] **Step 3: Verify build + tests**

```bash
npm run build && npm run i18n:check && npx vitest run
```

Expected: build + i18n parity + tests all pass.

- [ ] **Step 4: Manual smoke check (optional, recommended)**

```bash
npm run dev
```

Navigate `/admin/users` then `/agent/inbox` — observe the browser tab title changes accordingly.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/admin-layout.tsx src/pages/agent/agent-layout.tsx src/pages/analytics/analytics-layout.tsx src/pages/operations/operations-layout.tsx public/locales/
git commit -m "feat(a11y): apply useDocumentTitle to all 4 layout shells"
```

---

### Task 9: Wire `<SkipLink>` in app-shell

**Files:**

- Modify: `src/shell/app-shell.tsx`
- Modify: `public/locales/{en-US,es-419,pt-BR}/common.json` (add `a11y.skipToMain` key)

- [ ] **Step 1: Add i18n key to all three locales**

In `public/locales/en-US/common.json`, locate or add an `a11y` namespace and add `"skipToMain": "Skip to main content"`. Same in `es-419/common.json` (`"Saltar al contenido principal"`) and `pt-BR/common.json` (`"Pular para o conteúdo principal"`).

- [ ] **Step 2: Run i18n parity check**

```bash
npm run i18n:check
```

Expected: PASS.

- [ ] **Step 3: Wire SkipLink + main id in app-shell**

Edit `src/shell/app-shell.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Rail } from './rail';
import { SkipLink } from '@/core/ui/skip-link';

export default function AppShell() {
  const { t } = useTranslation();
  return (
    <>
      <SkipLink targetId="main-content">{t('a11y.skipToMain')}</SkipLink>
      <div className="flex h-screen overflow-hidden">
        <Rail />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-auto bg-slate-50 outline-none dark:bg-slate-900"
        >
          <Outlet />
        </main>
      </div>
    </>
  );
}
```

(Adapt to the existing component's actual JSX — preserve any wrappers or providers.)

- [ ] **Step 4: Verify**

```bash
npm run build && npx vitest run
```

Expected: build + tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shell/app-shell.tsx public/locales/
git commit -m "feat(a11y): wire SkipLink in app-shell with main-content target"
```

---

### Task 10: Add `prefers-reduced-motion: reduce` block to global CSS

**Files:**

- Modify: `src/index.css`

- [ ] **Step 1: Append the media query block**

Add to the bottom of `src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Verify build still passes**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Manual verification (optional)**

In macOS: System Settings → Accessibility → Display → Reduce Motion → On. Reload the app — animations should be near-instant.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(a11y): respect prefers-reduced-motion in global CSS"
```

---

### Task 11: Fix `Button` disabled contrast (TDD)

**Files:**

- Modify: `src/core/ui/button.tsx`
- Modify: `src/core/ui/button.test.tsx`

- [ ] **Step 1: Add a failing test**

Locate `button.test.tsx` (or create if absent). Append:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button disabled contrast', () => {
  it('Disabled_DoesNotApply_OpacityFifty', () => {
    const { container } = render(<Button disabled>Click</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).not.toContain('opacity-50');
  });

  it('Disabled_Applies_MutedBackgroundAndForeground', () => {
    const { container } = render(<Button disabled>Click</Button>);
    const btn = container.firstChild as HTMLElement;
    expect(btn.className).toContain('disabled:bg-muted');
    expect(btn.className).toContain('disabled:text-muted-foreground');
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
npx vitest run src/core/ui/button.test.tsx
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Update button.tsx**

In `src/core/ui/button.tsx`, locate the base classes string (around line 7) containing `disabled:pointer-events-none disabled:opacity-50`. Replace `disabled:opacity-50` with `disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:border-muted`.

The result should be (at minimum):

```
... disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:border-muted ...
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run src/core/ui/button.test.tsx
```

Expected: PASS for new tests + all existing button tests.

- [ ] **Step 5: Manual contrast verification**

```bash
npm run dev
```

Open Chrome DevTools → Elements → pick a disabled button → Accessibility pane → Contrast. Verify ratio ≥ 4.5:1 in both light and dark themes. Document the measured ratios in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/core/ui/button.tsx src/core/ui/button.test.tsx
git commit -m "fix(ui): preserve contrast on disabled Button (WCAG 1.4.3 AA)

Replaces disabled:opacity-50 (drops contrast ~2:1) with
disabled:bg-muted + disabled:text-muted-foreground.
Measured contrast (Chrome DevTools): light X.X:1, dark Y.Y:1."
```

(Replace X.X / Y.Y with the actual measured ratios.)

---

### Task 12: Sync `<html lang>` on i18n change

**Files:**

- Modify: `src/core/i18n/language-switcher.tsx` (or wherever language change is centralized — verify with grep)

- [ ] **Step 1: Locate the language-switcher / i18n init**

```bash
grep -rn "i18n.changeLanguage\|i18n\.language" /media/Data/Source/Verbara/Verbara.Platform.Web/src/core/i18n/ | head -10
```

Identify where language change is dispatched. Likely `src/core/i18n/language-switcher.tsx` or `src/core/i18n/i18n.ts`.

- [ ] **Step 2: Add an effect that syncs document.documentElement.lang**

In the appropriate file (preferred: a small new module `src/core/i18n/use-html-lang.ts`, then import into the switcher OR app.tsx):

```ts
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function useHtmlLang(): void {
  const { i18n } = useTranslation();
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
}

export { useHtmlLang };
```

Then call `useHtmlLang()` once in `src/app.tsx` (or `main.tsx`) at the top level.

- [ ] **Step 3: Verify**

```bash
npm run build && npx vitest run
```

Expected: PASS.

- [ ] **Step 4: Manual smoke**

```bash
npm run dev
```

Open DevTools → Elements → `<html>`. Switch language via the switcher. Confirm `<html lang="...">` updates immediately.

- [ ] **Step 5: Commit**

```bash
git add src/core/i18n/use-html-lang.ts src/app.tsx
git commit -m "feat(a11y): sync html lang attribute with i18n language"
```

---

### Task 13: Add `@axe-core/playwright` baseline E2E spec

**Files:**

- Create: `tests/e2e/tests/a11y/wcag-baseline.spec.ts`

- [ ] **Step 1: Inspect existing fixture pattern**

```bash
head -40 /media/Data/Source/Verbara/Verbara.Platform.Web/tests/e2e/tests/operations/agent-states.spec.ts
```

Note import paths and fixture usage.

- [ ] **Step 2: Create the baseline spec**

Create `tests/e2e/tests/a11y/wcag-baseline.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('WCAG baseline (axe-core)', () => {
  test('login page has no critical or serious violations', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('admin/users has no critical or serious violations', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/users');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('admin/queues has no critical or serious violations', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin/queues');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('operations/agents has no critical or serious violations', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/operations/agents');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('analytics/dashboard has no critical or serious violations', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/analytics/dashboard');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });

  test('skip-link is focusable and targets main content', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/users');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', '#main-content');
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });
});
```

- [ ] **Step 3: Run the spec**

```bash
npx playwright test tests/e2e/tests/a11y/wcag-baseline.spec.ts
```

Expected: PASS. If any route reports critical/serious violations, debug and fix before merging — those represent gaps the static lint missed and must be closed before declaring 5C.1 done.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/tests/a11y/wcag-baseline.spec.ts
git commit -m "test(a11y): add axe-core WCAG baseline E2E spec"
```

---

### Task 14: Bump to `2.0.3` (close patch 5C.1)

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Update version**

In `package.json`, change `"version": "2.0.2"` to `"version": "2.0.3"`.

- [ ] **Step 2: Verify build + lint + tests**

```bash
npm run build && npm run lint && npx vitest run && npx playwright test tests/e2e/tests/a11y/
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: bump to 2.0.3 (Track 5C.1 — a11y foundation)"
```

Per ADR-0005, no annotated tag for `2.0.3`.

---

# Patch 5C.2 — Application + Closure (target: `2.0.4`, tag `v2.0.4-web`)

### Task 15: Implement `useFieldA11y` hook (TDD)

**Files:**

- Create: `src/core/hooks/use-field-a11y.ts`
- Create: `src/core/hooks/use-field-a11y.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/hooks/use-field-a11y.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFieldA11y } from './use-field-a11y';

describe('useFieldA11y', () => {
  it('Returns_UndefinedAriaProps_WhenNoErrorAndNotRequired', () => {
    const { result } = renderHook(() => useFieldA11y(undefined, 'email'));
    expect(result.current.inputProps['aria-invalid']).toBeUndefined();
    expect(result.current.inputProps['aria-describedby']).toBeUndefined();
    expect(result.current.inputProps['aria-required']).toBeUndefined();
    expect(result.current.errorId).toBe('email-error');
  });

  it('Returns_AriaInvalidAndDescribedBy_WhenErrorPresent', () => {
    const { result } = renderHook(() => useFieldA11y({ message: 'required' }, 'email'));
    expect(result.current.inputProps['aria-invalid']).toBe(true);
    expect(result.current.inputProps['aria-describedby']).toBe('email-error');
  });

  it('Returns_AriaRequired_WhenRequiredFlagSet_RegardlessOfError', () => {
    const { result: noError } = renderHook(() =>
      useFieldA11y(undefined, 'email', { required: true }),
    );
    expect(noError.current.inputProps['aria-required']).toBe(true);

    const { result: withError } = renderHook(() =>
      useFieldA11y({ message: 'x' }, 'email', { required: true }),
    );
    expect(withError.current.inputProps['aria-required']).toBe(true);
    expect(withError.current.inputProps['aria-invalid']).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/hooks/use-field-a11y.test.ts
```

Expected: FAIL — `Cannot find module './use-field-a11y'`.

- [ ] **Step 3: Implement the hook**

Create `src/core/hooks/use-field-a11y.ts`:

```ts
interface FieldA11yOptions {
  readonly required?: boolean;
}

interface FieldA11yResult {
  readonly inputProps: {
    readonly 'aria-invalid'?: true;
    readonly 'aria-describedby'?: string;
    readonly 'aria-required'?: true;
  };
  readonly errorId: string;
}

function useFieldA11y(
  error: { message?: string } | undefined,
  baseId: string,
  options: FieldA11yOptions = {},
): FieldA11yResult {
  const errorId = `${baseId}-error`;
  const hasError = Boolean(error);
  return {
    inputProps: {
      'aria-invalid': hasError ? true : undefined,
      'aria-describedby': hasError ? errorId : undefined,
      'aria-required': options.required ? true : undefined,
    },
    errorId,
  };
}

export { useFieldA11y };
export type { FieldA11yOptions, FieldA11yResult };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/core/hooks/use-field-a11y.test.ts
```

Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/hooks/use-field-a11y.ts src/core/hooks/use-field-a11y.test.ts
git commit -m "feat(hooks): add useFieldA11y for form-input ARIA wiring"
```

---

### Task 16: Implement `<FieldError>` component (TDD)

**Files:**

- Create: `src/core/ui/field-error.tsx`
- Create: `src/core/ui/field-error.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/core/ui/field-error.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldError } from './field-error';

describe('FieldError', () => {
  it('Renders_Null_WhenMessageIsUndefined', () => {
    const { container } = render(<FieldError id="email-error" />);
    expect(container.firstChild).toBeNull();
  });

  it('Renders_PWithRoleAlertAndId_WhenMessagePresent', () => {
    const { container } = render(<FieldError id="email-error" message="invalid" />);
    const p = container.firstChild as HTMLParagraphElement;
    expect(p).toBeInTheDocument();
    expect(p.tagName).toBe('P');
    expect(p.getAttribute('role')).toBe('alert');
    expect(p.getAttribute('id')).toBe('email-error');
    expect(p.textContent).toBe('invalid');
  });

  it('Merges_CustomClassName', () => {
    const { container } = render(<FieldError id="x" message="oops" className="extra" />);
    const p = container.firstChild as HTMLElement;
    expect(p.className).toContain('extra');
    expect(p.className).toContain('text-destructive');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/ui/field-error.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Implement FieldError**

Create `src/core/ui/field-error.tsx`:

```tsx
import { cn } from '@/lib/utils';

interface FieldErrorProps {
  readonly id: string;
  readonly message?: string;
  readonly className?: string;
}

function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className={cn('text-xs text-destructive', className)}>
      {message}
    </p>
  );
}

export { FieldError };
export type { FieldErrorProps };
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/core/ui/field-error.test.tsx
```

Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/field-error.tsx src/core/ui/field-error.test.tsx
git commit -m "feat(ui): add FieldError component with role=alert + id"
```

---

### Task 17: Enhance `<Label>` with optional `required` prop (TDD)

**Files:**

- Modify: `src/core/ui/label.tsx`
- Create or modify: `src/core/ui/label.test.tsx`

- [ ] **Step 1: Inspect current Label**

```bash
cat /media/Data/Source/Verbara/Verbara.Platform.Web/src/core/ui/label.tsx
```

Note the existing component shape (likely a thin wrapper around `<label>` with `cn()`).

- [ ] **Step 2: Add a failing test**

Append to or create `src/core/ui/label.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { Label } from './label';

void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { common: { a11y: { required: 'required' } } } },
});

describe('Label required prop', () => {
  it('DoesNotRender_Asterisk_WhenRequiredFalse', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <Label htmlFor="x">Email</Label>
      </I18nextProvider>,
    );
    expect(container.textContent).toBe('Email');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('Renders_VisibleAsterisk_AndSrOnlyRequired_WhenRequired', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <Label htmlFor="x" required>
          Email
        </Label>
      </I18nextProvider>,
    );
    const asterisk = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(asterisk).not.toBeNull();
    expect(asterisk.textContent).toBe('*');
    const srOnly = container.querySelector('.sr-only') as HTMLElement;
    expect(srOnly).not.toBeNull();
    expect(srOnly.textContent).toBe('required');
  });
});
```

- [ ] **Step 3: Run tests to confirm failure**

```bash
npx vitest run src/core/ui/label.test.tsx
```

Expected: 1 PASS (DoesNotRender), 1 FAIL (Renders required).

- [ ] **Step 4: Update Label to support `required`**

Edit `src/core/ui/label.tsx`. Add a `required?: boolean` prop and render the asterisk + sr-only span when set. Example shape:

```tsx
import { useTranslation } from 'react-i18next';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

interface LabelProps extends ComponentPropsWithoutRef<'label'> {
  readonly required?: boolean;
}

function Label({ className, required, children, ...rest }: LabelProps) {
  const { t } = useTranslation();
  return (
    <label
      className={cn('text-sm font-medium leading-none peer-disabled:opacity-50', className)}
      {...rest}
    >
      {children}
      {required && (
        <>
          {' '}
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
          <span className="sr-only">{t('a11y.required')}</span>
        </>
      )}
    </label>
  );
}

export { Label };
export type { LabelProps };
```

(Adapt to the exact existing Label class string — keep the styling the codebase already uses, only adding the new behavior.)

- [ ] **Step 5: Add the i18n key to all three locales**

In each of `public/locales/{en-US,es-419,pt-BR}/common.json`, in the `a11y` namespace (created in Task 9), add:

```json
"required": "required"      // en-US
"required": "obligatorio"   // es-419
"required": "obrigatório"   // pt-BR
```

- [ ] **Step 6: Run tests + i18n + build**

```bash
npx vitest run src/core/ui/label.test.tsx && npm run i18n:check && npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/ui/label.tsx src/core/ui/label.test.tsx public/locales/
git commit -m "feat(ui): add required prop to Label with visible asterisk + sr-only text"
```

---

### Task 18: Apply form helpers + required indication to Tier 1 forms

**Files:**

- Modify: `src/core/auth/login-page.tsx`
- Modify: `src/core/auth/forgot-password-page.tsx`
- Modify: `src/core/auth/reset-password-page.tsx`
- Modify: `src/core/auth/mfa-verify.tsx`
- Modify: `src/admin/users/user-form.tsx`
- Modify: `src/admin/queues/queue-form.tsx`
- Modify: `src/admin/setup/steps/agent-step.tsx`
- Modify: `src/admin/security/mfa/mfa-admin-page.tsx`

- [ ] **Step 1: Pattern reference**

For each Tier 1 form, the migration pattern is:

```tsx
import { useFieldA11y } from '@/core/hooks/use-field-a11y';
import { FieldError } from '@/core/ui/field-error';

// Inside the component, alongside register() / Controller:
const emailA11y = useFieldA11y(errors.email, 'login-email', { required: true });

// Replace:
<Label htmlFor="login-email">{t('auth.email')}</Label>
<Input id="login-email" {...register('email')} aria-invalid={!!errors.email} />
{errors.email && <p className="text-xs text-destructive">{t(errors.email.message)}</p>}

// With:
<Label htmlFor="login-email" required>{t('auth.email')}</Label>
<Input id="login-email" {...register('email')} {...emailA11y.inputProps} />
<FieldError
  id={emailA11y.errorId}
  message={errors.email?.message ? t(errors.email.message) : undefined}
/>
```

Required-vs-optional decision: a field is `required: true` when the Zod schema does NOT mark it optional (i.e., `z.string()` is required, `z.string().optional()` is not). Inspect each form's schema before applying.

- [ ] **Step 2: Apply to all 8 Tier 1 forms**

Iterate file-by-file. For each form:

1. Identify all registered fields and their required status from the Zod schema.
2. Add `useFieldA11y` calls per field.
3. Replace the `aria-invalid` + raw `<p>` error pattern with `inputProps` spread + `<FieldError>`.
4. Add `required` prop to `<Label>` for required fields.

- [ ] **Step 3: Run tests + lint + build**

```bash
npx vitest run && npm run lint && npm run build
```

Expected: all pass.

- [ ] **Step 4: Commit (single commit covering the form sweep)**

```bash
git add src/core/auth/ src/admin/users/user-form.tsx src/admin/queues/queue-form.tsx src/admin/setup/steps/agent-step.tsx src/admin/security/mfa/mfa-admin-page.tsx
git commit -m "refactor(forms): apply useFieldA11y + FieldError + Label required to Tier 1 forms"
```

---

### Task 19: Verify form submit focus-on-error per Tier 1 form

**Files:**

- Per-form modifications if `Controller` `field.ref` not wired

- [ ] **Step 1: Smoke-test each Tier 1 form**

```bash
npm run dev
```

For each form: navigate, leave a required field empty, submit. Observe whether focus moves to the first invalid field.

- [ ] **Step 2: Fix broken `Controller` ref wiring**

Where focus does NOT move, the cause is a `Controller`-rendered field (e.g., a custom `<Select>`) that doesn't pass `field.ref` to a focusable element. Fix:

```tsx
<Controller
  control={control}
  name="role"
  render={({ field }) => (
    <Select
      ref={field.ref} // <-- was missing or incorrect
      value={field.value}
      onValueChange={field.onChange}
    >
      ...
    </Select>
  )}
/>
```

If the underlying `Select` component does not forward `ref`, edit the wrapper to use `forwardRef` and pass it to the inner trigger button.

- [ ] **Step 3: Re-test each form**

Re-run the manual smoke. Confirm focus lands on first invalid field on submit.

- [ ] **Step 4: Commit**

```bash
git add src/core/auth/ src/admin/users/user-form.tsx src/admin/queues/queue-form.tsx src/admin/setup/steps/agent-step.tsx src/admin/security/mfa/mfa-admin-page.tsx
git commit -m "fix(forms): wire Controller ref so submit focuses first invalid field"
```

(If no fixes are needed because RHF default already works for all 8 forms, document that in a brief commit message and move on without changes.)

---

### Task 20: Add `scope="col"` and search input `aria-label` to DataTable

**Files:**

- Modify: `src/admin/shared/data-table.tsx`
- Modify: `src/admin/shared/data-table.test.tsx`

- [ ] **Step 1: Add a failing test**

Append to `src/admin/shared/data-table.test.tsx` (the file created in Track 5B Task 6):

```tsx
describe('DataTable a11y', () => {
  it('StandardMode_HeaderCells_HaveScopeCol', () => {
    const data = [{ id: 1, name: 'A' }];
    const cols = [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' },
    ];
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <DataTable data={data} columns={cols} />
      </I18nextProvider>,
    );
    const ths = container.querySelectorAll('th');
    expect(ths.length).toBeGreaterThan(0);
    ths.forEach((th) => expect(th.getAttribute('scope')).toBe('col'));
  });

  it('SearchInput_HasAriaLabel_FromPlaceholder', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <DataTable data={[]} columns={[]} searchPlaceholder="Search users" />
      </I18nextProvider>,
    );
    const input = container.querySelector('[data-testid="data-table-search"]') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Search users');
  });
});
```

(Use any necessary additional imports. The existing test file imports `i18n`, `DataTable`, etc.)

- [ ] **Step 2: Run test to confirm failure**

```bash
npx vitest run src/admin/shared/data-table.test.tsx
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Update data-table.tsx**

In `src/admin/shared/data-table.tsx`, locate the `<th>` elements (around line 91 in standard mode) and add `scope="col"`:

```tsx
<th
  key={header.id}
  scope="col"
  className="px-4 py-3 text-left font-medium text-muted-foreground"
>
```

Locate the search `<Input>` (around line 75) and add `aria-label={resolvedSearchPlaceholder}`:

```tsx
<Input
  placeholder={resolvedSearchPlaceholder}
  aria-label={resolvedSearchPlaceholder}
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="pl-8"
  data-testid="data-table-search"
/>
```

- [ ] **Step 4: Run tests to verify pass**

```bash
npx vitest run src/admin/shared/data-table.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/shared/data-table.tsx src/admin/shared/data-table.test.tsx
git commit -m "feat(ui): add scope=col on DataTable th + aria-label on search input"
```

---

### Task 21: Add `aria-busy` to LoadingOverlay and Skeleton (TDD)

**Files:**

- Modify: `src/core/ui/loading-overlay.tsx`
- Modify: `src/core/ui/skeleton.tsx`
- Modify: `src/core/ui/loading-overlay.test.tsx`
- Modify: `src/core/ui/skeleton.test.tsx`

- [ ] **Step 1: Add failing tests**

Append to `src/core/ui/loading-overlay.test.tsx`:

```tsx
it('Has_AriaBusyTrue', () => {
  const { container } = render(<LoadingOverlay />);
  const el = container.firstChild as HTMLElement;
  expect(el.getAttribute('aria-busy')).toBe('true');
});
```

Append to `src/core/ui/skeleton.test.tsx`:

```tsx
it('Has_RoleStatus_AriaBusy_AndSrOnlyLoadingText', () => {
  const { container } = render(<Skeleton />);
  const el = container.firstChild as HTMLElement;
  expect(el.getAttribute('role')).toBe('status');
  expect(el.getAttribute('aria-busy')).toBe('true');
  const sr = container.querySelector('.sr-only') as HTMLElement;
  expect(sr).not.toBeNull();
  expect(sr.textContent).toBe('Loading');
});
```

- [ ] **Step 2: Run tests to confirm failure**

```bash
npx vitest run src/core/ui/loading-overlay.test.tsx src/core/ui/skeleton.test.tsx
```

Expected: 2 new tests FAIL.

- [ ] **Step 3: Update LoadingOverlay**

Edit `src/core/ui/loading-overlay.tsx`. Locate the outer container (around line 17 — already has `role="status"` + `aria-label="Loading"`) and add `aria-busy="true"`:

```tsx
<div role="status" aria-label="Loading" aria-busy="true" className={...}>
```

- [ ] **Step 4: Update Skeleton**

Edit `src/core/ui/skeleton.tsx`:

```tsx
function Skeleton({ className, variant = 'text', style }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      role="status"
      aria-busy="true"
      className={cn('animate-pulse bg-muted', VARIANT_CLASSES[variant], className)}
      style={style}
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run src/core/ui/loading-overlay.test.tsx src/core/ui/skeleton.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run full suite (Skeleton is reused in many tests)**

```bash
npx vitest run
```

Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/core/ui/loading-overlay.tsx src/core/ui/skeleton.tsx src/core/ui/loading-overlay.test.tsx src/core/ui/skeleton.test.tsx
git commit -m "feat(a11y): add aria-busy to LoadingOverlay and Skeleton"
```

---

### Task 22: ErrorBoundary `role="alert"` + autoFocus (class component)

**Files:**

- Modify: `src/core/error-boundary.tsx`

- [ ] **Step 1: Inspect current ErrorBoundary**

```bash
cat /media/Data/Source/Verbara/Verbara.Platform.Web/src/core/error-boundary.tsx
```

- [ ] **Step 2: Add ref + autoFocus on hasError flip**

Edit `src/core/error-boundary.tsx`:

```tsx
import { Component, createRef, type ReactNode, type RefObject } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  private alertRef: RefObject<HTMLDivElement | null> = createRef();

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidUpdate(_: Props, prevState: State) {
    if (!prevState.hasError && this.state.hasError) {
      this.alertRef.current?.focus();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          ref={this.alertRef}
          role="alert"
          tabIndex={-1}
          className="flex min-h-screen flex-col items-center justify-center bg-slate-50 outline-none dark:bg-slate-900"
        >
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Something went wrong
          </h1>
          {/* ... existing children rendering ... */}
        </div>
      );
    }
    return this.props.children;
  }
}
```

(Preserve any existing JSX inside the error UI — only add `ref`, `role`, `tabIndex`, `outline-none`.)

- [ ] **Step 3: Run tests + build**

```bash
npx vitest run && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/error-boundary.tsx
git commit -m "feat(a11y): ErrorBoundary uses role=alert and focuses on error"
```

---

### Task 23: RouteErrorBoundary `role="alert"` + autoFocus (function component)

**Files:**

- Modify: `src/core/ui/route-error-boundary.tsx`

- [ ] **Step 1: Edit RouteErrorBoundary**

```tsx
import { useEffect, useRef } from 'react';
// ... existing imports ...

export function RouteErrorBoundary() {
  // ... existing error capture ...
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alertRef.current?.focus();
  }, []);

  return (
    <div ref={alertRef} role="alert" tabIndex={-1} className="... outline-none ...">
      {/* existing markup */}
    </div>
  );
}
```

(Adapt to the existing component structure — preserve heading, error message, retry button, etc.)

- [ ] **Step 2: Run tests + build**

```bash
npx vitest run && npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/ui/route-error-boundary.tsx
git commit -m "feat(a11y): RouteErrorBoundary uses role=alert and focuses on error"
```

---

### Task 24: Sonner `containerAriaLabel` (i18n)

**Files:**

- Modify: `src/core/ui/sonner.tsx`
- Modify: `public/locales/{en-US,es-419,pt-BR}/common.json`

- [ ] **Step 1: Add i18n key**

In each of `public/locales/{en-US,es-419,pt-BR}/common.json`, in the `a11y` namespace, add:

```json
"notificationsRegion": "Notifications"        // en-US
"notificationsRegion": "Notificaciones"       // es-419
"notificationsRegion": "Notificações"         // pt-BR
```

- [ ] **Step 2: Update Sonner wrapper**

Edit `src/core/ui/sonner.tsx`:

```tsx
import { Toaster as Sonner, type ToasterProps } from 'sonner';
import { useTranslation } from 'react-i18next';
// ... existing imports ...

const Toaster = ({ ...props }: ToasterProps) => {
  const { t } = useTranslation();
  // ... existing theme/icon resolution ...
  return (
    <Sonner
      // ... existing props ...
      containerAriaLabel={t('a11y.notificationsRegion')}
      {...props}
    />
  );
};
```

- [ ] **Step 3: Verify**

```bash
npm run i18n:check && npm run build && npx vitest run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/ui/sonner.tsx public/locales/
git commit -m "feat(a11y): set i18n containerAriaLabel on Sonner Toaster"
```

---

### Task 25: InboxPanel new-conversation announcer

**Files:**

- Modify: `src/agent/inbox/inbox-panel.tsx`
- Modify: `public/locales/{en-US,es-419,pt-BR}/agent.json`

- [ ] **Step 1: Add i18n key**

In each of `public/locales/{en-US,es-419,pt-BR}/agent.json`, locate the `inbox` namespace and add:

```json
"announceNew": "New conversation from {{name}}"            // en-US
"announceNew": "Nueva conversación de {{name}}"            // es-419
"announceNew": "Nova conversa de {{name}}"                 // pt-BR
```

- [ ] **Step 2: Wire LiveRegion in InboxPanel**

Edit `src/agent/inbox/inbox-panel.tsx`. Add imports and announcer state:

```tsx
import { useEffect, useState } from 'react';
import { LiveRegion } from '@/core/ui/live-region';
// ... existing imports ...

export function InboxPanel() {
  // ... existing state ...
  const [announcement, setAnnouncement] = useState<string>('');
  const previousFirstIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const currentFirst = visible[0];
    if (
      currentFirst &&
      previousFirstIdRef.current !== undefined &&
      currentFirst.id !== previousFirstIdRef.current
    ) {
      setAnnouncement(t('agent:inbox.announceNew', { name: currentFirst.contactName }));
    }
    previousFirstIdRef.current = currentFirst?.id;
  }, [visible, t]);

  // In JSX, render the LiveRegion (placement: at the end of the panel, sr-only):
  return (
    <>
      {/* existing JSX */}
      <LiveRegion politeness="polite">{announcement}</LiveRegion>
    </>
  );
}
```

(Add `import { useRef }` if not already present.)

- [ ] **Step 3: Verify**

```bash
npm run i18n:check && npm run build && npx vitest run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/agent/inbox/inbox-panel.tsx public/locales/
git commit -m "feat(a11y): InboxPanel announces new conversation arrivals"
```

---

### Task 26: Heading hierarchy verification + fixes

**Files:**

- Multiple (discovered during the task)

- [ ] **Step 1: Audit headings page-by-page**

```bash
for f in $(find /media/Data/Source/Verbara/Verbara.Platform.Web/src -name "*-page.tsx" -o -name "*-detail.tsx"); do
  hits=$(grep -E "<h[1-6]" "$f" | grep -oE "<h[1-6]")
  if [ -n "$hits" ]; then
    echo "=== $f ==="
    echo "$hits"
  fi
done
```

For each file, verify the sequence is monotonic (h1 → h2 → h3, no skips). The `PageHeader` component renders the `<h1>`; subsequent headings inside the page should be `<h2>` (or `<h3>` only if a parent `<h2>` exists).

- [ ] **Step 2: Demote skipped headings**

For each file with a skip (h1 → h3 directly), change the `<h3>` to `<h2>`. Preserve Tailwind classes.

- [ ] **Step 3: Document fixed files in commit**

- [ ] **Step 4: Verify**

```bash
npx vitest run && npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix(a11y): correct heading hierarchy skips on detail pages

Audited all *-page.tsx and *-detail.tsx files; demoted h3 to h2 in
files where no parent h2 existed: <list discovered files here>"
```

---

### Task 27: Search/utility input `aria-label` audit

**Files:**

- Modify: `src/admin/shared/contact-search-panel.tsx`
- Modify: `src/admin/flows/flow-toolbar.tsx`
- Modify: `src/admin/system/auth-events-page.tsx`
- Modify: `src/agent/context/knowledge-tab.tsx`
- Modify: any others discovered (e.g. `src/admin/dnc-lists/`, `src/admin/queues/queue-detail.tsx`)

- [ ] **Step 1: Find Input elements lacking visible Label and aria-label**

```bash
for f in $(find /media/Data/Source/Verbara/Verbara.Platform.Web/src -name "*.tsx"); do
  if grep -q "<Input" "$f" && ! grep -q "<Label" "$f" && ! grep -q "aria-label" "$f"; then
    echo "$f"
  fi
done
```

(The `aria-label` check is approximate — some files may have aria-label on a NON-Input element. Manually verify each candidate.)

- [ ] **Step 2: For each unlabeled `<Input>`, add `aria-label`**

Pattern:

```tsx
// Before:
<Input placeholder={t('search.placeholder')} value={...} onChange={...} />

// After:
<Input
  aria-label={t('search.placeholder')}
  placeholder={t('search.placeholder')}
  value={...}
  onChange={...}
/>
```

DataTable's search input was already done in Task 20.

- [ ] **Step 3: Verify**

```bash
npm run lint && npx vitest run && npm run build
```

Expected: PASS, including jsx-a11y rule `label-has-associated-control`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(a11y): add aria-label to search/utility inputs without visible Label"
```

---

### Task 28: `roles-page.tsx` interactive div → button

**Files:**

- Modify: `src/admin/roles/roles-page.tsx`

- [ ] **Step 1: Locate the violation**

```bash
grep -n "onClick={(e) => e.stopPropagation()}" /media/Data/Source/Verbara/Verbara.Platform.Web/src/admin/roles/roles-page.tsx
```

Expected: line 127 (per audit).

- [ ] **Step 2: Replace `<div>` with semantic markup**

The div at line 127 stops click propagation to wrap action buttons inside a clickable row. The proper fix is to keep it as a layout `<div>` but remove the `onClick` (since the inner buttons already stop their own propagation via Base UI). Alternatively, attach `e.stopPropagation()` to each button's `onClick` directly.

```tsx
// Before:
<div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
  <Button onClick={...}>Edit</Button>
  <Button onClick={...}>Delete</Button>
</div>

// After:
<div className="flex gap-1">
  <Button onClick={(e) => { e.stopPropagation(); doEdit(); }}>Edit</Button>
  <Button onClick={(e) => { e.stopPropagation(); doDelete(); }}>Delete</Button>
</div>
```

(Adapt to the actual button onClick handlers — wrap them to call `e.stopPropagation()` first.)

- [ ] **Step 3: Verify**

```bash
npm run lint && npx vitest run && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/roles/roles-page.tsx
git commit -m "fix(a11y): replace interactive div with explicit button stopPropagation"
```

---

### Task 29: Drag handle `aria-label` in routes-page

**Files:**

- Modify: `src/admin/routes/routes-page.tsx`
- Modify: `public/locales/{en-US,es-419,pt-BR}/common.json` or `admin.json`

- [ ] **Step 1: Add i18n key**

In `public/locales/{en-US,es-419,pt-BR}/common.json` (a11y namespace) add:

```json
"dragToReorder": "Drag to reorder"        // en-US
"dragToReorder": "Arrastra para reordenar"  // es-419
"dragToReorder": "Arraste para reordenar" // pt-BR
```

- [ ] **Step 2: Add aria-label to grip button**

Locate the grip button in `src/admin/routes/routes-page.tsx` (around lines 72-78 per audit):

```tsx
<button aria-label={t('a11y.dragToReorder')} {...attributes} {...listeners}>
  <GripVertical className="h-4 w-4" />
</button>
```

- [ ] **Step 3: Verify**

```bash
npm run i18n:check && npm run lint && npx vitest run && npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/admin/routes/routes-page.tsx public/locales/
git commit -m "fix(a11y): add aria-label to drag handle in routes-page"
```

---

### Task 30: MFA OTP input `autoComplete` + `pattern`

**Files:**

- Modify: `src/core/auth/mfa-verify.tsx`

- [ ] **Step 1: Locate the OTP input**

```bash
grep -n "inputMode=\"numeric\"" /media/Data/Source/Verbara/Verbara.Platform.Web/src/core/auth/mfa-verify.tsx
```

Expected: line 143 (per audit).

- [ ] **Step 2: Add `autoComplete` and `pattern` attributes**

```tsx
<input
  inputMode="numeric"
  autoComplete="one-time-code"
  pattern="[0-9]*"
  maxLength={1}
  // ... existing props ...
/>
```

If multiple inputs (one per digit), apply to all. Only the first should have `autoComplete="one-time-code"` to enable browser autofill (browsers paste the full code into all subsequent fields automatically).

- [ ] **Step 3: Verify**

```bash
npm run build && npx vitest run
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/auth/mfa-verify.tsx
git commit -m "fix(a11y): add autoComplete=one-time-code + pattern to MFA OTP inputs"
```

---

### Task 31: Re-run axe-core baseline + fix any new violations

**Files:**

- Investigation only; fix any surfaced gaps

- [ ] **Step 1: Run the baseline E2E spec**

```bash
npx playwright test tests/e2e/tests/a11y/wcag-baseline.spec.ts
```

Expected: PASS on all 6 routes. If any violation surfaces (because 5C.2 changes inadvertently introduced one), fix in this task.

- [ ] **Step 2: If failures, debug and fix**

Read the violation message — axe-core is precise. Apply the fix, re-run, commit.

- [ ] **Step 3: Commit (if any fixes)**

```bash
git add -A
git commit -m "fix(a11y): resolve axe-core baseline violation in <route>"
```

(Skip if Step 1 passed clean.)

---

### Task 32: Bump to `2.0.4`, update CLAUDE.md + auto-memory, move plan, tag, release

**Files:**

- Modify: `package.json`
- Modify: `CLAUDE.md`
- Modify: `~/.claude/projects/-media-Data-Source-Verbara-Verbara-Platform-Web/memory/MEMORY.md`
- Modify: `~/.claude/projects/-media-Data-Source-Verbara-Verbara-Platform-Web/memory/project_current_position.md`
- Move: `docs/plans/active/2026-05-08-track-5c-a11y*.md` → `docs/plans/completed/`

- [ ] **Step 1: Bump version**

In `package.json`, change `"version": "2.0.3"` to `"version": "2.0.4"`.

- [ ] **Step 2: Update CLAUDE.md**

Edit `Verbara.Platform.Web/CLAUDE.md`:

- Update the version-summary line to "Version 2.0.4 (Nivel 5 Track 5C-a11y done)"
- Update the test count to whatever the new total is (≥897)
- Update "Next:" line to point to Track 5C-export or 5D (whichever is next per roadmap)

- [ ] **Step 3: Update auto-memory**

Edit:

- `~/.claude/projects/-media-Data-Source-Verbara-Verbara-Platform-Web/memory/project_current_position.md` — mark Track 5C-a11y DONE; update Next.
- `~/.claude/projects/-media-Data-Source-Verbara-Verbara-Platform-Web/memory/MEMORY.md` — update the Current Position one-liner; add a roadmap line for Track 5C-a11y closure.

- [ ] **Step 4: Move plan files to completed/**

```bash
git mv docs/plans/active/2026-05-08-track-5c-a11y.md docs/plans/completed/
git mv docs/plans/active/2026-05-08-track-5c-a11y-plan.md docs/plans/completed/
```

- [ ] **Step 5: Run final full verification**

```bash
npm run lint && npx vitest run && npm run build && npx playwright test tests/e2e/tests/a11y/
```

Expected: all pass.

- [ ] **Step 6: Commit closure**

```bash
git add package.json CLAUDE.md docs/plans/completed/
git commit -m "chore: close Track 5C-a11y (v2.0.4-web)

Track 5C-a11y summary:
- 3 new primitives: <SkipLink>, <LiveRegion>, <FieldError>
- 3 new hooks: useFieldA11y, useDocumentTitle, useHtmlLang
- <Label required> enhancement
- eslint-plugin-jsx-a11y at error level (CI gate)
- @axe-core/playwright baseline E2E spec (6 routes)
- prefers-reduced-motion CSS block
- Button disabled contrast fix (replaces opacity-50)
- DataTable scope=col + search aria-label
- LoadingOverlay/Skeleton aria-busy
- Error boundaries role=alert + autoFocus
- Sonner i18n containerAriaLabel
- InboxPanel new-conversation LiveRegion announcer
- 8 Tier 1 forms migrated to useFieldA11y + FieldError + Label required
- Heading hierarchy fixes (page list)
- Search/utility input aria-label sweep
- routes-page drag handle aria-label
- mfa-verify OTP autoComplete=one-time-code

Deferred to 5C-a11y-followup:
- Agent tour keyboard nav, focus-after-route, Recharts alt text,
  DataTable row keyboard handler, notification badge announcement,
  toast.error politeness, ConfirmDialog→alertdialog,
  ErrorBoundary heading consistency, form-level error summary,
  Tier 2/3 form adoption (~78 remaining forms)."
```

- [ ] **Step 7: Tag**

```bash
git tag -a v2.0.4-web -m "Track 5C-a11y: WCAG 2.1 AA foundation

Primitives + hooks + lint gate + axe-core E2E + Tier 1 form coverage.
Deferred polish to 5C-a11y-followup."
```

- [ ] **Step 8: GitHub release (optional, requires gh auth)**

```bash
gh release create v2.0.4-web --title "v2.0.4-web — Track 5C-a11y" \
  --notes "WCAG 2.1 AA foundation. See commit body for full summary."
```

---

## Self-Review

**Spec coverage check** (against `2026-05-08-track-5c-a11y.md`):

| Spec requirement                                     | Task             |
| ---------------------------------------------------- | ---------------- |
| `<SkipLink>` primitive                               | Task 5           |
| `<LiveRegion>` primitive                             | Task 6           |
| `useDocumentTitle` hook + 4 layouts                  | Tasks 7, 8       |
| `eslint-plugin-jsx-a11y` (warn → fix → error)        | Tasks 1, 2, 3, 4 |
| `@axe-core/playwright` + baseline E2E                | Tasks 1, 13      |
| `prefers-reduced-motion` CSS                         | Task 10          |
| `Button` disabled contrast fix                       | Task 11          |
| `<html lang>` sync                                   | Task 12          |
| App-shell `<SkipLink>` + main id                     | Task 9           |
| `useFieldA11y` hook                                  | Task 15          |
| `<FieldError>` component                             | Task 16          |
| `<Label required>` enhancement                       | Task 17          |
| Tier 1 form adoption                                 | Task 18          |
| Form submit focus-on-error verification              | Task 19          |
| `DataTable scope="col"` + search aria-label          | Task 20          |
| `LoadingOverlay`/`Skeleton` aria-busy                | Task 21          |
| `ErrorBoundary` role+focus                           | Task 22          |
| `RouteErrorBoundary` role+focus                      | Task 23          |
| Sonner `containerAriaLabel`                          | Task 24          |
| InboxPanel announcer                                 | Task 25          |
| Heading hierarchy fixes                              | Task 26          |
| Search/utility input aria-labels                     | Task 27          |
| `roles-page.tsx` div→button                          | Task 28          |
| Drag handle aria-label                               | Task 29          |
| MFA OTP autoComplete + pattern                       | Task 30          |
| axe-core re-run after 5C.2                           | Task 31          |
| Version bump + CLAUDE.md + memory + completed/ + tag | Task 32          |

All spec items covered.

**Placeholder scan:** No `TBD`/`TODO`/`fill in details` strings. Each task has either complete code or a precise grep + edit command.

**Type consistency:** `useFieldA11y` returns `{ inputProps: {...}, errorId }`. The same shape is used in Task 18's pattern reference. `<FieldError>` props (`id`, `message`, `className`) match what Task 18's pattern passes. `<Label required>` matches Task 18's usage. `<SkipLink targetId>` matches Task 9's wiring. `<LiveRegion politeness>` matches Task 25's usage. All consistent.

**Risks tracked:**

- R1 (jsx-a11y cascade): Tasks 2, 3 implement the warn → fix → error rollout.
- R2 (Tier 1 vs Tier 2/3 form coverage): Task 18 explicitly limits to Tier 1; followup documented.
- R3 (disabled button contrast in dark mode): Task 11 Step 5 requires manual verification of both themes.
- R4 (reduced-motion `!important` global): Task 10 — block targets `animation-*` and `transition-*` only.
- R5 (axe-core hits authenticated routes): Tasks 13, 31 use existing auth fixtures.

**Done.**
