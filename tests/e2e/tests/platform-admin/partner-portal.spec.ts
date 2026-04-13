import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Partner Portal smoke tests.
 *
 * Platform admins do NOT hold partner:* permissions, so every partner route
 * must redirect them to /unauthorized. This proves the permission gates are
 * correctly wired without needing a partner-tenant fixture.
 *
 * TODO(v1.7.1): Add `partnerAdminPage` fixture once demo-reset.sh seeds a
 * partner tenant + partner admin user. Then expand these specs to cover full
 * CRUD flows (create customer, generate invoice, edit rate cards, etc.).
 */
test.describe('Partner Portal — Permission Gates', () => {
  const partnerRoutes = [
    '/admin/partner/customers',
    '/admin/partner/rate-cards',
    '/admin/partner/revenue',
    '/admin/partner/settings',
  ];

  for (const route of partnerRoutes) {
    test(`should redirect platform admin to /unauthorized at ${route}`, async ({
      platformAdminPage: page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/unauthorized/);
    });
  }

  test('should not render Partner Portal sidebar group for platform admin', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin/users');
    // Partner Portal group is permission-gated — it should be absent for
    // a platform admin without partner:customer:view.
    await expect(page.getByTestId('sidebar-group-partner-portal')).toHaveCount(0);
  });

  test('customer detail route should also be permission-gated', async ({
    platformAdminPage: page,
  }) => {
    await page.goto('/admin/partner/customers/some-customer');
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});
