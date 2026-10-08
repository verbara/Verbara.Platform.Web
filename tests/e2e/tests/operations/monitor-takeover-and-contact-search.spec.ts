import { expect, test, type APIRequestContext } from '@playwright/test';
import { ApiHelper } from '../../fixtures/api.fixture';
import { authenticatedPage, waitForAppReady } from '../../helpers/auth-session';
import { API_BASE, DEMO_ADMIN } from '../../helpers/credentials';

/**
 * LAB-W1 N16 against a real Platform (v2.25.0 or later): the console reads Platform's own entities.
 *
 * An agent finds a contact through the new-conversation dialog's search and starts a conversation —
 * the option must be keyed by Platform's `contactId` and the request must carry it (before
 * 3.21.0-web the option was `new-conv-contact-option-undefined` and Platform answered 400). A
 * supervisor then opens that conversation's card in the digital monitor and takes it over — the card
 * must be keyed by Platform's `conversationId` and the takeover must post to it (before, it posted to
 * `/supervisor/conversations/undefined/takeover`).
 *
 * The spec creates everything it needs through the API: a contact, an agent user and a supervisor
 * user, each linked to an Agent profile created with the id `POST /api/v1/admin/users` returned (the
 * seed's `demo-user-*` agents are linked to no user, and a supervisor without an Agent profile is
 * refused a takeover with `not-an-agent`). Skipped unless E2E_FULL_STACK=true.
 */
const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';
const PASSWORD = 'TestPassword123!';

interface Provisioned {
  userId: string;
  agentId: string;
  email: string;
}

async function adminApiContext(playwright: {
  request: { newContext: (o?: object) => Promise<APIRequestContext> };
}): Promise<APIRequestContext> {
  const anonymous = await playwright.request.newContext();
  const login = await anonymous.post(`${API_BASE}/api/v1/auth/login`, { data: DEMO_ADMIN });
  expect(login.ok(), `demo admin login answered ${login.status()}`).toBe(true);
  const { accessToken } = (await login.json()) as { accessToken: string };
  await anonymous.dispose();
  return playwright.request.newContext({
    extraHTTPHeaders: {
      Authorization: `Bearer ${accessToken}`,
      'X-Tenant-Id': DEMO_ADMIN.tenantId,
    },
  });
}

async function provisionUserWithAgent(
  request: APIRequestContext,
  role: 'agent' | 'supervisor',
  suffix: string,
): Promise<Provisioned> {
  const email = `e2e-n16-${role}-${suffix}@test.local`;
  const user = await request.post(`${API_BASE}/api/v1/admin/users`, {
    data: { email, displayName: `E2E N16 ${role} ${suffix}`, role, password: PASSWORD },
  });
  expect(user.ok(), `create ${role} user answered ${user.status()}`).toBe(true);
  const { id: userId } = (await user.json()) as { id: string };

  const agent = await request.post(`${API_BASE}/api/v1/admin/agents`, {
    data: { userId, displayName: `E2E N16 ${role} ${suffix}` },
  });
  expect(agent.ok(), `create ${role} agent profile answered ${agent.status()}`).toBe(true);
  const { id: agentId } = (await agent.json()) as { id: string };
  return { userId, agentId, email };
}

test.describe('Monitor takeover and contact search read Platform ids (N16)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with the full stack (Platform v2.25.0+ and the demo seed)',
  );

  test('an agent starts a conversation from the contact search and a supervisor takes it over', async ({
    browser,
    playwright,
  }) => {
    test.setTimeout(120_000);
    const suffix = `${Date.now()}`;
    const request = await adminApiContext(playwright);
    const api = new ApiHelper(request, DEMO_ADMIN.tenantId);
    const created: Provisioned[] = [];
    let contactId: string | undefined;

    try {
      const contact = await request.post(`${API_BASE}/api/v1/contacts`, {
        data: {
          firstName: `N16${suffix}`,
          lastName: 'Contact',
          addresses: [{ channel: 'WhatsApp', address: `+57300${suffix.slice(-7)}` }],
        },
      });
      expect(contact.ok(), `create contact answered ${contact.status()}`).toBe(true);
      contactId = ((await contact.json()) as { contactId: string }).contactId;

      const agent = await provisionUserWithAgent(request, 'agent', suffix);
      created.push(agent);
      const supervisor = await provisionUserWithAgent(request, 'supervisor', suffix);
      created.push(supervisor);

      // --- The agent starts a conversation from the contact search ---
      const agentPage = await authenticatedPage(browser, {
        tenantId: DEMO_ADMIN.tenantId,
        email: agent.email,
        password: PASSWORD,
      });
      let conversationId: string;
      try {
        await agentPage.goto('/agent');
        await waitForAppReady(agentPage);
        await agentPage.getByTestId('new-conversation-btn').click();

        const search = agentPage.waitForResponse(
          (r) => r.url().includes('/api/v1/contacts?') && r.request().method() === 'GET' && r.ok(),
        );
        await agentPage.getByTestId('new-conv-contact-search').fill(`N16${suffix}`);
        await search;
        await agentPage.getByTestId(`new-conv-contact-option-${contactId}`).click();

        const createRequest = agentPage.waitForRequest(
          (r) => new URL(r.url()).pathname === '/api/v1/conversations' && r.method() === 'POST',
        );
        const createResponse = agentPage.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/v1/conversations' &&
            r.request().method() === 'POST',
        );
        await agentPage.getByTestId('new-conv-submit-btn').click();

        expect((await createRequest).postDataJSON()).toMatchObject({ contactId });
        const response = await createResponse;
        expect(response.ok(), `create conversation answered ${response.status()}`).toBe(true);
        conversationId = ((await response.json()) as { conversationId: string }).conversationId;
        expect(conversationId).toBeTruthy();
      } finally {
        await agentPage.context().close();
      }

      // --- The supervisor opens that conversation's card and takes it over ---
      const supervisorPage = await authenticatedPage(browser, {
        tenantId: DEMO_ADMIN.tenantId,
        email: supervisor.email,
        password: PASSWORD,
      });
      try {
        await supervisorPage.goto('/operations/monitor');
        await waitForAppReady(supervisorPage);
        await supervisorPage.getByTestId('monitor-tab-digital').click();

        const card = supervisorPage.getByTestId(`digital-conv-card-${conversationId}`);
        await expect(card).toBeVisible({ timeout: 20_000 });
        await expect(supervisorPage.getByTestId('digital-conv-card-undefined')).toHaveCount(0);
        await card.click();
        await expect(supervisorPage.getByTestId('digital-conversation-detail')).toBeVisible();

        const takeover = supervisorPage.waitForResponse(
          (r) =>
            r.request().method() === 'POST' &&
            new URL(r.url()).pathname ===
              `/api/v1/supervisor/conversations/${conversationId}/takeover`,
        );
        await supervisorPage.getByTestId('digital-takeover-btn').click();
        await supervisorPage.getByTestId('confirm-dialog-confirm').click();
        const response = await takeover;
        expect(response.ok(), `takeover answered ${response.status()}`).toBe(true);
      } finally {
        await supervisorPage.context().close();
      }
    } finally {
      for (const ids of created.reverse()) {
        await api.deleteAgentWithUser({ agentId: ids.agentId, userId: ids.userId });
      }
      if (contactId) await request.delete(`${API_BASE}/api/v1/contacts/${contactId}`);
      await request.dispose();
    }
  });
});
