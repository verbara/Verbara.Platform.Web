import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';

/**
 * CDR records — the list envelope, partial records and the error states (Web child
 * `cdr-list-reads-its-envelope`, task B.8).
 *
 * The list and detail responses are stubbed with `page.route` from the contract fixtures, which are
 * byte-identical to the host change's (`call-records-are-written-once`), so the spec needs the
 * signed-in demo admin of the dev stack but no call records on it. Assertions use `data-*`
 * selectors only and wait through `expect(...)` polling — never wall-clock waits, never
 * `toContainText` on dynamic content.
 */

const FIXTURES = resolve(process.cwd(), 'src/analytics/cdr/__fixtures__');
const fixture = (name: string) => readFileSync(resolve(FIXTURES, name), 'utf-8');

const LIST = fixture('cdr-list-response.v1.json');
const LIST_PARTIAL = fixture('cdr-list-response.partial.v1.json');
const LIST_EMPTY = fixture('cdr-list-response.empty.v1.json');

// The list is `/api/v1/analytics/cdr?…`; a detail is `/api/v1/analytics/cdr/{sessionId}`.
const LIST_URL = /\/api\/v1\/analytics\/cdr(\?|$)/;
const DETAIL_URL = /\/api\/v1\/analytics\/cdr\/[0-9a-f]{32}(\?|$)/;

const FIRST_ID = 'c7a1f0e25b6d4c3e9a8f1e2d3c4b5a69';
const SECOND_ID = '0b9e4d217c3a4f58b6e192d4a7c0f3e8';
const PARTIAL_ID = '5d2a8c419e074b3fa1c67f80e2d94b15';

async function stubList(page: Page, status: number, body = '') {
  await page.route(LIST_URL, (route) =>
    route.fulfill({ status, contentType: 'application/json', body }),
  );
}

/** A grid row by the sessionId it carries; the center container holds the scrolling cells. */
const gridRow = (page: Page, sessionId: string) =>
  page
    .getByTestId('cdr-table')
    .locator(`.ag-center-cols-container [data-session-id="${sessionId}"]`);

test.describe('CDR Records', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/cdr');
  });

  test('should display CDR page', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cdr-page')).toBeVisible();
  });

  test('should show CDR data table', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cdr-table')).toBeVisible();
  });

  test('should show export button', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cdr-export-btn')).toBeVisible();
  });

  test('should show pagination controls', async ({ demoAdminPage: page }) => {
    await expect(page.getByTestId('cdr-pagination')).toBeVisible();
  });

  test('should navigate via sidebar', async ({ demoAdminPage: page }) => {
    await page.goto('/analytics/dashboard');
    await page.getByTestId('sidebar-link-cdr').click();
    await expect(page).toHaveURL(/\/analytics\/cdr/);
    await expect(page.getByTestId('cdr-page')).toBeVisible();
  });
});

test.describe('CDR Records — contract fixtures', () => {
  // AG Grid virtualises columns: a column outside the horizontal viewport has no cell in the DOM.
  // At the default 1280px the grid's minimum widths (~1,650px) push `holdCount` off-screen, so its
  // cell — and `cdr-hold-unknown` — would be absent whatever the row says, and the zero-count check
  // below would pass vacuously. A viewport wide enough for every column renders every cell.
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.setViewportSize({ width: 2400, height: 900 });
  });

  test('renders one row per element of the list envelope', async ({ demoAdminPage: page }) => {
    await stubList(page, 200, LIST);
    await page.goto('/analytics/cdr');

    const rows = page
      .getByTestId('cdr-table')
      .locator('.ag-center-cols-container [data-session-id]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-session-id', FIRST_ID);
    await expect(rows.nth(1)).toHaveAttribute('data-session-id', SECOND_ID);
    // Complete records: both hold cells render, and neither is marked unknown.
    await expect(rows.locator('[col-id="holdCount"]')).toHaveCount(2);
    await expect(page.getByTestId('cdr-hold-unknown')).toHaveCount(0);
    await expect(page.getByTestId('cdr-empty-state')).toHaveCount(0);
    await expect(page.getByTestId('cdr-error-state')).toHaveCount(0);
  });

  test("marks a partial row's hold count as unknown", async ({ demoAdminPage: page }) => {
    await stubList(page, 200, LIST_PARTIAL);
    await page.goto('/analytics/cdr');

    const row = gridRow(page, PARTIAL_ID);
    await expect(row).toHaveCount(1);
    await expect(row.locator('[col-id="holdCount"]').getByTestId('cdr-hold-unknown')).toBeVisible();
  });

  test('shows the error state, not the empty state, when the list answers 500', async ({
    demoAdminPage: page,
  }) => {
    await stubList(page, 500);
    await page.goto('/analytics/cdr');

    await expect(page.getByTestId('cdr-error-state')).toBeVisible();
    await expect(page.getByTestId('cdr-empty-state')).toHaveCount(0);
  });

  test('shows the empty state, not the error state, for an empty page', async ({
    demoAdminPage: page,
  }) => {
    await stubList(page, 200, LIST_EMPTY);
    await page.goto('/analytics/cdr');

    await expect(page.getByTestId('cdr-empty-state')).toBeVisible();
    await expect(page.getByTestId('cdr-error-state')).toHaveCount(0);
  });

  test('shows the detail error state when the detail answers 404', async ({
    demoAdminPage: page,
  }) => {
    await stubList(page, 200, LIST);
    await page.route(DETAIL_URL, (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/analytics/cdr');

    const row = gridRow(page, FIRST_ID);
    await expect(row).toHaveCount(1);
    await row.locator('[col-id="contact"]').click();

    await expect(page.getByTestId('cdr-detail-error-state')).toBeVisible();
    await expect(page.getByTestId('cdr-detail-timeline-entry')).toHaveCount(0);
    await expect(page.getByTestId('cdr-detail-fields')).toHaveCount(0);
  });
});
