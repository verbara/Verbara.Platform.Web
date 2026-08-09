import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Skills', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/skills');
  });

  test('should display skills page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('skills-page')).toBeVisible();
    await expect(page.getByTestId('skills-create-btn')).toBeVisible();
  });

  test('should create a skill', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `e2e-skill-${Date.now()}`;

    await page.getByTestId('skills-create-btn').click();
    await page.getByTestId('skill-form-name').fill(name);
    await page.getByTestId('skill-form-category').fill('testing');
    await page.getByTestId('skill-form-submit').click();

    await expect(page.getByText(name)).toBeVisible();

    await api.deleteSkill(name);
  });

  test('should search skills', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `e2e-search-skill-${Date.now()}`;

    await api.createSkill({ name, category: 'testing' });
    await page.reload();

    await page.getByTestId('data-table-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    await api.deleteSkill(name);
  });

  test('should delete with browser confirm', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `e2e-delete-skill-${Date.now()}`;

    await api.createSkill({ name, category: 'testing' });
    await page.reload();

    page.once('dialog', (dialog) => dialog.accept());
    const deleted = page.waitForResponse(
      (r) => r.url().includes(`/admin/skills/${name}`) && r.request().method() === 'DELETE',
    );
    await page.getByTestId(`delete-skill-${name}`).click();

    // Assert the status, not just the disappearing row. useDeleteSkill invalidates ['skills'] only
    // in onSuccess, so a failing DELETE leaves the row on screen and the assertion below would
    // report "row still visible" for what is really a server error — which is how Platform's audit
    // 22P02 bug (the skill name reaching a ::jsonb cast unquoted) hid behind a UI symptom.
    expect((await deleted).status()).toBe(204);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-skills').click();
    await expect(page).toHaveURL(/\/admin\/skills/);
  });
});
