import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Skills', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/skills');
  });

  test('should display skills page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('skills-page')).toBeVisible();
    await expect(page.getByTestId('skills-create-btn')).toBeVisible();
  });

  test('should create a skill', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `e2e-skill-${Date.now()}`;

    await page.getByTestId('skills-create-btn').click();
    await page.getByTestId('skill-form-name').fill(name);
    await page.getByTestId('skill-form-category').fill('testing');
    await page.getByTestId('skill-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    await api.deleteSkill(name);
  });

  test('should search skills', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `e2e-search-skill-${Date.now()}`;

    await api.createSkill({ name, category: 'testing' });
    await page.reload();

    await page.getByTestId('data-table-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    await api.deleteSkill(name);
  });

  test('should delete with browser confirm', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `e2e-delete-skill-${Date.now()}`;

    await api.createSkill({ name, category: 'testing' });
    await page.reload();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId(`delete-skill-${name}`).click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-skills').click();
    await expect(page).toHaveURL(/\/admin\/skills/);
  });
});
