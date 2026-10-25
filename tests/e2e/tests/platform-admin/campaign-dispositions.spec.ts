import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Route } from '@playwright/test';
import { test, expect } from '../../fixtures/auth.fixture';

/**
 * The disposition dialog's do-not-call switch (Platform change
 * dialer-honours-dnc-callbacks-and-agent-dispositions, spec `campaign-console`, host design D6).
 * Campaign 11's routes are answered by `page.route` with the host fixtures verbatim
 * (`tests/fixtures/contracts/`): the detail, and a dispositions list holding the target code `DNC`
 * (`addsToDnc` true, `category` `"Failure"`). The update is captured, never sent to Platform.
 *
 * Needs the dev stack for the sign-in only. Selectors are `data-*` only; waits are `expect`
 * polling or `waitForRequest`.
 */

const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8')) as T;

const detail = readFixture<Record<string, unknown>>('campaign-detail.response.json');
const dncCode = readFixture<Record<string, unknown>>('disposition-code.target.response.json');
const updateContract = readFixture<Record<string, unknown>>(
  'disposition-code-update.target.request.json',
);

const json = (route: Route, body: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

test.describe('Campaign disposition do-not-call switch', () => {
  test.beforeEach(async ({ demoAdminPage: page }) => {
    await page.route('**/api/v1/admin/campaigns/11', (route) =>
      route.request().method() === 'GET' ? json(route, detail) : route.continue(),
    );
    await page.route('**/api/v1/admin/campaigns/11/dispositions', (route) =>
      json(route, [dncCode]),
    );
    await page.route('**/api/v1/admin/campaigns/11/dispositions/*', (route) =>
      json(route, dncCode),
    );
    await page.route('**/api/v1/admin/campaigns/11/contact-lists', (route) => json(route, []));
    await page.route('**/api/v1/admin/campaigns/11/callbacks', (route) => json(route, []));
    await page.goto('/admin/campaigns/11');
  });

  test('should mark the do-not-call code in the list', async ({ demoAdminPage: page }) => {
    const row = page.getByTestId(`disposition-row-${String(dncCode.id)}`);
    await expect(row.getByTestId('disposition-row-dnc')).toHaveAttribute('aria-checked', 'true');
  });

  test('should keep addsToDnc and send no code when only the label changes', async ({
    demoAdminPage: page,
  }) => {
    const row = page.getByTestId(`disposition-row-${String(dncCode.id)}`);
    await row.getByTestId('disposition-row-edit').click();

    const dncSwitch = page.getByTestId('disposition-dnc-switch');
    await expect(dncSwitch).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('disposition-label').fill('Never call again');

    const update = page.waitForRequest(
      (r) =>
        r.method() === 'PUT' &&
        new URL(r.url()).pathname ===
          `/api/v1/admin/campaigns/11/dispositions/${String(dncCode.id)}`,
    );
    await page.getByTestId('disposition-dialog-save').click();
    const body = (await update).postDataJSON() as Record<string, unknown>;

    expect(body).not.toHaveProperty('code');
    expect(body.addsToDnc).toBe(true);
    expect(body.isSuccess).toBeNull();
    for (const member of Object.keys(body)) expect(Object.keys(updateContract)).toContain(member);
  });
});
