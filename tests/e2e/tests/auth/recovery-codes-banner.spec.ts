import type { Page, Response } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';

/**
 * The shell prompts a user whose recovery codes need regenerating, and a dismissal sticks (change
 * `sign-in-refusals-say-what-happened`, task 3.2).
 *
 * Against a real Platform session, with one answer patched: `GET /api/v1/users/me` is fetched from
 * Platform and fulfilled with `recoveryCodesNeedRegeneration: true`, as Platform answers while the
 * user holds recovery codes in a legacy family. The demo admin holds none, so the flag is injected
 * rather than arranged. Every assertion reads `data-*` attributes only.
 *
 * Requires the full lab stack (`docker/docker-compose.full.yml`). Run with
 * `E2E_FULL_STACK=true npm run e2e -- tests/auth/recovery-codes-banner.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

const USERS_ME_PATH = '/api/v1/users/me';

/** A fixture sign-in, two shell loads and their session restores; a budget, never a wait. */
const TEST_BUDGET = 60_000;

// users-me-recovery-flag.v1.json `legacyCodesHeld` (status, headers, body.recoveryCodesNeedRegeneration).
const LEGACY_CODES_HELD = {
  status: 200,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  recoveryCodesNeedRegeneration: true,
} as const;

function isUsersMe(response: Response): boolean {
  return (
    response.request().method() === 'GET' && new URL(response.url()).pathname === USERS_ME_PATH
  );
}

/**
 * Fulfils every `GET /users/me` with Platform's own answer plus the flag, so the rest of the body
 * (the signed-in user) stays genuine.
 */
async function flagRecoveryCodesForRegeneration(page: Page): Promise<void> {
  await page.route(`**${USERS_ME_PATH}`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const body = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      status: LEGACY_CODES_HELD.status,
      headers: LEGACY_CODES_HELD.headers,
      body: JSON.stringify({
        ...body,
        recoveryCodesNeedRegeneration: LEGACY_CODES_HELD.recoveryCodesNeedRegeneration,
      }),
    });
  });
}

test.describe('Recovery codes banner (full stack)', () => {
  test.skip(!SHOULD_RUN, 'requires E2E_FULL_STACK=true and docker-compose.full.yml');

  test('the banner is shown while /users/me reports recovery codes to regenerate, and stays gone after a dismissal and a reload', async ({
    demoAdminPage: page,
  }) => {
    test.setTimeout(TEST_BUDGET);
    await flagRecoveryCodesForRegeneration(page);

    const firstMe = page.waitForResponse(isUsersMe);
    await page.goto('/');
    await waitForAppReady(page);
    expect((await firstMe).status()).toBe(LEGACY_CODES_HELD.status);

    const banner = page.getByTestId('recovery-codes-banner');
    await expect(banner).toBeVisible();

    await page.getByTestId('recovery-codes-banner-dismiss').click();
    await expect(banner).toBeHidden();

    // After the reload the flag is still reported; the banner stays gone because of the dismissal.
    const reloadedMe = page.waitForResponse(isUsersMe);
    await page.reload();
    await waitForAppReady(page);
    const answer = await reloadedMe;
    expect(answer.status()).toBe(LEGACY_CODES_HELD.status);
    expect(
      ((await answer.json()) as { recoveryCodesNeedRegeneration?: boolean })
        .recoveryCodesNeedRegeneration,
    ).toBe(true);
    // The shell is ready (waitForAppReady) with the flag in hand and the dismissal is on record, so
    // the hidden check below does not pass merely because nothing has been drawn yet.
    await expect
      .poll(() =>
        page.evaluate(() =>
          Object.keys(window.localStorage).some(
            (k) =>
              k.startsWith('verbara.recoveryCodesBanner.dismissed:') &&
              window.localStorage.getItem(k) === '1',
          ),
        ),
      )
      .toBe(true);
    await expect(banner).toBeHidden();
  });
});
