import { test as base, type Page, type APIRequestContext } from '@playwright/test';
import { API_BASE, PLATFORM_ADMIN, DEMO_ADMIN } from '../helpers/credentials';

interface LoginResult {
  accessToken: string;
  expiresAt: string;
  user?: { id: string; email: string; displayName: string; role: string };
  tenantId?: string;
  permissions?: string[];
  features?: Record<string, boolean>;
}

async function loginViaApi(
  request: APIRequestContext,
  creds: { tenantId: string; email: string; password: string },
): Promise<LoginResult> {
  const response = await request.post(`${API_BASE}/api/auth/login`, {
    data: {
      tenantId: creds.tenantId,
      email: creds.email,
      password: creds.password,
    },
  });
  if (!response.ok()) {
    throw new Error(`Login failed for ${creds.email}: ${response.status()}`);
  }
  return response.json();
}

function buildAuthState(loginResult: LoginResult, tenantId: string) {
  return JSON.stringify({
    state: {
      accessToken: loginResult.accessToken,
      tokenExpiry: new Date(loginResult.expiresAt).getTime(),
      user: loginResult.user ?? null,
      tenantId,
      permissions: loginResult.permissions ?? [],
      features: loginResult.features ?? {},
      rememberMe: false,
      mfaPending: null,
    },
    version: 0,
  });
}

async function createAuthenticatedPage(
  browser: Parameters<Parameters<typeof base.extend>[0]['platformAdminPage']>[0]['browser'],
  request: APIRequestContext,
  creds: { tenantId: string; email: string; password: string },
): Promise<Page> {
  const loginResult = await loginViaApi(request, creds);
  const authState = buildAuthState(loginResult, creds.tenantId);
  const context = await browser.newContext();
  const page = await context.newPage();
  // Navigate first to set origin, then inject into sessionStorage
  await page.goto('/login');
  await page.evaluate((state) => {
    sessionStorage.setItem('asterisk-auth', state);
  }, authState);
  return page;
}

type AuthFixtures = {
  platformAdminPage: Page;
  demoAdminPage: Page;
  authenticatedApiContext: APIRequestContext;
};

export const test = base.extend<AuthFixtures>({
  platformAdminPage: async ({ browser, request }, use) => {
    const page = await createAuthenticatedPage(browser, request, PLATFORM_ADMIN);
    await use(page);
    await page.context().close();
  },

  demoAdminPage: async ({ browser, request }, use) => {
    const page = await createAuthenticatedPage(browser, request, DEMO_ADMIN);
    await use(page);
    await page.context().close();
  },

  authenticatedApiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext();
    const loginResult = await loginViaApi(ctx, PLATFORM_ADMIN);
    const authedCtx = await playwright.request.newContext({
      extraHTTPHeaders: {
        Authorization: `Bearer ${loginResult.accessToken}`,
        'X-Tenant-Id': PLATFORM_ADMIN.tenantId,
      },
    });
    await use(authedCtx);
    await authedCtx.dispose();
    await ctx.dispose();
  },
});

export { expect } from '@playwright/test';
