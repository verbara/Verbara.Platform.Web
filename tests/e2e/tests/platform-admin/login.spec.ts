import { test, expect } from '@playwright/test';
import { PLATFORM_ADMIN, DEMO_ADMIN } from '../../helpers/credentials';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login successfully as platform admin', async ({ page }) => {
    await page.getByTestId('login-email').fill(PLATFORM_ADMIN.email);
    await page.getByTestId('login-password').fill(PLATFORM_ADMIN.password);
    await page.getByTestId('login-submit').click();

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(PLATFORM_ADMIN.email)).toBeVisible();
  });

  test('should login successfully as demo admin', async ({ page }) => {
    await page.getByTestId('login-email').fill(DEMO_ADMIN.email);
    await page.getByTestId('login-password').fill(DEMO_ADMIN.password);
    await page.getByTestId('login-submit').click();

    await expect(page).not.toHaveURL(/\/login/);
  });

  test('should show error on wrong password', async ({ page }) => {
    await page.getByTestId('login-email').fill(PLATFORM_ADMIN.email);
    await page.getByTestId('login-password').fill('WrongPassword123!');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show error on nonexistent email', async ({ page }) => {
    await page.getByTestId('login-email').fill('nobody@nowhere.local');
    await page.getByTestId('login-password').fill('SomePassword123!');
    await page.getByTestId('login-submit').click();

    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should show validation on empty fields', async ({ page }) => {
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('should logout and redirect to login', async ({ page }) => {
    await page.getByTestId('login-email').fill(PLATFORM_ADMIN.email);
    await page.getByTestId('login-password').fill(PLATFORM_ADMIN.password);
    await page.getByTestId('login-submit').click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.getByRole('button', { name: /logout|sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/admin/tenants');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should redirect protected route to login when unauthenticated', async ({ page }) => {
    await page.goto('/admin/tenants');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should persist session after page reload', async ({ page }) => {
    await page.getByTestId('login-email').fill(PLATFORM_ADMIN.email);
    await page.getByTestId('login-password').fill(PLATFORM_ADMIN.password);
    await page.getByTestId('login-submit').click();
    await expect(page).not.toHaveURL(/\/login/);

    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
  });
});
