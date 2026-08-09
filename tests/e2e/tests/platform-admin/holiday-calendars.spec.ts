import { test, expect } from '../../fixtures/auth.fixture';
import { ApiHelper } from '../../fixtures/api.fixture';
import { DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Holiday Calendars', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/admin/holiday-calendars');
  });

  test('should display holiday calendars page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('holiday-calendars-page')).toBeVisible();
    await expect(page.getByTestId('holiday-calendars-create-btn')).toBeVisible();
  });

  test('should create a calendar', async ({ demoAdminPage: page, demoApiContext }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Calendar ${Date.now()}`;

    await page.getByTestId('holiday-calendars-create-btn').click();
    await page.getByTestId('calendar-form-name').fill(name);
    await page.getByTestId('calendar-form-submit').click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).toBeVisible();

    const calendars = await api.listHolidayCalendars();
    const arr = Array.isArray(calendars) ? calendars : calendars.items || [];
    const created = arr.find((c: any) => c.name === name);
    if (created) await api.deleteHolidayCalendar(created.id);
  });

  test('should delete a calendar with 3s confirmation', async ({
    demoAdminPage: page,
    demoApiContext,
  }) => {
    const api = new ApiHelper(demoApiContext, DEMO_ADMIN.tenantId);
    const name = `E2E Cal Del ${Date.now()}`;

    const res = await api.createHolidayCalendar({ name });
    const created = await res.json();

    await page.reload();
    await page.getByTestId(`delete-calendar-${created.id}`).click();

    const confirmBtn = page.getByTestId('confirm-delete-btn');
    await expect(confirmBtn).toBeDisabled();
    await page.waitForTimeout(3500);
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();
    await page.waitForTimeout(600);

    await expect(page.getByText(name)).not.toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/admin/system');
    await page.getByTestId('sidebar-group-compliance').click();
    await page.getByTestId('sidebar-link-holiday-calendars').click();
    await expect(page).toHaveURL(/\/admin\/holiday-calendars/);
  });
});
