import { test as base, expect } from '@playwright/test';
import { authenticatedPage as authenticate } from '../../helpers/auth-session';
import { DEMO_ADMIN, PLATFORM_ADMIN } from '../../helpers/credentials';

/**
 * AgentAssist runtime feature toggle end-to-end, against a real Platform.
 *
 * The Platform-tenant administrator opens /admin/features/agent-assist, sees Deepgram as the only
 * provider offered (`agent-assist-feature.v2.json` `liveProviders`), enables it with an API key and
 * saves; the spec waits for the PUT to answer 200 before reloading, then reads the refetched GET
 * (deepgram, credentials configured) and the restored form. A customer-tenant administrator
 * (`demo`) is not reported `features:agent-assist:manage`, so the route sends it to /unauthorized.
 * Gated with E2E_FULL_STACK because it needs the Platform API and the demo seed.
 */
const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';
const FEATURE_ROUTE = '/api/v1/admin/features/agent-assist';

const isFeatureCall = (method: string) => (r: { url(): string; request(): { method(): string } }) =>
  new URL(r.url()).pathname === FEATURE_ROUTE && r.request().method() === method;

base.describe('AgentAssist runtime feature toggle', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform + demo seed)',
  );

  base(
    'platform admin sees Deepgram only, saves it, and the refetched state persists',
    async ({ browser }) => {
      const page = await authenticate(browser, PLATFORM_ADMIN);

      try {
        await page.goto('/admin/features/agent-assist');
        await expect(page.getByTestId('agent-assist-feature-page')).toBeVisible();

        // Start from Agent Assist switched off, whatever an earlier run stored.
        const toggle = page.getByTestId('agent-assist-enable-toggle');
        if ((await toggle.getAttribute('aria-checked')) === 'true') {
          await toggle.click();
          const off = page.waitForResponse(isFeatureCall('PUT'));
          await page.getByTestId('agent-assist-save-button').click();
          expect((await off).status()).toBe(200);
          await expect(page.getByTestId('agent-assist-save-button')).toBeDisabled();
        }
        await expect(toggle).toHaveAttribute('aria-checked', 'false');

        await toggle.click();

        // The selector offers exactly the live providers.
        await page.getByTestId('agent-assist-provider-select').click();
        const options = page.getByRole('option');
        await expect(options).toHaveCount(1);
        await expect(options.first()).toHaveAttribute('data-provider', 'deepgram');
        await page.getByTestId('agent-assist-provider-option-deepgram').click();
        await expect(page.getByTestId('agent-assist-provider-select')).toHaveAttribute(
          'data-selected-provider',
          'deepgram',
        );

        await page.getByTestId('agent-assist-apikey-input').fill('dg_e2e_test_key');

        // Save, and wait for Platform's answer (and the GET the save invalidates) before reloading.
        const saved = page.waitForResponse(isFeatureCall('PUT'));
        const refetched = page.waitForResponse(isFeatureCall('GET'));
        await page.getByTestId('agent-assist-save-button').click();
        const put = await saved;
        expect(put.status()).toBe(200);
        expect(put.request().postDataJSON()).toEqual({
          enabled: true,
          provider: 'deepgram',
          credentials: { apiKey: 'dg_e2e_test_key' },
        });
        const get = await refetched;
        expect(get.status()).toBe(200);
        const body = (await get.json()) as Record<string, unknown>;
        expect(body.enabled).toBe(true);
        expect(body.provider).toBe('deepgram');
        expect(body.credentialsConfigured).toBe(true);

        // Reload: the stored state comes back from Platform and the form shows it.
        const reloaded = page.waitForResponse(isFeatureCall('GET'));
        await page.reload();
        expect((await reloaded).status()).toBe(200);
        await expect(page.getByTestId('agent-assist-feature-page')).toBeVisible();
        await expect(page.getByTestId('agent-assist-enable-toggle')).toHaveAttribute(
          'aria-checked',
          'true',
        );
        await expect(page.getByTestId('agent-assist-provider-select')).toHaveAttribute(
          'data-selected-provider',
          'deepgram',
        );
        await expect(page.getByTestId('agent-assist-provider-not-live')).toHaveCount(0);
        await expect(page.getByTestId('agent-assist-updated-by')).toBeVisible();
      } finally {
        await page.context().close();
      }
    },
  );

  base('customer-tenant admin is not offered the deployment-wide settings', async ({ browser }) => {
    const page = await authenticate(browser, DEMO_ADMIN);

    try {
      await page.goto('/admin/features/agent-assist');
      await expect(page).toHaveURL(/\/unauthorized/);
      await expect(page.getByTestId('agent-assist-feature-page')).toHaveCount(0);
    } finally {
      await page.context().close();
    }
  });
});

export { expect };
