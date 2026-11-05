import type { APIRequestContext, Page, Response } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { API_BASE } from '../../helpers/credentials';

/**
 * The identity secret section of the WebChat page (change `webchat-visitor-identity-two-levels-web`,
 * task 7.2; requires Platform with #543). Set, rotate, revoke and turn off, each through the real
 * channel route, with the request's body read from the wire and the state read from `data-*`.
 *
 * The console writes the route in lower case and the contract in `WebChat`; Platform reads either, so
 * the path is compared without case.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- webchat/identity-secret-admin.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

const VIEW_TIMEOUT = 15_000;

const CHANNEL_PATH = '/api/v1/admin/channels/webchat';

interface ChannelBody {
  credentials: { key: string; isSet: boolean }[];
}

function isChannelPut(response: Response): boolean {
  return (
    response.request().method() === 'PUT' &&
    new URL(response.url()).pathname.toLowerCase() === CHANNEL_PATH
  );
}

/** The channel with no identity secret, whatever an earlier run left. */
async function clearSecret(api: APIRequestContext): Promise<void> {
  const cleared = await api.put(`${API_BASE}${CHANNEL_PATH}`, {
    data: {
      isActive: true,
      credentials: { identityTokenSecret: null, identityTokenSecretPrevious: null },
    },
  });
  expect(cleared.status(), 'clear the identity secret').toBe(200);
}

/** Runs the action that sends the PUT; returns the request's body and what the response says is set. */
async function putBy(
  page: Page,
  action: () => Promise<void>,
): Promise<{ sent: unknown; isSet: Record<string, boolean> }> {
  const put = page.waitForResponse(isChannelPut);
  await action();
  const response = await put;
  expect(response.status(), 'the channel PUT').toBe(200);
  const { credentials } = (await response.json()) as ChannelBody;
  return {
    sent: response.request().postDataJSON(),
    isSet: Object.fromEntries(credentials.map((c) => [c.key, c.isSet])),
  };
}

test.describe('WebChat identity secret (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform #543)',
  );

  test('an admin sets, rotates, revokes and turns off the secret', async ({
    demoAdminPage: page,
    demoApiContext,
  }) => {
    await clearSecret(demoApiContext);
    try {
      await page.goto('/admin/webchat');
      await waitForAppReady(page);

      const status = page.locator('[data-identity-secret-status]');
      const previous = page.locator('[data-identity-secret-previous]');
      const value = page.locator('[data-identity-secret-value]');
      const confirm = page.getByTestId('confirm-dialog-confirm');

      await expect(status).toHaveAttribute('data-identity-secret-status', 'not-configured', {
        timeout: VIEW_TIMEOUT,
      });
      await expect(previous).toHaveCount(0);

      // ── Set ─────────────────────────────────────────────────────────────────────────────
      await page.locator('[data-identity-secret-generate]').click();
      const firstValue = await value.inputValue();
      expect(firstValue, 'a generated value').toMatch(/^[\w-]{43}$/);
      const set = await putBy(page, () => page.locator('[data-identity-secret-save]').click());
      expect(set.sent).toEqual({
        isActive: true,
        credentials: { identityTokenSecret: firstValue },
      });
      expect(set.isSet.identityTokenSecret).toBe(true);
      expect(set.isSet.identityTokenSecretPrevious).toBe(false);
      await expect(status).toHaveAttribute('data-identity-secret-status', 'configured');
      await expect(value, 'the value leaves the page once saved').toHaveCount(0);
      await expect(previous).toHaveCount(0);

      // ── Rotate ──────────────────────────────────────────────────────────────────────────
      await page.locator('[data-identity-secret-generate]').click();
      const secondValue = await value.inputValue();
      expect(secondValue).not.toBe(firstValue);
      await page.locator('[data-identity-secret-save]').click();
      await expect(page.getByTestId('identity-secret-rotate-confirm')).toBeVisible();
      const rotated = await putBy(page, () => confirm.click());
      expect(rotated.sent).toEqual({
        isActive: true,
        credentials: { identityTokenSecret: secondValue },
      });
      expect(rotated.isSet.identityTokenSecretPrevious).toBe(true);
      await expect(status).toHaveAttribute('data-identity-secret-status', 'configured');
      await expect(previous).toBeVisible();
      await expect(value).toHaveCount(0);

      // ── Revoke ──────────────────────────────────────────────────────────────────────────
      await page.locator('[data-identity-secret-revoke]').click();
      await expect(page.getByTestId('identity-secret-revoke-confirm')).toBeVisible();
      const revoked = await putBy(page, () => confirm.click());
      expect(revoked.sent).toEqual({
        isActive: true,
        credentials: { identityTokenSecretPrevious: null },
      });
      expect(revoked.isSet.identityTokenSecret).toBe(true);
      expect(revoked.isSet.identityTokenSecretPrevious).toBe(false);
      await expect(status).toHaveAttribute('data-identity-secret-status', 'configured');
      await expect(previous).toHaveCount(0);

      // ── Turn off ────────────────────────────────────────────────────────────────────────
      await page.locator('[data-identity-secret-turn-off]').click();
      await expect(page.getByTestId('identity-secret-turn-off-confirm')).toBeVisible();
      const off = await putBy(page, () => confirm.click());
      expect(off.sent).toEqual({
        isActive: true,
        credentials: { identityTokenSecret: null, identityTokenSecretPrevious: null },
      });
      expect(off.isSet.identityTokenSecret).toBe(false);
      await expect(status).toHaveAttribute('data-identity-secret-status', 'not-configured');
    } finally {
      await clearSecret(demoApiContext);
    }
  });
});
