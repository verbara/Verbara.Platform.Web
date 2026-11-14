import { test, expect } from '../../fixtures/auth.fixture';
import { availability, qaListFixture, stubQaAvailability } from '../../helpers/qa-availability';

/**
 * QA Evaluations follow the availability read (host change qa-scores-are-produced-or-not-shown,
 * spec "The console does not present QA results that cannot exist"). The availability and the QA
 * list are stubbed from the host contract fixtures with `page.route`; assertions use `data-*`
 * selectors only and wait through `expect(...)` polling, never wall-clock waits.
 */
const QA_LIST_URL = /\/api\/v1\/analytics\/qa(\?|$)/;

test.describe('QA Evaluations — analysis not configured', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await stubQaAvailability(page, availability.noTranscriptSource());
  });

  test('the sidebar has no QA and no Speech Analytics entry', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/cdr');
    await expect(page.getByTestId('sidebar-link-cdr')).toBeVisible();
    await expect(page.getByTestId('sidebar-link-qa')).toHaveCount(0);
    await expect(page.getByTestId('sidebar-link-speech')).toHaveCount(0);
  });

  test('a bookmarked QA page names the reason and shows no table', async ({
    demoAdminPage: page,
  }) => {
    const listRequests: string[] = [];
    page.on('request', (req) => {
      if (QA_LIST_URL.test(req.url())) listRequests.push(req.url());
    });

    await page.goto('/analytics/qa');
    await expect(page.getByTestId('qa-unavailable')).toHaveAttribute(
      'data-reason',
      'not_configured',
    );
    await expect(page.getByTestId('qa-table')).toHaveCount(0);
    expect(listRequests).toEqual([]);
  });
});

test.describe('QA Evaluations — other reasons', () => {
  test('without the call analytics module the page says so', async ({ demoAdminPage: page }) => {
    await stubQaAvailability(page, availability.notLicensed());
    await page.goto('/analytics/qa');
    await expect(page.getByTestId('qa-unavailable')).toHaveAttribute('data-reason', 'not_licensed');
    await expect(page.getByTestId('qa-table')).toHaveCount(0);
  });

  test('without a scorecard the page says so and Speech Analytics stays', async ({
    demoAdminPage: page,
  }) => {
    await stubQaAvailability(page, availability.noScorecard());
    await page.goto('/analytics/qa');
    await expect(page.getByTestId('qa-unavailable')).toHaveAttribute('data-reason', 'no_scorecard');
    await expect(page.getByTestId('qa-table')).toHaveCount(0);
    await expect(page.getByTestId('sidebar-link-speech')).toBeVisible();
    await expect(page.getByTestId('sidebar-link-qa')).toHaveCount(0);
  });
});

test.describe('QA Evaluations — available', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await stubQaAvailability(page, availability.available());
    await page.route(QA_LIST_URL, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: qaListFixture() }),
    );
  });

  test('the list renders the fixture row and offers no queue filter', async ({
    demoAdminPage: page,
  }) => {
    await page.goto('/analytics/qa');
    await expect(page.getByTestId('qa-page')).toBeVisible();
    await expect(page.getByTestId('qa-table').locator('tbody tr')).toHaveCount(1);
    await expect(page.getByTestId('qa-page-next')).toBeDisabled();
    await expect(page.getByTestId('filter-queue')).toHaveCount(0);
    await expect(page.getByTestId('qa-unavailable')).toHaveCount(0);
  });

  test('the sidebar QA entry opens the page', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByTestId('sidebar-link-qa').click();
    await expect(page).toHaveURL(/\/analytics\/qa/);
    await expect(page.getByTestId('qa-table')).toBeVisible();
  });
});
