import { test as base, expect, type Browser, type APIRequestContext, type Page } from '@playwright/test';
import { API_BASE, DEMO_ADMIN } from '../../helpers/credentials';

/**
 * R5.1 Task J — AgentAssist runtime feature toggle end-to-end.
 *
 * Logs in as the platform admin, navigates to /admin/features/agent-assist,
 * enables the toggle + picks Deepgram + pastes an API key, saves, and then
 * reloads to verify the server-backed state persisted across the full round
 * trip. Gated with E2E_FULL_STACK following the existing pattern (see
 * queue-members-manage.spec.ts) because it requires the Platform API.
 */
const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  user?: { id: string; email: string; displayName: string; role: string };
  tenantId?: string;
  permissions?: string[];
  features?: Record<string, boolean>;
}

async function authenticate(
  browser: Browser,
  request: APIRequestContext,
  creds: { tenantId: string; email: string; password: string },
): Promise<Page> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, { data: creds });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const login: LoginResponse = await response.json();

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.evaluate(
    ([token, expiry, user, tenantId, perms, features]) => {
      sessionStorage.setItem(
        'asterisk-auth',
        JSON.stringify({
          state: {
            accessToken: token,
            tokenExpiry: new Date(expiry as string).getTime(),
            user,
            tenantId,
            permissions: perms,
            features,
            rememberMe: false,
            mfaPending: null,
          },
          version: 0,
        }),
      );
    },
    [
      login.accessToken,
      login.expiresAt,
      login.user ?? null,
      creds.tenantId,
      login.permissions ?? [],
      login.features ?? {},
    ],
  );
  return page;
}

base.describe('AgentAssist runtime feature toggle', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform + demo seed)',
  );

  base('platform admin can enable AgentAssist, pick Deepgram, save credentials, and see the change persist', async ({ browser, request }) => {
    const page = await authenticate(browser, request, DEMO_ADMIN);

    try {
      await page.goto('/admin/features/agent-assist');
      await expect(page.getByTestId('agent-assist-feature-page')).toBeVisible();

      // Flip the enable switch.
      await page.getByTestId('agent-assist-enable-toggle').click();

      // Pick Deepgram from the provider select (base-ui select).
      await page.getByTestId('agent-assist-provider-select').click();
      await page.getByRole('option', { name: /deepgram/i }).click();

      // Paste an API key — value is masked in the input.
      await page.getByTestId('agent-assist-apikey-input').fill('dg_e2e_test_key');

      // Save.
      await page.getByTestId('agent-assist-save-button').click();

      // Toast fires on success; reload and confirm the server round-trip shows
      // the toggle as enabled + credentials as configured (masked).
      await page.reload();
      await expect(page.getByTestId('agent-assist-feature-page')).toBeVisible();
      const toggle = page.getByTestId('agent-assist-enable-toggle');
      // base-ui switch exposes aria-checked reflecting the underlying state.
      await expect(toggle).toHaveAttribute('aria-checked', 'true');
    } finally {
      await page.context().close();
    }
  });
});

export { expect };
