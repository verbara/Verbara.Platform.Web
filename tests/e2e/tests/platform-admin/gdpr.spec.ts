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

    // Expand compliance group in sidebar if needed
    const complianceGroup = page.getByTestId('sidebar-group-compliance');
    if (await complianceGroup.isVisible()) {
      // Group might be collapsed, click to expand
      const gdprLink = page.getByTestId('sidebar-link-gdpr');
      const isVisible = await gdprLink.isVisible().catch(() => false);
      if (!isVisible) {
        await complianceGroup.click();
      }
    }

    // Click GDPR link in sidebar
    await page.getByTestId('sidebar-link-gdpr').click();

    // Verify navigation
    await expect(page).toHaveURL(/\/admin\/gdpr/);
    await expect(page.getByTestId('gdpr-export-contactId')).toBeVisible();
  });
});
