import { test as base, expect } from '@playwright/test';
import { authenticatedPage as authenticate } from '../../helpers/auth-session';
import { DEMO_ADMIN } from '../../helpers/credentials';

/**
 * R5.1 Task I — queue-member management end-to-end.
 *
 * Logs in as demo admin, navigates to queue detail, adds an agent, pauses +
 * resumes, then removes. Requires the full docker-compose stack so the
 * Platform API backs /api/v1/queues/{id}/members. Gated with E2E_FULL_STACK
 * following the existing pattern (see realtime-presence.spec.ts).
 */
const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

base.describe('Queue members (RESTful management)', () => {
  base.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform + demo seed)',
  );

  base('admin can add, pause, resume, and remove a queue member', async ({ browser }) => {
    const page = await authenticate(browser, DEMO_ADMIN);

    try {
      // Navigate to queues list, pick the first queue.
      await page.goto('/admin/queues');
      const firstRow = page.getByTestId('data-table').getByRole('row').nth(1);
      await expect(firstRow).toBeVisible();
      await firstRow.click();

      // Queue-detail renders the members card.
      await expect(page.getByTestId('queue-members-card')).toBeVisible();

      // Pick an available agent from the select and submit.
      await page.getByTestId('add-member-agent-select').click();
      await page.getByRole('option').first().click();
      await page.getByTestId('add-member-penalty-input').fill('3');
      await page.getByTestId('add-member-submit').click();

      // The members list should now show at least one row.
      const list = page.getByTestId('queue-members-list');
      await expect(list).toBeVisible({ timeout: 5_000 });
      const firstMember = list.locator('[data-testid^="queue-member-row-"]').first();
      await expect(firstMember).toBeVisible();

      // Pause — dialog opens with reason input.
      await firstMember.getByRole('button', { name: /pause/i }).click();
      await page.getByTestId('pause-reason-input').fill('E2E test');
      await page.getByTestId('confirm-dialog-confirm').click();

      // Paused badge appears on the row.
      await expect(firstMember.getByTestId('paused-badge')).toBeVisible({ timeout: 5_000 });

      // Resume — badge should disappear.
      await firstMember.getByRole('button', { name: /resume/i }).click();
      await expect(firstMember.getByTestId('paused-badge')).toHaveCount(0, { timeout: 5_000 });

      // Remove — confirm dialog → row is gone.
      await firstMember.getByRole('button', { name: /remove/i }).click();
      await page.getByTestId('confirm-dialog-confirm').click();
      await expect(firstMember).toHaveCount(0, { timeout: 5_000 });
    } finally {
      await page.context().close();
    }
  });
});

export { expect };
