import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

/**
 * E2E for the two ADR-0009 Grupo A admin surfaces
 * (surface-agent-presence-admin-controls):
 *   A. Force-offline destructive action on the admin agent-detail view.
 *   B. `pendingPauseTimeoutMinutes` editor on the system auth-config page.
 *
 * Anti-flake posture (suite is workers:1, retries:1): selectors are
 * `data-testid` only (never text), and every assertion is `expect(...)` polling
 * or a `waitForResponse` on the real request — no `waitForTimeout`/wall-clock.
 */

test.describe('Agent presence admin controls', () => {
  test.describe('B. PendingPauseTimeoutMinutes editor', () => {
    test.beforeEach(async ({ platformAdminPage: page }) => {
      await page.goto('/admin/auth-config');
    });

    test('should display the deferred-pause timeout editor', async ({
      platformAdminPage: page,
    }) => {
      await expect(page.getByTestId('auth-config-pendingPauseTimeout')).toBeVisible();
    });

    test('should edit and persist the deferred-pause timeout via a partial PUT', async ({
      platformAdminPage: page,
      authenticatedApiContext,
    }) => {
      const api = new ApiHelper(authenticatedApiContext);
      const original = await api.getAuthConfig();

      const input = page.getByTestId('auth-config-pendingPauseTimeout');
      await input.clear();
      await input.fill('20');

      const putResponse = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/admin/auth/config') && r.request().method() === 'PUT' && r.ok(),
      );
      await page.getByTestId('auth-config-save').click();
      await putResponse;

      await page.reload();
      await expect(page.getByTestId('auth-config-pendingPauseTimeout')).toHaveValue('20');

      // Restore the tenant's original config so the run is idempotent.
      await api.updateAuthConfig(original);
    });

    test('should accept 0 (disables the timeout)', async ({ platformAdminPage: page }) => {
      const input = page.getByTestId('auth-config-pendingPauseTimeout');
      await input.clear();
      await input.fill('0');
      await expect(input).toHaveValue('0');
      // min={0} is allowed on this control (unlike the idle-timeout min={5}).
      await expect(input).toHaveAttribute('min', '0');
    });
  });

  test.describe('A. Force-offline action on agent detail', () => {
    test('should force an agent offline via the FORCE-word-gated dialog', async ({
      platformAdminPage: page,
    }) => {
      await page.goto('/admin/agents');

      // Skip gracefully when the seed carries no agent (mirrors agents.spec.ts).
      const firstRow = page.getByTestId('data-table').locator('tbody tr').first();
      const hasRow = await firstRow.isVisible().catch(() => false);
      test.skip(!hasRow, 'No agent in the seed to force offline.');

      await firstRow.click();
      await expect(page).toHaveURL(/\/admin\/agents\//);

      const trigger = page.getByTestId('agent-detail-force-offline');
      await expect(trigger).toBeVisible();
      await trigger.click();

      // Confirm button stays disabled until the exact word FORCE is typed.
      const confirmBtn = page.getByTestId('confirm-delete-btn');
      await expect(confirmBtn).toBeDisabled();

      // Enable session revocation, then confirm.
      await page.getByTestId('agent-detail-force-offline-revoke').click();
      await page.getByTestId('confirm-delete-word-input').fill('FORCE');
      await expect(confirmBtn).toBeEnabled();

      const forceResponse = page.waitForResponse(
        (r) =>
          /\/api\/v1\/admin\/agents\/[^/]+\/force-offline$/.test(r.url()) &&
          r.request().method() === 'POST',
      );
      await confirmBtn.click();
      const response = await forceResponse;

      // The request body carries revokeSessions verbatim (toggle was on).
      expect(response.request().postDataJSON()).toEqual({ revokeSessions: true });
    });
  });
});
