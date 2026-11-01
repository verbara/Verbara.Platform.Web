import type { Page, Response } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { skipAgentTour } from '../../helpers/agent-tour';
import { authenticatedPage } from '../../helpers/auth-session';
import { idOf } from '../../helpers/conversation-routing';
import { API_BASE } from '../../helpers/credentials';

/**
 * An Agent looks after its own account (change `agent-console-contract-debt`, spec
 * `console-account-security`, task 5.3). Nothing is intercepted.
 *
 *  1. The user menu takes an Agent to `/profile/security`, the page that used to refuse it.
 *  2. The form changes its password: `POST /api/v1/auth/change-password` answers 200.
 *  3. It signs out, the old password is refused, and the new one signs it in on `/agent`.
 *  4. From `/unauthorized`, "go home" lands on `/agent`: `/` would send it back through `/admin`.
 *
 * The spec creates one Agent user with its profile and removes both, because a password change on
 * `demo.agent@demo.local` would break every spec that signs in with it. The notification Platform
 * writes for the tenant's admins stays: no route deletes one.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- profile/agent-security-page.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/** One user and its profile, three sign-ins and a password change. A budget, not a wait. */
const TEST_BUDGET = 90_000;

/** The first paint of a lazy route, over the cold start of a fresh sign-in. */
const PAGE_TIMEOUT = 15_000;

const CHANGE_PASSWORD_PATH = '/api/v1/auth/change-password';
const LOGIN_PATH = '/api/v1/auth/login';

function isPost(response: Response, path: string): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === path;
}

/** Fills the login form and returns the sign-in response. */
async function signInThroughForm(page: Page, email: string, password: string): Promise<Response> {
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  const signIn = page.waitForResponse((response) => isPost(response, LOGIN_PATH));
  await page.getByTestId('login-submit').click();
  return signIn;
}

async function expectPath(page: Page, pathname: string): Promise<void> {
  await expect.poll(() => new URL(page.url()).pathname, { timeout: PAGE_TIMEOUT }).toBe(pathname);
}

test.describe('An Agent and its own security page (full stack)', () => {
  test.skip(!SHOULD_RUN, 'requires E2E_FULL_STACK=true with docker-compose.full.yml');

  test('an Agent changes its password from the user menu, signs in with it, and leaves /unauthorized for /agent', async ({
    browser,
    demoApiContext,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const displayName = `E2E Security ${stamp}`;
    const oldPassword = 'E2eSecurity!2026';
    const newPassword = 'E2eRotated!2026x';
    const account = {
      tenantId: 'demo',
      email: `e2e-security-${stamp}@demo.local`,
      password: oldPassword,
    };

    const user = await demoApiContext.post(`${API_BASE}/api/v1/admin/users`, {
      data: { email: account.email, displayName, role: 'Agent', password: oldPassword },
    });
    expect(user.status(), 'create user').toBe(201);
    const { id: userId } = (await user.json()) as { id: string };

    let agentId: string | undefined;
    let page: Page | undefined;
    try {
      const agent = await demoApiContext.post(`${API_BASE}/api/v1/admin/agents`, {
        data: { userId, displayName },
      });
      expect(agent.status(), 'create agent profile').toBe(201);
      agentId = idOf(((await agent.json()) as { agentId: unknown }).agentId);

      page = await authenticatedPage(browser, account);
      await page.goto('/agent');
      await waitForAppReady(page);
      await skipAgentTour(page);

      // ── The user menu reaches the page ──────────────────────────────────────────────────────
      await page.getByTestId('user-menu-trigger').click();
      await page.getByTestId('user-menu-security').click();
      await expect(page.getByTestId('security-page')).toBeVisible({ timeout: PAGE_TIMEOUT });
      await expectPath(page, '/profile/security');

      // ── The form changes the password ───────────────────────────────────────────────────────
      await page.getByTestId('security-password-old').fill(oldPassword);
      await page.getByTestId('security-password-new').fill(newPassword);
      await page.getByTestId('security-password-confirm').fill(newPassword);
      const changed = page.waitForResponse((response) => isPost(response, CHANGE_PASSWORD_PATH));
      await page.getByTestId('security-password-submit').click();
      expect((await changed).status()).toBe(200);

      // ── Only the new password signs in ──────────────────────────────────────────────────────
      await page.getByTestId('user-menu-trigger').click();
      await page.getByTestId('user-menu-logout').click();
      await expect(page.getByTestId('login-submit')).toBeVisible();
      // The field starts collapsed on a build that sets a default tenant, as the lab image does.
      const tenantField = page.getByTestId('login-tenant');
      if (await tenantField.isHidden()) await page.getByTestId('login-tenant-toggle').click();
      await tenantField.fill(account.tenantId);

      const refused = await signInThroughForm(page, account.email, oldPassword);
      expect(refused.status()).toBe(401);
      await expect(page.getByTestId('login-error')).toHaveAttribute(
        'data-error-code',
        'invalid-credentials',
      );

      const admitted = await signInThroughForm(page, account.email, newPassword);
      expect(admitted.status()).toBe(200);
      await waitForAppReady(page);
      // Sign-out left from this page, so the guard kept it as the page to return to.
      await expectPath(page, '/profile/security');

      // ── "Go home" leaves /unauthorized for the role's route, not for the loop ───────────────
      await page.goto('/unauthorized');
      await expect(page.getByTestId('unauthorized-page')).toBeVisible();
      await page.getByTestId('unauthorized-go-home').click();
      await waitForAppReady(page);
      await expectPath(page, '/agent');
    } finally {
      await page?.context().close();
      if (agentId) {
        await demoApiContext.delete(`${API_BASE}/api/v1/admin/agents/${agentId}`).catch(() => {});
      }
      await demoApiContext.delete(`${API_BASE}/api/v1/admin/users/${userId}`).catch(() => {});
    }
  });
});
