import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';

test.describe('Surveys', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/surveys');
  });

  test('should display surveys page', async ({ platformAdminPage: page }) => {
    await expect(page.getByTestId('surveys-page')).toBeVisible();
    await expect(page.getByTestId('surveys-create-btn')).toBeVisible();
  });

  test('should create a survey', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Survey ${Date.now()}`;

    await page.getByTestId('surveys-create-btn').click();
    await page.getByTestId('survey-form-name').fill(name);

    // Select survey type
    await page.getByTestId('survey-form-type').click();
    const option = page.locator('[role="option"]').first();
    await option.waitFor();
    await option.click();

    await page.getByTestId('survey-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    const surveys = await api.listSurveys();
    const created = surveys.find((s: any) => s.name === name);
    if (created) await api.deleteSurvey(created.id);
  });

  test('should delete a survey with 3s confirmation', async ({ platformAdminPage: page, authenticatedApiContext }) => {
    const api = new ApiHelper(authenticatedApiContext);
    const name = `E2E Delete Survey ${Date.now()}`;

    const res = await api.createSurvey({ name, type: 'Csat', questions: [] });
    const created = await res.json();

    await page.reload();

    await page.getByTestId(`delete-survey-${created.id}`).click();

    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-communication').click();
    await page.getByTestId('sidebar-link-surveys').click();
    await expect(page).toHaveURL(/\/admin\/surveys/);
  });
});
