import type { Page, Request, Response } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { authenticatedPage } from '../../helpers/auth-session';
import { API_BASE, DEMO_ADMIN } from '../../helpers/credentials';

/**
 * A stale edit of a user is refused, not reported as saved, and the page shows the other
 * administrator's change. Change `the-console-account-and-session-surfaces-match-the-api`, H14,
 * design D6, spec `user-account-status` ("A concurrent change is not overwritten").
 *
 * Two administrator contexts of the demo tenant open the same freshly created user. The first raises
 * the role and saves; the second, still holding the version it read, saves a status change. Platform
 * (>= v2.25.0) compares that `If-Match` strongly and answers 412; the console shows
 * `data-error-code="user-changed"`, never the saved toast, and reads the user again.
 *
 * Requires the full lab stack (Platform >= v2.25.0). Run with
 * `E2E_FULL_STACK=true npm run e2e -- tests/e2e/tests/platform-admin/user-concurrent-edit.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/**
 * The test's budget: one API sign-in, two browser sign-ins, two page loads and two saves. Every step
 * is fenced on a response or an attribute; this is a bound, not a wait.
 */
const TEST_BUDGET = 60_000;

function userPath(userId: string): string {
  return `/api/v1/admin/users/${userId}`;
}

function isUserRead(response: Response, userId: string): boolean {
  return (
    response.request().method() === 'GET' && new URL(response.url()).pathname === userPath(userId)
  );
}

function isUserUpdate(request: Request, userId: string): boolean {
  return request.method() === 'PUT' && new URL(request.url()).pathname === userPath(userId);
}

/** Opens the user's detail page, fenced on the read that carries the version the edit starts from. */
async function openUser(page: Page, userId: string): Promise<Response> {
  const read = page.waitForResponse((response) => isUserRead(response, userId));
  await page.goto(`/admin/users/${userId}`);
  await waitForAppReady(page);
  await expect(page.getByTestId('user-detail-page')).toBeVisible();
  return read;
}

/** Picks an option of one of the edit sheet's selects (`role` or `status`). */
async function choose(page: Page, field: 'role' | 'status', value: string): Promise<void> {
  await page.getByTestId(`user-form-${field}`).click();
  await page.getByTestId(`user-form-${field}-option-${value}`).click();
}

/** Saves the edit sheet and returns the `PUT` and its response. */
async function save(page: Page, userId: string): Promise<{ request: Request; response: Response }> {
  const update = page.waitForResponse((response) => isUserUpdate(response.request(), userId));
  await page.getByTestId('user-form-submit').click();
  const response = await update;
  return { request: response.request(), response };
}

test.describe('User concurrent edit (full stack)', () => {
  test.skip(!SHOULD_RUN, 'requires E2E_FULL_STACK=true and the lab stack (Platform >= v2.25.0)');

  test('a stale save is refused with user-changed and the page shows the first administrator role', async ({
    browser,
    demoAdminPage,
    demoApiContext,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const created = await demoApiContext.post(`${API_BASE}/api/v1/admin/users`, {
      data: {
        email: `e2e-concurrent-edit-${stamp}@demo.local`,
        displayName: `E2E Concurrent Edit ${stamp}`,
        role: 'Agent',
      },
    });
    expect(created.status()).toBe(201);
    const { id: userId } = (await created.json()) as { id: string };

    let secondPage: Page | undefined;
    try {
      // ── Both administrators open the same version of the user ───────────────────────────────
      const firstRead = await openUser(demoAdminPage, userId);
      secondPage = await authenticatedPage(browser, DEMO_ADMIN);
      const secondRead = await openUser(secondPage, userId);
      const readTag = await secondRead.headerValue('etag');
      expect(readTag, 'Platform sends a strong ETag through this path').toMatch(/^"/);
      expect(await firstRead.headerValue('etag')).toBe(readTag);
      await expect(secondPage.getByTestId('user-detail-role')).toHaveAttribute(
        'data-role',
        'agent',
      );

      // ── The first administrator raises the role and saves ───────────────────────────────────
      await demoAdminPage.getByTestId('user-edit-btn').click();
      await choose(demoAdminPage, 'role', 'Supervisor');
      await expect(demoAdminPage.getByTestId('user-form-role-hint')).toBeHidden();
      const first = await save(demoAdminPage, userId);
      expect(first.response.status()).toBe(200);
      expect(await first.request.headerValue('if-match')).toBe(readTag);
      await expect(demoAdminPage.getByTestId('user-detail-role')).toHaveAttribute(
        'data-role',
        'supervisor',
      );

      // ── The second administrator, still on the old version, saves a status change ───────────
      await secondPage.getByTestId('user-edit-btn').click();
      await choose(secondPage, 'status', 'Suspended');
      const second = await save(secondPage, userId);
      expect(await second.request.headerValue('if-match')).toBe(readTag);
      expect(second.response.status()).toBe(412);

      await expect(secondPage.locator('[data-error-code="user-changed"]')).toBeVisible();
      // Nothing was written, and the page read the user again: the first administrator's role.
      await expect(secondPage.getByTestId('user-detail-role')).toHaveAttribute(
        'data-role',
        'supervisor',
      );
      await expect(secondPage.getByTestId('user-status-badge')).toHaveAttribute(
        'data-status',
        'active',
      );
    } finally {
      await secondPage?.context().close();
      await demoApiContext.delete(`${API_BASE}${userPath(userId)}`);
    }
  });
});
