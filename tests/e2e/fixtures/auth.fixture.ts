import { test as base, type Page, type APIRequestContext } from '@playwright/test';
import { API_BASE, PLATFORM_ADMIN, DEMO_ADMIN } from '../helpers/credentials';
import { authenticatedPage, type Credentials, type LoginResult } from '../helpers/auth-session';

export { AUTH_PERSIST_KEY, grantPermissions, waitForAppReady } from '../helpers/auth-session';

type AuthFixtures = {
  platformAdminPage: Page;
  demoAdminPage: Page;
  authenticatedApiContext: APIRequestContext;
  demoApiContext: APIRequestContext;
};

/**
 * Builds a bearer-authenticated API context for the given credentials.
 *
 * Pure API context — no browser involved, so a bearer header is the right mechanism here and there
 * is no storage to seed.
 */
async function apiContextFor(
  playwright: { request: { newContext: (o?: object) => Promise<APIRequestContext> } },
  creds: Credentials,
): Promise<{ ctx: APIRequestContext; login: APIRequestContext }> {
  const login = await playwright.request.newContext();
  const response = await login.post(`${API_BASE}/api/v1/auth/login`, { data: creds });
  if (!response.ok()) {
    throw new Error(`Login failed for ${creds.email}: ${response.status()}`);
  }
  const loginResult = (await response.json()) as LoginResult;
  const ctx = await playwright.request.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${loginResult.accessToken}`,
      'X-Tenant-Id': creds.tenantId,
    },
  });
  return { ctx, login };
}

export const test = base.extend<AuthFixtures>({
  platformAdminPage: async ({ browser }, use) => {
    const page = await authenticatedPage(browser, PLATFORM_ADMIN);
    await use(page);
    await page.context().close();
  },

  demoAdminPage: async ({ browser }, use) => {
    const page = await authenticatedPage(browser, DEMO_ADMIN);
    await use(page);
    await page.context().close();
  },

  authenticatedApiContext: async ({ playwright }, use) => {
    const { ctx, login } = await apiContextFor(playwright, PLATFORM_ADMIN);
    await use(ctx);
    await ctx.dispose();
    await login.dispose();
  },

  // Operational endpoints (teams, queues, trunks, skills, …) are rejected with 409
  // `tenant-type-mismatch` on the Platform tenant — they exist only on Customer tenants. Specs that
  // exercise those surfaces must pair `demoAdminPage` with this context so page and API agree on
  // the tenant.
  demoApiContext: async ({ playwright }, use) => {
    const { ctx, login } = await apiContextFor(playwright, DEMO_ADMIN);
    await use(ctx);
    await ctx.dispose();
    await login.dispose();
  },
});

export { expect } from '@playwright/test';
