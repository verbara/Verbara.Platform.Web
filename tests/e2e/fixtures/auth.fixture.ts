import { test as base, type Page, type APIRequestContext } from '@playwright/test';
import { API_BASE, PLATFORM_ADMIN, DEMO_ADMIN } from '../helpers/credentials';
import * as fs from 'fs';
import * as path from 'path';

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

function buildStorageState(loginResult: LoginResult, tenantId: string) {
  return {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost',
        localStorage: [
          {
            name: 'asterisk-auth',
            value: JSON.stringify({
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
            }),
          },
        ],
      },
    ],
  };
}

type AuthFixtures = {
  platformAdminPage: Page;
  demoAdminPage: Page;
  authenticatedApiContext: APIRequestContext;
};

export const test = base.extend<AuthFixtures>({
  platformAdminPage: async ({ browser, request }, use) => {
    const loginResult = await loginViaApi(request, PLATFORM_ADMIN);
    const storageState = buildStorageState(loginResult, PLATFORM_ADMIN.tenantId);
    const storageFile = path.join(__dirname, '..', '.auth-platform-admin.json');
    fs.writeFileSync(storageFile, JSON.stringify(storageState));
    const context = await browser.newContext({ storageState: storageFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
    fs.unlinkSync(storageFile);
  },

  demoAdminPage: async ({ browser, request }, use) => {
    const loginResult = await loginViaApi(request, DEMO_ADMIN);
    const storageState = buildStorageState(loginResult, DEMO_ADMIN.tenantId);
    const storageFile = path.join(__dirname, '..', '.auth-demo-admin.json');
    fs.writeFileSync(storageFile, JSON.stringify(storageState));
    const context = await browser.newContext({ storageState: storageFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
    fs.unlinkSync(storageFile);
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
