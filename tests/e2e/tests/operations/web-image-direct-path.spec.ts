import type { Response } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { API_BASE } from '../../helpers/credentials';

/**
 * The console served by the web image directly, the way the Helm chart serves it on Kubernetes:
 * the browser reaches the image's nginx, which proxies `/api/` to Platform.Api and `/hubs/` to
 * Realtime. Change `the-console-account-and-session-surfaces-match-the-api`, group 8: N20 (the
 * SignalR negotiate was answered `405 Not Allowed` by the image's static files) and H14 (the image
 * gzipped proxied JSON and so turned Platform's strong `ETag` into `W/"…"`).
 *
 * Requires the full lab stack (`docker/docker-compose.full.yml` with the lab override that shares
 * the JWT key pool with Realtime, as `auth/account-suspension.spec.ts` describes) and the web image
 * published on its own port, on the stack's network, next to the gateway. Run with
 * `E2E_FULL_STACK=true E2E_WEB_IMAGE_URL=http://localhost:<port> npm run e2e -- <this file>`.
 *
 * The image's log format (H21) is checked against `docker logs` by
 * `scripts/web-image/check-nginx.sh`, which a browser cannot see.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';
const WEB_IMAGE_URL = (process.env.E2E_WEB_IMAGE_URL ?? '').replace(/\/$/, '');

const NEGOTIATE_PATH = '/hubs/platform/negotiate';

/** The hub connects after the shell mounts, through negotiate and the WebSocket upgrade. */
const HUB_CONNECT_TIMEOUT = 15_000;

/**
 * The test's budget: one fixture sign-in, the shell's session restore through the image and one
 * hub connect. A budget, not a wait: every step is fenced on a response or an attribute.
 */
const TEST_BUDGET = 60_000;

function isNegotiate(response: Response): boolean {
  const url = new URL(response.url());
  return (
    response.request().method() === 'POST' &&
    url.origin === WEB_IMAGE_URL &&
    url.pathname === NEGOTIATE_PATH
  );
}

test.describe('Console served by the web image directly (full stack)', () => {
  test.skip(
    !SHOULD_RUN || WEB_IMAGE_URL === '',
    'requires E2E_FULL_STACK=true, the lab stack and E2E_WEB_IMAGE_URL (see above)',
  );

  test('the realtime hub connects through the web image instead of being refused with 405', async ({
    demoAdminPage: page,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const negotiate = page.waitForResponse(isNegotiate);
    await page.goto(`${WEB_IMAGE_URL}/`);
    await waitForAppReady(page);

    expect((await negotiate).status()).toBe(200);
    await expect(page.getByTestId('app-shell')).toHaveAttribute(
      'data-realtime-state',
      'connected',
      {
        timeout: HUB_CONNECT_TIMEOUT,
      },
    );
  });

  test("a user read through the web image keeps Platform's strong ETag, with and without gzip", async ({
    demoApiContext,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const list = await demoApiContext.get(`${API_BASE}/api/v1/admin/users`, {
      params: { page: '1', pageSize: '1' },
    });
    expect(list.status()).toBe(200);
    const { items } = (await list.json()) as { items: { id: string }[] };
    const userId = items[0]?.id;
    expect(userId, 'the demo tenant has at least one user').toBeTruthy();

    const direct = await demoApiContext.get(`${API_BASE}/api/v1/admin/users/${userId}`);
    const platformTag = direct.headers()['etag'];
    expect(platformTag, 'Platform answers the user with a strong ETag').toMatch(/^"/);

    for (const acceptEncoding of ['gzip', 'identity']) {
      const throughImage = await demoApiContext.get(
        `${WEB_IMAGE_URL}/api/v1/admin/users/${userId}`,
        { headers: { 'Accept-Encoding': acceptEncoding } },
      );
      expect(throughImage.status()).toBe(200);
      expect(throughImage.headers()['etag'], `Accept-Encoding: ${acceptEncoding}`).toBe(
        platformTag,
      );
      expect(throughImage.headers()['content-encoding'], `Accept-Encoding: ${acceptEncoding}`).toBe(
        undefined,
      );
    }
  });
});
