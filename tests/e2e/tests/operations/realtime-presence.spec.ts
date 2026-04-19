import { test as base, expect, type Page, type Browser, type APIRequestContext } from '@playwright/test';
import { API_BASE, DEMO_SUPERVISOR, DEMO_AGENT } from '../../helpers/credentials';

/**
 * Plan 32C Sprint 6 · T37 — Realtime presence
 *
 * Two browser contexts: a supervisor watching the agent-states page and an
 * agent driving state transitions from their own workspace. The supervisor's
 * table row should repaint within ~3s of every agent state change — driven by
 * SignalR `OnPresenceUpdated` broadcasts fanned out by PresenceFanoutService
 * (Pro 1.7.2-pro).
 *
 * These tests require the full stack (Platform API + demo seed + SignalR).
 * Run with `E2E_FULL_STACK=true npx playwright test`.
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
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: creds,
  });
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

base.describe('Realtime presence (SignalR fanout)', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform + Pro SignalR + demo seed)',
  );

  base('supervisor sees agent presence transition within 3s', async ({ browser, request }) => {
    const supervisorPage = await authenticate(browser, request, DEMO_SUPERVISOR);
    const agentPage = await authenticate(browser, request, DEMO_AGENT);

    try {
      await supervisorPage.goto('/operations/agents');
      await expect(supervisorPage.getByTestId('agent-states-table')).toBeVisible();

      const agentRow = supervisorPage
        .getByTestId('agent-states-table')
        .getByRole('row')
        .filter({ hasText: /demo agent/i });

      await expect(agentRow).toBeVisible();

      await agentPage.goto('/agent');

      // Agent toggles presence to Away via the in-app state selector.
      await agentPage.getByRole('button', { name: /available/i }).click();
      await agentPage.getByRole('menuitem', { name: /away/i }).click();

      // Supervisor should see the transition without refresh, via hub broadcast.
      await expect(agentRow.getByText(/away/i)).toBeVisible({ timeout: 3_000 });

      // Round trip: back to Available
      await agentPage.getByRole('button', { name: /away/i }).click();
      await agentPage.getByRole('menuitem', { name: /available/i }).click();

      await expect(agentRow.getByText(/available/i)).toBeVisible({ timeout: 3_000 });
    } finally {
      await supervisorPage.context().close();
      await agentPage.context().close();
    }
  });

  base('supervisor table clears presence when agent logs out', async ({ browser, request }) => {
    const supervisorPage = await authenticate(browser, request, DEMO_SUPERVISOR);
    const agentPage = await authenticate(browser, request, DEMO_AGENT);

    try {
      await supervisorPage.goto('/operations/agents');
      await agentPage.goto('/agent');

      const agentRow = supervisorPage
        .getByTestId('agent-states-table')
        .getByRole('row')
        .filter({ hasText: /demo agent/i });

      await expect(agentRow.getByText(/available/i)).toBeVisible({ timeout: 3_000 });

      // Close agent context — SignalR OnDisconnectedAsync fires the offline delta.
      await agentPage.context().close();

      await expect(agentRow.getByText(/offline/i)).toBeVisible({ timeout: 5_000 });
    } finally {
      await supervisorPage.context().close();
    }
  });
});

export { expect };
