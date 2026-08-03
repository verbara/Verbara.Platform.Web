import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { API_BASE } from './credentials';

/** The key the app persists its non-secret session slice under. */
export const AUTH_PERSIST_KEY = 'verbara-auth';

export interface LoginResult {
  accessToken: string;
  expiresAt: string;
  user?: { id: string; email: string; displayName: string; role: string };
  tenantId?: string;
  permissions?: string[];
  features?: Record<string, boolean>;
}

export interface Credentials {
  tenantId: string;
  email: string;
  password: string;
}

/**
 * Establishes an authenticated browser context the way the application actually supports it.
 *
 * The app does not read a token from browser storage — credentials are never persisted, and the
 * access token is minted at runtime from the httpOnly refresh cookie. So a fixture cannot fake a
 * session by writing a token; it has to obtain the real cookie and let the app restore from it.
 *
 * Two details make this work:
 *  - The login goes through `context.request`, which shares its cookie jar with the context's pages.
 *    A standalone `APIRequestContext` would keep the Set-Cookie out of the browser's reach — the
 *    reason the previous fixture resorted to injecting a token blob.
 *  - Cookies are scoped by host, not by port, so the cookie set via API_BASE (`localhost:5000`) is
 *    sent to the app under test (`localhost:80`).
 */
export async function establishSession(
  context: BrowserContext,
  creds: Credentials,
): Promise<LoginResult> {
  const response = await context.request.post(`${API_BASE}/api/v1/auth/login`, { data: creds });
  if (!response.ok()) {
    throw new Error(`Login failed for ${creds.email}: ${response.status()}`);
  }
  const login = (await response.json()) as LoginResult;

  const session = JSON.stringify({
    state: {
      user: login.user ?? null,
      tenantId: creds.tenantId,
      permissions: login.permissions ?? [],
      features: login.features ?? {},
      rememberMe: false,
      sessionIdleTimeoutMinutes: null,
    },
    version: 1,
  });

  // Seeded before any app script runs, so the first paint already knows a session is restorable.
  // The presence check keeps a reload inside a spec on the app's own state instead of clobbering it.
  await context.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, value);
    },
    [AUTH_PERSIST_KEY, session] as const,
  );

  return login;
}

/**
 * Waits until the guarded shell is mounted.
 *
 * Credentials are no longer persisted, so every navigation first lands on `AuthGuard`'s restoring
 * skeleton while the access token is re-minted from the refresh cookie. A test that acts in that
 * window sees a DOM without the shell: instantaneous actions (`keyboard.press`, `click`) hit
 * nothing, and assertions that scan the page can pass vacuously against the skeleton.
 *
 * Anchored on the shell's user menu, which renders only inside the guard, so this is a positive
 * signal that the restore finished — not a wall-clock wait.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.getByTestId('user-menu-trigger')).toBeVisible();
}

/** Convenience wrapper: a fresh context with an established session, plus its first page. */
export async function authenticatedPage(browser: Browser, creds: Credentials): Promise<Page> {
  const context = await browser.newContext();
  await establishSession(context, creds);
  const page = await context.newPage();

  // Land on a real origin before handing the page over. The seeding itself no longer needs a
  // navigation (addInitScript runs on the next one), but several specs read or patch
  // `sessionStorage` directly on the fixture-provided page, and doing that at about:blank throws
  // "SecurityError: Access is denied for this document". The previous fixture navigated as a side
  // effect of its seeding, so those specs silently depended on it.
  await page.goto('/login');
  return page;
}
