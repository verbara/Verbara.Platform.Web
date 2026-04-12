import { test, expect } from '../../fixtures/auth.fixture';

test.describe('GDPR Data Management', () => {
  test.beforeEach(async ({ platformAdminPage: page }) => {
    await page.goto('/admin/gdpr');
  });

  test('should display GDPR page with export and purge sections', async ({
    platformAdminPage: page,
  }) => {
    // Verify export section is visible
    const exportInput = page.getByTestId('gdpr-export-contactId');
    await expect(exportInput).toBeVisible();
    const exportButton = page.getByTestId('gdpr-export-btn');
    await expect(exportButton).toBeVisible();

    // Verify purge section is visible
    const purgeInput = page.getByTestId('gdpr-purge-contactId');
    await expect(purgeInput).toBeVisible();
    const purgeButton = page.getByTestId('gdpr-purge-btn');
    await expect(purgeButton).toBeVisible();

    // Verify page header
    await expect(page.getByRole('heading', { name: /GDPR Data Management/i })).toBeVisible();
  });

  test('should disable export button when contact ID empty', async ({
    platformAdminPage: page,
  }) => {
    // Export button should be disabled when contact ID is empty (default state)
    const exportButton = page.getByTestId('gdpr-export-btn');
    await expect(exportButton).toBeDisabled();

    // Contact ID input should be empty by default
    const exportInput = page.getByTestId('gdpr-export-contactId');
    await expect(exportInput).toHaveValue('');
  });

  test('should enable export button with contact ID', async ({ platformAdminPage: page }) => {
    const exportInput = page.getByTestId('gdpr-export-contactId');
    const exportButton = page.getByTestId('gdpr-export-btn');

    // Initially disabled
    await expect(exportButton).toBeDisabled();

    // Fill contact ID
    await exportInput.fill('test-contact-123');

    // Button should now be enabled
    await expect(exportButton).not.toBeDisabled();
  });

  test('should validate purge reason minimum length', async ({ platformAdminPage: page }) => {
    const purgeContactInput = page.getByTestId('gdpr-purge-contactId');
    const purgeReasonInput = page.getByTestId('gdpr-purge-reason');
    const purgeButton = page.getByTestId('gdpr-purge-btn');

    // Fill contact ID
    await purgeContactInput.fill('test-contact');

    // Initially button should be disabled (no reason)
    await expect(purgeButton).toBeDisabled();

    // Fill reason with less than 10 characters
    await purgeReasonInput.fill('short');

    // Validation error should appear
    await expect(page.getByText(/at least 10 characters/i)).toBeVisible();

    // Button should remain disabled
    await expect(purgeButton).toBeDisabled();
  });

  test('should enable purge button with valid inputs', async ({ platformAdminPage: page }) => {
    const purgeContactInput = page.getByTestId('gdpr-purge-contactId');
    const purgeReasonInput = page.getByTestId('gdpr-purge-reason');
    const purgeButton = page.getByTestId('gdpr-purge-btn');

    // Fill contact ID
    await purgeContactInput.fill('test-contact');

    // Fill reason with sufficient length (>= 10 characters)
    await purgeReasonInput.fill('This is a valid reason for GDPR purge');

    // Validation error should disappear
    await expect(page.getByText(/at least 10 characters/i)).not.toBeVisible();

    // Button should now be enabled
    await expect(purgeButton).not.toBeDisabled();
  });

  test('should navigate via sidebar', async ({ platformAdminPage: page }) => {
    // Navigate to a different page first
    await page.goto('/admin/tenants');

    // Verify we're on a different page
    await expect(page).toHaveURL(/\/admin\/tenants/);

    // Wait for the sidebar to render before interacting with it. The
    // Compliance group collapses when the active route is elsewhere
    // (active-route locking keeps only the current group expanded), so we must
    // click its header to reveal the GDPR link. Using `isVisible()` without an
    // explicit wait races against the layout mount and silently no-ops.
    const complianceGroup = page.getByTestId('sidebar-group-compliance');
    await expect(complianceGroup).toBeVisible();

    const gdprLink = page.getByTestId('sidebar-link-gdpr');
    if (!(await gdprLink.isVisible())) {
      await complianceGroup.click();
      await expect(gdprLink).toBeVisible();
    }

    // Click GDPR link in sidebar
    await gdprLink.click();

    // Verify navigation
    await expect(page).toHaveURL(/\/admin\/gdpr/);
    await expect(page.getByTestId('gdpr-export-contactId')).toBeVisible();
  });

  test('should show user purge tab with userId input', async ({ platformAdminPage: page }) => {
    // Click the "By User" tab
    await page.getByText('By User').click();

    // Verify user purge fields are visible
    await expect(page.getByTestId('gdpr-purge-userId')).toBeVisible();
    await expect(page.getByTestId('gdpr-purge-userReason')).toBeVisible();
    await expect(page.getByTestId('gdpr-purge-user-btn')).toBeVisible();
    await expect(page.getByTestId('gdpr-preview-btn')).toBeVisible();
  });

  test('should disable user purge button when inputs empty', async ({ platformAdminPage: page }) => {
    await page.getByText('By User').click();

    // Button disabled by default
    await expect(page.getByTestId('gdpr-purge-user-btn')).toBeDisabled();

    // Fill userId only — still disabled (no reason)
    await page.getByTestId('gdpr-purge-userId').fill('test-user-123');
    await expect(page.getByTestId('gdpr-purge-user-btn')).toBeDisabled();

    // Fill short reason — still disabled
    await page.getByTestId('gdpr-purge-userReason').fill('short');
    await expect(page.getByTestId('gdpr-purge-user-btn')).toBeDisabled();

    // Fill valid reason (>= 10 chars) — enabled
    await page.getByTestId('gdpr-purge-userReason').fill('Valid reason for user data purge');
    await expect(page.getByTestId('gdpr-purge-user-btn')).toBeEnabled();
  });
});
