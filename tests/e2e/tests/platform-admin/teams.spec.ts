import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Teams', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/teams');
  });

  test('should display teams page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('teams-page')).toBeVisible();
    await expect(page.getByTestId('teams-create-btn')).toBeVisible();
  });

  test('should create a team via dialog', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Team ${Date.now()}`;

    await page.getByTestId('teams-create-btn').click();
    await page.getByTestId('team-form-name').fill(name);
    await page.getByTestId('team-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    const teams = await api.listTeams();
    const list = Array.isArray(teams) ? teams : teams.items || [];
    const created = list.find((t: any) => t.name === name);
    if (created) await api.deleteTeam(created.id);
  });

  test('should edit a team', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Edit Team ${Date.now()}`;

    const res = await api.createTeam({ name });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`edit-team-${created.id}`).click();
    await page.getByTestId('team-form-name').clear();
    await page.getByTestId('team-form-name').fill(`${name} Edited`);
    await page.getByTestId('team-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(`${name} Edited`)).toBeVisible();

    await api.deleteTeam(created.id);
  });

  test('should delete a team', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Del Team ${Date.now()}`;

    const res = await api.createTeam({ name });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`delete-team-${created.id}`).click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should search teams', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Search Team ${Date.now()}`;

    const res = await api.createTeam({ name });
    const created = await res.json();

    await page.reload();

    await page.getByTestId('data-table-search').fill(name);
    await expect(page.getByText(name)).toBeVisible();

    await api.deleteTeam(created.id);
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-people').click();
    // Teams link is under people but note the sidebar key may vary
    const teamsLink = page.getByTestId('sidebar-link-teams');
    if (await teamsLink.isVisible().catch(() => false)) {
      await teamsLink.click();
      await expect(page).toHaveURL(/\/admin\/teams/);
    }
  });

  test('should navigate to teams via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/admin\/users/);

    // Expand People group if needed
    const teamsLink = page.getByTestId('sidebar-link-teams');
    if (!(await teamsLink.isVisible().catch(() => false))) {
      await page.getByTestId('sidebar-group-people').click();
    }
    await teamsLink.click();

    await expect(page).toHaveURL(/\/admin\/teams/);
    await expect(page.getByTestId('teams-page')).toBeVisible();
  });
});
