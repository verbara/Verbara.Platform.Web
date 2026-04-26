import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Partner customer-detail dunning toggle smoke test (R5.3 Phase B B.2 / S4.2).
 *
 * No partner-admin fixture exists yet (see partner-portal.spec.ts TODO), so
 * we route-mock the dunning endpoints and inject `partner:customer:view` into
 * the platform-admin auth state. This exercises the new toggle UI end-to-end
 * without coupling the test to demo-reset.sh seeding.
 */
test.describe('Partner customer detail — dunning toggle', () => {
  test('pause + resume cycle updates UI state and calls correct endpoints', async ({
    platformAdminPage: page,
  }) => {
    const tenantId = 'tenant-acme';
    let pauseCalled = 0;
    let resumeCalled = 0;
    let isPaused = false;

    // Inject partner:customer:view into the auth state so the route renders.
    await page.evaluate(() => {
      const raw = sessionStorage.getItem('asterisk-auth');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        state: { permissions: string[]; [k: string]: unknown };
        version: number;
      };
      parsed.state.permissions = Array.from(
        new Set([...(parsed.state.permissions ?? []), 'partner:customer:view']),
      );
      sessionStorage.setItem('asterisk-auth', JSON.stringify(parsed));
    });

    // Customer endpoint — minimal payload required by the page.
    await page.route(`**/api/v1/partner/customers/${tenantId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenantId,
          name: 'Acme Corp',
          status: 'Active',
          plan: 'Enterprise',
          createdAt: '2026-04-01T00:00:00Z',
        }),
      });
    });

    // Dunning GET — reflect the toggling state across calls.
    await page.route(`**/api/v1/management/tenants/${tenantId}/dunning`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isActive: true,
          phase: 'Phase1',
          daysOverdue: 21,
          overdueAmount: 500,
          invoiceId: 'inv-42',
          isPaused,
        }),
      });
    });

    // Dunning pause/resume POSTs — count + flip state.
    await page.route(
      `**/api/v1/management/tenants/${tenantId}/dunning/pause`,
      async (route) => {
        pauseCalled += 1;
        isPaused = true;
        await route.fulfill({ status: 200, body: '' });
      },
    );
    await page.route(
      `**/api/v1/management/tenants/${tenantId}/dunning/resume`,
      async (route) => {
        resumeCalled += 1;
        isPaused = false;
        await route.fulfill({ status: 200, body: '' });
      },
    );

    await page.goto(`/admin/partner/customers/${tenantId}`);

    // Toggle visible alongside suspend.
    await expect(page.getByTestId('dunning-toggle')).toBeVisible();
    await expect(page.getByTestId('suspend-customer')).toBeVisible();

    // Pause cycle: click toggle, fill reason, confirm.
    await page.getByTestId('dunning-toggle').click();
    await page.getByTestId('dunning-reason-input').fill('Disputed invoice');
    await page.getByTestId('dunning-confirm').click();
    await expect.poll(() => pauseCalled).toBe(1);

    // Resume cycle: clicking again triggers resume (no reason required).
    await page.getByTestId('dunning-toggle').click();
    await expect.poll(() => resumeCalled).toBe(1);
  });
});
