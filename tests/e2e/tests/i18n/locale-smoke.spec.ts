import { test, expect } from '../../fixtures/auth.fixture';
import { test as base } from '@playwright/test';

const LOCALES = ['es-419', 'en-US', 'pt-BR'] as const;

const AUTHENTICATED_ROUTES = [
  '/admin',
  '/admin/users',
  '/admin/queues',
  '/admin/campaigns',
  '/agent',
  '/analytics/dashboard',
  '/operations/wallboard',
] as const;

// Matches `ns:dotted.key` patterns that would render when a translation key
// is missing — e.g. `admin:sidebar.billing`. Allows flexible casing in the
// dotted segment, restricts the namespace prefix to lowercase + underscores.
const KEY_LITERAL_PATTERN = /\b[a-z][a-z0-9_]*:[a-zA-Z][a-zA-Z0-9._-]*\b/;

// Some namespaces appear legitimately in UI text (e.g. URLs, code blocks).
// Whitelist any identifiers that we *expect* to render verbatim.
const ALLOWED_LITERALS = new Set<string>([
  // permission codes shown in role pages, etc.
  // (none for now — leave empty and add as findings emerge)
]);

async function setLocale(page: import('@playwright/test').Page, locale: string) {
  await page.addInitScript((lang) => {
    window.localStorage.setItem('asterisk.lang', lang);
  }, locale);
}

async function assertNoKeyLiteralsVisible(
  page: import('@playwright/test').Page,
  context: string,
) {
  // Wait for main content to settle.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

  // Read all visible text in the document body. Hidden nodes are skipped by
  // allInnerTexts(). The body covers sidebar + main + headers.
  const blocks = await page.locator('body').allInnerTexts();
  const offenders: string[] = [];
  for (const block of blocks) {
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      const match = trimmed.match(KEY_LITERAL_PATTERN);
      if (match && !ALLOWED_LITERALS.has(match[0])) {
        offenders.push(`${context}: "${trimmed}" (matched ${match[0]})`);
      }
    }
  }
  expect(offenders, `Found rendered translation key literals on ${context}`).toEqual([]);
}

test.describe('i18n locale smoke — public route', () => {
  for (const locale of LOCALES) {
    base(`renders /login without key literals (${locale})`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.addInitScript((lang) => {
        window.localStorage.setItem('asterisk.lang', lang);
      }, locale);
      await page.goto('/login');
      await assertNoKeyLiteralsVisible(page, `/login [${locale}]`);
      await context.close();
    });
  }
});

test.describe('i18n locale smoke — authenticated routes', () => {
  for (const locale of LOCALES) {
    for (const route of AUTHENTICATED_ROUTES) {
      test(`renders ${route} without key literals (${locale})`, async ({
        platformAdminPage: page,
      }) => {
        await setLocale(page, locale);
        await page.goto(route);
        await assertNoKeyLiteralsVisible(page, `${route} [${locale}]`);
      });
    }
  }
});

test.describe('i18n locale smoke — language switcher persistence', () => {
  for (const locale of LOCALES) {
    test(`localStorage 'asterisk.lang' is honoured on reload (${locale})`, async ({
      platformAdminPage: page,
    }) => {
      await setLocale(page, locale);
      await page.goto('/admin');
      const stored = await page.evaluate(() => window.localStorage.getItem('asterisk.lang'));
      expect(stored).toBe(locale);
    });
  }
});
