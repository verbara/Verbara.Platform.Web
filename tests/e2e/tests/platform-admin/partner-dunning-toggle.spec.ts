import { test, expect, grantPermissions } from '../../fixtures/auth.fixture';

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

    // Grant partner:customer:view so the route renders — see grantPermissions for why the auth
    // state alone is not enough now that every navigation restores through /auth/refresh.
    await grantPermissions(page, ['partner:customer:view']);

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
    //
    // Both must answer with a DunningRecordDto body, matching Pause/ResumeDunning's
    // `Ok<DunningRecordDto>`. The mock used to reply 200 with an EMPTY body, which customFetch
    // cannot parse (it only short-circuits on 204), so the mutation rejected, onSuccess never ran,
    // and the ['billing','dunning'] query was never invalidated — the toggle stayed on "active" and
    // a second click re-opened the pause dialog instead of resuming.
    const dunningRecord = (paused: boolean) =>
      JSON.stringify({
        dunningId: 'dun-1',
        tenantId,
        invoiceId: 'inv-42',
        currentStage: 'Phase1',
        startedAt: '2026-04-01T00:00:00Z',
        escalatedAt: null,
        resolvedAt: null,
        isPaused: paused,
        isActive: true,
      });

    await page.route(`**/api/v1/management/tenants/${tenantId}/dunning/pause`, async (route) => {
      pauseCalled += 1;
      isPaused = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: dunningRecord(true),
      });
    });
    await page.route(`**/api/v1/management/tenants/${tenantId}/dunning/resume`, async (route) => {
      resumeCalled += 1;
      isPaused = false;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: dunningRecord(false),
      });
    });

    await page.goto(`/admin/partner/customers/${tenantId}`);

    // Toggle visible alongside suspend.
    await expect(page.getByTestId('dunning-toggle')).toBeVisible();
    await expect(page.getByTestId('suspend-customer')).toBeVisible();

    // Pause cycle: click toggle, fill reason, confirm.
    await page.getByTestId('dunning-toggle').click();
    await page.getByTestId('dunning-reason-input').fill('Disputed invoice');
    await page.getByTestId('dunning-confirm').click();
    await expect.poll(() => pauseCalled).toBe(1);

    // Wait for the UI to reflect the pause before clicking again — which is what "updates UI state"
    // in this spec's title actually means, and was never asserted. handleDunningToggleClick branches
    // on the query's isPaused, so a click landing before the invalidation refetch re-opens the pause
    // dialog instead of resuming. aria-checked is the locale-proof signal on the switch.
    const toggle = page.getByTestId('dunning-toggle');
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    // Resume cycle: clicking again triggers resume (no reason required).
    await toggle.click();
    await expect.poll(() => resumeCalled).toBe(1);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  });
});
