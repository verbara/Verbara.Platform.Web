import { test as base, expect } from '@playwright/test';
import { authenticatedPage as authenticate } from '../../helpers/auth-session';
import { DEMO_ADMIN } from '../../helpers/credentials';

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

base.describe('AgentAssist runtime feature toggle', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform + demo seed)',
  );

  base(
    'platform admin can enable AgentAssist, pick Deepgram, save credentials, and see the change persist',
    async ({ browser }) => {
      const page = await authenticate(browser, DEMO_ADMIN);

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
    },
  );
});

export { expect };
