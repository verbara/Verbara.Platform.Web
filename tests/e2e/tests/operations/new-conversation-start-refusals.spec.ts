import type { APIRequestContext, Page } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { skipAgentTour } from '../../helpers/agent-tour';
import { authenticatedPage } from '../../helpers/auth-session';
import { idOf } from '../../helpers/conversation-routing';
import { API_BASE } from '../../helpers/credentials';

/**
 * The new-conversation dialog shows a refused start from Platform's machine code, never its text
 * (Platform v2.28.0, spec `agent-started-conversations`; console task 9.3). Every assertion on the
 * page reads `data-error-code` on `new-conv-error`, so the spec is locale-proof.
 *
 * The dialog offers only what `GET /api/v1/channels/available` lists, and the lab's real list holds
 * `WebChat` alone (`docker/demo/demo-reset.sh` activates nothing else; change
 * `agent-console-contract-debt`, host design H6, measured by WEB-LAB-04). These refusals need
 * `WhatsApp` and `Sms` on the screen, so that one read is intercepted and answers
 * `[{"channel":"WhatsApp"},{"channel":"WebChat"},{"channel":"Sms"}]` before the dialog opens. The list
 * is what the console offers, not a check on a start: every `POST /api/v1/conversations` stays real,
 * so each code below comes from the server.
 *
 * Against a real Platform (>= v2.28.0), an agent with an Agent profile starts with a message:
 *  - on WhatsApp, a contact that has only an SMS address: `contact-has-no-address` (400);
 *  - on SMS, the same contact: `channel-not-available` (409) — Platform registers no outbound SMS
 *    connector;
 *  - on WhatsApp, a contact with a WhatsApp address that never wrote to the tenant, with no template:
 *    `whatsapp-template-required` (409), and the dialog opens the template fields with the name
 *    focused;
 *  - the same start naming a template: WhatsApp is not active for the lab tenant, so the send is
 *    refused before any provider request and Platform answers `channel-send-failed` (502) — stored
 *    nothing. Activating WhatsApp in the lab may change this step (not measured).
 *
 * Every refusal is decided before anything is stored, so the spec leaves no conversation behind. It creates its own agent user, Agent profile and two
 * contacts through the API, and removes them. The seed's `demo-user-*` agents are linked to no user,
 * so a seeded agent would be refused `not-an-agent` before any of these checks.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- tests/e2e/tests/operations/new-conversation-start-refusals.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';
const PASSWORD = 'E2eStartRefusals!2026';

/** Two contacts, an agent, a sign-in and four starts. */
const TEST_BUDGET = 90_000;

const AVAILABLE_CHANNELS_PATH = '/api/v1/channels/available';

/** The list of H6, spelled as the fixture's `webRules.e2eRewrite` spells it. */
const INTERCEPTED_CHANNELS = [{ channel: 'WhatsApp' }, { channel: 'WebChat' }, { channel: 'Sms' }];

async function createContact(
  api: APIRequestContext,
  firstName: string,
  address: { channel: string; address: string },
): Promise<string> {
  const created = await api.post(`${API_BASE}/api/v1/contacts`, {
    data: { firstName, lastName: 'Start', addresses: [address] },
  });
  expect(created.status(), `create contact ${firstName}`).toBe(201);
  return idOf(((await created.json()) as { contactId: unknown }).contactId);
}

/** Answers the list's GET and nothing else: a POST to any route passes this by untouched. */
async function interceptChannelList(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === AVAILABLE_CHANNELS_PATH,
    (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: INTERCEPTED_CHANNELS })
        : route.continue(),
  );
}

/** Opens the dialog and waits for the list, so the channel field has its options. */
async function openDialog(page: Page): Promise<void> {
  const listed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === AVAILABLE_CHANNELS_PATH && r.ok(),
  );
  await page.getByTestId('new-conversation-btn').click();
  await listed;
  await expect(page.getByTestId('new-conv-channel-select')).toBeEnabled();
}

async function pickContact(page: Page, search: string, contactId: string): Promise<void> {
  const searched = page.waitForResponse(
    (r) => r.url().includes('/api/v1/contacts?') && r.request().method() === 'GET' && r.ok(),
  );
  await page.getByTestId('new-conv-contact-search').fill(search);
  await searched;
  await page.getByTestId(`new-conv-contact-option-${contactId}`).click();
}

async function pickChannel(page: Page, channel: string): Promise<void> {
  await page.getByTestId('new-conv-channel-select').click();
  await page.getByTestId(`new-conv-channel-option-${channel}`).click();
}

/** Submits the dialog and returns the start's request body, status and refusal code. */
async function submitStart(
  page: Page,
): Promise<{ request: Record<string, unknown>; status: number; code: string | undefined }> {
  const isStart = (url: string, method: string) =>
    new URL(url).pathname === '/api/v1/conversations' && method === 'POST';
  const request = page.waitForRequest((r) => isStart(r.url(), r.method()));
  const response = page.waitForResponse((r) => isStart(r.url(), r.request().method()));
  await page.getByTestId('new-conv-submit-btn').click();
  const answered = await response;
  const body = (await answered.json()) as { error?: string };
  return {
    request: (await request).postDataJSON() as Record<string, unknown>,
    status: answered.status(),
    code: body.error,
  };
}

test.describe('New conversation start refusals (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform >= v2.28.0)',
  );

  test('an agent sees each refused start by its code and is led to the WhatsApp template', async ({
    browser,
    demoApiContext,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const smsName = `S2Sms${stamp}`;
    const waName = `S2Wa${stamp}`;
    const smsContactId = await createContact(demoApiContext, smsName, {
      channel: 'Sms',
      address: `+1555${String(Date.now()).slice(-7)}`,
    });
    const waContactId = await createContact(demoApiContext, waName, {
      channel: 'WhatsApp',
      address: `+57301${String(Date.now()).slice(-7)}`,
    });

    const email = `e2e-start-refusals-${stamp}@demo.local`;
    const user = await demoApiContext.post(`${API_BASE}/api/v1/admin/users`, {
      data: { email, displayName: `E2E Start ${stamp}`, role: 'Agent', password: PASSWORD },
    });
    expect(user.status(), 'create agent user').toBe(201);
    const { id: userId } = (await user.json()) as { id: string };
    const profile = await demoApiContext.post(`${API_BASE}/api/v1/admin/agents`, {
      data: { userId, displayName: `E2E Start ${stamp}` },
    });
    expect(profile.status(), 'create agent profile').toBe(201);
    const agentId = idOf(((await profile.json()) as { agentId: unknown }).agentId);

    const page = await authenticatedPage(browser, { tenantId: 'demo', email, password: PASSWORD });
    try {
      await interceptChannelList(page);
      await page.goto('/agent');
      await waitForAppReady(page);
      await skipAgentTour(page);
      await openDialog(page);
      const error = page.getByTestId('new-conv-error');

      // ── WhatsApp to a contact with only an SMS address ─────────────────────────────────────
      await pickContact(page, smsName, smsContactId);
      await pickChannel(page, 'WhatsApp');
      await page.getByTestId('new-conv-message-input').fill(`hello ${stamp}`);
      const noAddress = await submitStart(page);
      expect(noAddress.request).toMatchObject({
        contactId: smsContactId,
        channel: 'WhatsApp',
        initialMessage: `hello ${stamp}`,
      });
      expect([noAddress.status, noAddress.code]).toEqual([400, 'contact-has-no-address']);
      await expect(error).toHaveAttribute('data-error-code', 'contact-has-no-address');

      // ── SMS, offered only by the intercepted list: the contact has the address, Platform has
      // no outbound connector, and the real POST says so ─────────────────────────────────────
      await pickChannel(page, 'Sms');
      await expect(error).toHaveCount(0);
      const notAvailable = await submitStart(page);
      expect(notAvailable.request).toMatchObject({ contactId: smsContactId, channel: 'Sms' });
      expect([notAvailable.status, notAvailable.code]).toEqual([409, 'channel-not-available']);
      await expect(error).toHaveAttribute('data-error-code', 'channel-not-available');

      // ── WhatsApp outside the 24-hour window, with no template ──────────────────────────────
      await page.getByTestId('new-conv-change-contact-btn').click();
      await pickContact(page, waName, waContactId);
      await pickChannel(page, 'WhatsApp');
      const templateName = page.getByTestId('new-conv-template-name');
      await expect(templateName).toHaveCount(0);
      const needsTemplate = await submitStart(page);
      expect(needsTemplate.request).not.toHaveProperty('templateName');
      expect([needsTemplate.status, needsTemplate.code]).toEqual([
        409,
        'whatsapp-template-required',
      ]);
      await expect(error).toHaveAttribute('data-error-code', 'whatsapp-template-required');
      await expect(templateName).toBeFocused();

      // ── The same start with a template: the send is refused, nothing is stored ─────────────
      await templateName.fill('hello_world');
      const sendFailed = await submitStart(page);
      expect(sendFailed.request).toMatchObject({
        contactId: waContactId,
        channel: 'WhatsApp',
        templateName: 'hello_world',
        templateLanguage: 'en_US',
      });
      expect([sendFailed.status, sendFailed.code]).toEqual([502, 'channel-send-failed']);
      await expect(error).toHaveAttribute('data-error-code', 'channel-send-failed');
      // A refusal keeps the dialog open on the agent's input.
      await expect(page.getByTestId('new-conversation-form')).toBeVisible();
    } finally {
      await page.context().close();
      // Best effort: every id is unique to this run.
      await demoApiContext.delete(`${API_BASE}/api/v1/admin/agents/${agentId}`).catch(() => {});
      await demoApiContext.delete(`${API_BASE}/api/v1/admin/users/${userId}`).catch(() => {});
      for (const contactId of [smsContactId, waContactId]) {
        await demoApiContext.delete(`${API_BASE}/api/v1/contacts/${contactId}`).catch(() => {});
      }
    }
  });
});
