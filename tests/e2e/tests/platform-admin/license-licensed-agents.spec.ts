import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Page, Request } from '@playwright/test';

import { test, expect } from '../../fixtures/auth.fixture';

/**
 * Licence page — tier and licensed agents (host change `licensed-agent-metering`, Web child).
 *
 * The status, peaks and export responses are stubbed from the host contract fixtures under
 * `tests/fixtures/contracts/` with `page.route`, so the spec needs the signed-in Platform admin of
 * the dev stack but no licensing data on it. Assertions use `data-*` selectors only, and wait
 * through `expect(...)` polling or `waitForRequest` / `waitForEvent` — never wall-clock waits.
 */

const CONTRACTS = resolve(process.cwd(), 'tests/fixtures/contracts');
const STATUS = readFileSync(resolve(CONTRACTS, 'license-status-snapshot.v1.json'), 'utf-8');
const PEAKS = readFileSync(resolve(CONTRACTS, 'licensed-agent-peaks.v1.json'), 'utf-8');
const EXPORT_BYTES = readFileSync(resolve(CONTRACTS, 'licensed-agent-export.v1.json'));

const PEAKS_URL = /\/api\/v1\/management\/licensing\/agents(\?|$)/;
const EXPORT_URL = /\/api\/v1\/management\/licensing\/agents\/export(\?|$)/;

function monthRange(offset: number): { value: string; from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return {
    value: `${start.getFullYear()}-${pad(start.getMonth() + 1)}`,
    from: day(start),
    to: day(end),
  };
}

async function stubLicensing(page: Page, peaks: string) {
  await page.route('**/api/v1/management/system/license/status', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: STATUS }),
  );
  await page.route(EXPORT_URL, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: EXPORT_BYTES }),
  );
  // Registered last so it is matched first; it leaves the export to the route above.
  await page.route(PEAKS_URL, (route) =>
    EXPORT_URL.test(route.request().url())
      ? route.fallback()
      : route.fulfill({ status: 200, contentType: 'application/json', body: peaks }),
  );
}

const isPeaksRequest = (from: string, to: string) => (request: Request) => {
  if (!PEAKS_URL.test(request.url()) || EXPORT_URL.test(request.url())) return false;
  const q = new URL(request.url()).searchParams;
  return q.get('from') === from && q.get('to') === to;
};

test.describe('Licence page — tier and licensed agents', () => {
  test('shows the tier and the peak-day breakdown, and the month drives peaks and export', async ({
    platformAdminPage: page,
  }) => {
    await stubLicensing(page, PEAKS);
    const current = monthRange(0);
    const previous = monthRange(1);

    const firstPeaks = page.waitForRequest(isPeaksRequest(current.from, current.to));
    await page.goto('/admin/license');
    await firstPeaks;

    await expect(page.getByTestId('license-tier-value')).toBeVisible();
    await expect(page.getByTestId('license-agents-card')).toBeVisible();
    await expect(page.getByTestId('license-agents-month-in-progress')).toBeVisible();
    await expect(page.getByTestId('license-agents-meter')).toHaveAttribute('aria-valuenow', '47');
    await expect(page.getByTestId('license-agents-peak-day')).toHaveAttribute(
      'data-day',
      '2026-09-17',
    );
    const rows = page.getByTestId('license-agents-tenant-breakdown').locator('tr[data-tenant-id]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-tenant-id', 'ten-acme');
    await expect(rows.nth(0)).toHaveAttribute('data-licensed-agents', '32');
    await expect(rows.nth(1)).toHaveAttribute('data-tenant-id', 'ten-globex');
    await expect(rows.nth(1)).toHaveAttribute('data-licensed-agents', '15');
    await expect(page.getByTestId('license-agents-advisory-banner')).toHaveCount(0);

    // A past month drives the peaks request, and the export carries the same month.
    const pastPeaks = page.waitForRequest(isPeaksRequest(previous.from, previous.to));
    await page.getByTestId('license-agents-month-select').click();
    await page.locator(`[role="option"][data-month="${previous.value}"]`).click();
    await pastPeaks;
    await expect(page.getByTestId('license-agents-month-in-progress')).toHaveCount(0);

    const exportRequest = page.waitForRequest((r) => EXPORT_URL.test(r.url()));
    const download = page.waitForEvent('download');
    await page.getByTestId('license-agents-export-button').click();
    const q = new URL((await exportRequest).url()).searchParams;
    expect(q.get('from')).toBe(previous.from);
    expect(q.get('to')).toBe(previous.to);

    const file = await download;
    expect(file.suggestedFilename()).toBe(`licensed-agents-${previous.from}-${previous.to}.json`);
    const saved = readFileSync(await file.path());
    expect(saved.equals(EXPORT_BYTES)).toBe(true);
  });

  test('shows the warning-only advisory banner when the peak is over the band', async ({
    platformAdminPage: page,
  }) => {
    const overBand = JSON.parse(PEAKS) as { deployment: { overBand: boolean } };
    overBand.deployment.overBand = true;
    await stubLicensing(page, JSON.stringify(overBand));

    await page.goto('/admin/license');

    await expect(page.getByTestId('license-agents-advisory-banner')).toBeVisible();
    await expect(page.getByTestId('license-agents-advisory-banner')).toHaveAttribute(
      'data-i18n-key',
      'admin:license.agents.advisory',
    );
    await expect(page.getByTestId('license-key-input')).toBeEnabled();
    await expect(page.getByTestId('license-agents-export-button')).toBeEnabled();
  });
});
