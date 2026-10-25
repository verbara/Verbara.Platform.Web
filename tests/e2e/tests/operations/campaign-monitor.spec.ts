import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from '../../fixtures/auth.fixture';

test.describe('Campaign Monitor', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/operations/campaigns');
  });

  test('should display campaign monitor page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('campaign-monitor-page')).toBeVisible();
  });

  test('should show filter buttons', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('campaign-monitor-filters')).toBeVisible();
    await expect(page.getByTestId('campaign-monitor-filter-all')).toBeVisible();
    await expect(page.getByTestId('campaign-monitor-filter-active')).toBeVisible();
    await expect(page.getByTestId('campaign-monitor-filter-paused')).toBeVisible();
  });

  test('should have "All" filter active by default', async ({ demoAdminPage: page }) => {
    const allButton = page.getByTestId('campaign-monitor-filter-all');
    await expect(allButton).toBeVisible();
    // The active filter uses variant="default" (solid), inactive uses variant="outline"
    // Default variant will NOT have the outline class patterns
    await expect(allButton).not.toHaveClass(/border-input/);
  });

  test('should show campaign cards section', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('campaign-monitor-cards')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/operations/wallboard');
    await page.getByTestId('sidebar-link-campaigns').click();
    await expect(page).toHaveURL(/\/operations\/campaigns/);
    await expect(page.getByTestId('campaign-monitor-page')).toBeVisible();
  });
});

/**
 * Web #460 (Platform change dialer-honours-dnc-callbacks-and-agent-dispositions, spec
 * `operations-campaign-monitor`): the monitor renders a campaign whose `status` is the enum name.
 * `GET /api/v1/operations/campaigns/metrics` is answered with the host fixture
 * `campaign-metrics-list.response.json` verbatim (`campaignId` 11, `status` `"Active"`) plus one
 * `"Paused"` item, so the spec needs a running campaign on no tenant; the sign-in is real.
 */
test.describe('Campaign Monitor with Platform enum statuses', () => {
  const metricsList = JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'tests/fixtures/contracts/campaign-metrics-list.response.json'),
      'utf-8',
    ),
  ) as Record<string, unknown>[];

  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.route('**/api/v1/operations/campaigns/metrics', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          ...metricsList,
          { ...metricsList[0], campaignId: 12, campaignName: 'Paused one', status: 'Paused' },
        ]),
      }),
    );
    await page.goto('/operations/campaigns');
  });

  test('should render an Active campaign with Pause and Stop', async ({ demoAdminPage: page }) => {
    const card = page.getByTestId('campaign-card-11');
    await expect(card).toBeVisible();
    await expect(card.getByTestId('campaign-card-status')).toBeVisible();
    await expect(card.getByTestId('campaign-card-pause')).toBeVisible();
    await expect(card.getByTestId('campaign-card-stop')).toBeVisible();
    await expect(card.getByTestId('campaign-card-resume')).toHaveCount(0);
  });

  test('should keep only the Paused campaign under the Paused filter', async ({
    demoAdminPage: page,
  }) => {
    await expect(page.getByTestId('campaign-card-12')).toBeVisible();
    await page.getByTestId('campaign-monitor-filter-paused').click();
    await expect(page.getByTestId('campaign-card-11')).toHaveCount(0);
    await expect(page.getByTestId('campaign-card-12')).toBeVisible();
    await expect(
      page.getByTestId('campaign-card-12').getByTestId('campaign-card-resume'),
    ).toBeVisible();
  });
});
