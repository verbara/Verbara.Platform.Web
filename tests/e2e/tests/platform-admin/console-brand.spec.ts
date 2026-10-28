import { test, expect } from '@playwright/test';
import { establishSession, waitForAppReady } from '../../helpers/auth-session';
import { createBrandTenant, removeBrandTenant, type BrandTenant } from '../../helpers/brand-tenant';

/**
 * The signed-in console's brand (OpenSpec change `licensee-branding-in-the-console`, design D4/D5):
 * a user of a disposable branded tenant signs in and the shell paints that tenant's brand. The
 * shared `platform` and `demo` tenants are never branded here; `afterAll` proves they are untouched.
 */
test.describe('Console - tenant brand', () => {
  let tenant: BrandTenant | undefined;

  test.beforeAll(async ({ playwright }) => {
    tenant = await createBrandTenant(playwright);
  });

  test.afterAll(async () => {
    await removeBrandTenant(tenant);
  });

  test('Console_ShouldPaintTheTenantBrand_WhenATenantUserSignsIn', async ({ browser }) => {
    if (!tenant) throw new Error('beforeAll did not create the brand tenant');
    const context = await browser.newContext();
    try {
      await establishSession(context, {
        tenantId: tenant.tenantId,
        email: tenant.user.email,
        password: tenant.user.password,
      });
      const page = await context.newPage();
      await page.goto('/');
      await waitForAppReady(page);

      const mark = page.getByTestId('rail-brand-mark');
      await expect(mark).toHaveAttribute('aria-label', tenant.displayName);
      await expect(mark.locator('img')).toHaveAttribute('src', tenant.logoUrl);
      await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', tenant.faviconUrl);
      await expect(page).toHaveTitle(
        new RegExp(` · ${tenant.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · Verbara$`),
      );
    } finally {
      await context.close();
    }
  });
});
