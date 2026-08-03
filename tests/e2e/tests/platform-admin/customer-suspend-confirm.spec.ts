import { test, expect, grantPermissions } from '../../fixtures/auth.fixture';

/**
 * Partner customer-detail suspend ConfirmDialog smoke test (R5.3 Phase B B.3 / S4.3).
 *
 * Wraps the existing suspend mutation in a confirm dialog gated by the customer
 * name word + a required reason textarea. The backend does not yet accept the
 * reason payload — flagged as B.3.b backend follow-up; the frontend collects
 * the reason locally and surfaces it in the success toast only.
 */
test.describe('Partner customer detail — suspend confirm dialog', () => {
  test('opens dialog, requires word + reason, and POSTs to suspend endpoint', async ({
    platformAdminPage: page,
  }) => {
    const tenantId = 'tenant-acme';
    let suspendCalled = 0;

    await grantPermissions(page, ['partner:customer:view']);

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

    await page.route(`**/api/v1/partner/customers/${tenantId}/suspend`, async (route) => {
      suspendCalled += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tenantId, status: 'Suspended' }),
      });
    });

    await page.goto(`/admin/partner/customers/${tenantId}`);

    // Suspend visible, dialog initially absent.
    await expect(page.getByTestId('suspend-customer')).toBeVisible();
    await expect(page.getByTestId('suspend-confirm-dialog')).toBeHidden();

    // Open dialog — submit disabled until word matches + reason filled.
    await page.getByTestId('suspend-customer').click();
    await expect(page.getByTestId('suspend-confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('suspend-confirm-submit')).toBeDisabled();

    // Type wrong word — still disabled.
    await page.getByTestId('suspend-confirm-word').fill('Wrong Name');
    await expect(page.getByTestId('suspend-confirm-submit')).toBeDisabled();

    // Type correct word — still disabled (reason missing).
    await page.getByTestId('suspend-confirm-word').fill('Acme Corp');
    await expect(page.getByTestId('suspend-confirm-submit')).toBeDisabled();

    // Fill reason — submit enabled.
    await page.getByTestId('suspend-confirm-reason').fill('Non-payment 30 days overdue');
    await expect(page.getByTestId('suspend-confirm-submit')).toBeEnabled();

    // Confirm — endpoint hit, dialog closes.
    await page.getByTestId('suspend-confirm-submit').click();
    await expect.poll(() => suspendCalled).toBe(1);
    await expect(page.getByTestId('suspend-confirm-dialog')).toBeHidden();
  });
});
