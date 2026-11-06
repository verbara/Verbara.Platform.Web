import type { Page } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { idOf } from '../../helpers/conversation-routing';
import { API_BASE } from '../../helpers/credentials';

/**
 * The consent page records one channel's answer and shows it again after the save, against a real
 * Platform (spec `console-contact-writes`; host fixture `contact-channel-consent.v1.json`).
 *
 * The spec creates its own contact through the API, with no recorded consent, so every channel of
 * its sheet opens as "no record". It sets Email to "yes", saves, and reads the `PUT` the page sends:
 * `channelConsent` names Email alone, and Platform answers 200. The sheet reopened on the same page,
 * with no reload, shows Email as "yes". Every selector is a `data-*` attribute, so the spec is
 * locale-proof. The contact is deleted at the end.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- operations/consent-page.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/** The channel this spec records, as Platform names it. */
const CHANNEL = 'Email';

const isContactSearch = (url: string, method: string) =>
  new URL(url).pathname === '/api/v1/contacts' && method === 'GET';

/** Searches the page for `name` and waits for the search to answer and the one row to show. */
async function searchFor(page: Page, name: string): Promise<void> {
  const searched = page.waitForResponse(
    (r) =>
      isContactSearch(r.url(), r.request().method()) &&
      new URL(r.url()).searchParams.get('search') === name &&
      r.ok(),
  );
  await page.getByTestId('consent-search').fill(name);
  await searched;
  await expect(page.getByTestId('edit-consent-btn')).toHaveCount(1);
}

test.describe('Consent page (full stack)', () => {
  test.skip(!SHOULD_RUN, 'requires E2E_FULL_STACK=true with docker-compose.full.yml');
  test.describe.configure({ retries: 1 });

  test('an admin records one channel and sees it after the save', async ({
    demoAdminPage: page,
    demoApiContext,
  }) => {
    const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const firstName = `Consent${stamp}`;
    const created = await demoApiContext.post(`${API_BASE}/api/v1/contacts`, {
      data: {
        firstName,
        lastName: 'Page',
        addresses: [{ channel: 'Sms', address: `+1555${String(Date.now()).slice(-7)}` }],
      },
    });
    expect(created.status(), 'create the test contact').toBe(201);
    const contactId = idOf(((await created.json()) as { contactId: unknown }).contactId);

    try {
      await page.goto('/admin/consent');
      await waitForAppReady(page);
      await expect(page.getByTestId('consent-management-page')).toBeVisible();

      await searchFor(page, firstName);
      await page.getByTestId('edit-consent-btn').click();

      const trigger = page.getByTestId(`consent-channel-${CHANNEL}`);
      await expect(trigger).toHaveAttribute('data-consent', 'unrecorded');
      await trigger.click();
      await page.getByTestId(`consent-channel-${CHANNEL}-option-yes`).click();
      await expect(trigger).toHaveAttribute('data-consent', 'yes');

      const isSave = (url: string, method: string) =>
        new URL(url).pathname === `/api/v1/contacts/${contactId}` && method === 'PUT';
      const request = page.waitForRequest((r) => isSave(r.url(), r.method()));
      const response = page.waitForResponse((r) => isSave(r.url(), r.request().method()));
      // The save refreshes the page's search (design W10); the reopened sheet reads that answer.
      const refreshed = page.waitForResponse(
        (r) => isContactSearch(r.url(), r.request().method()) && r.ok(),
      );
      await page.getByTestId('consent-save-btn').click();

      const sent = (await request).postDataJSON() as { channelConsent?: unknown };
      expect(sent.channelConsent, 'the PUT names only the changed channel').toEqual({
        [CHANNEL]: true,
      });
      expect((await response).status(), 'the consent save').toBe(200);
      await refreshed;
      await expect(page.getByTestId('consent-save-btn')).toBeHidden();

      await expect(page.getByTestId(`channel-badge-${CHANNEL}`)).toHaveAttribute(
        'data-consent',
        'yes',
      );
      await page.getByTestId('edit-consent-btn').click();
      await expect(page.getByTestId(`consent-channel-${CHANNEL}`)).toHaveAttribute(
        'data-consent',
        'yes',
      );
    } finally {
      const contactDeleted = await demoApiContext.delete(
        `${API_BASE}/api/v1/contacts/${contactId}`,
      );
      expect(contactDeleted.status(), 'delete the test contact').toBe(204);
    }
  });
});
