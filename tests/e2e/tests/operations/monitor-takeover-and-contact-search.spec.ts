import { expect, test, type APIRequestContext } from '@playwright/test';
import { ApiHelper } from '../../fixtures/api.fixture';
import { skipAgentTour } from '../../helpers/agent-tour';
import { authenticatedPage, waitForAppReady } from '../../helpers/auth-session';
import {
  activateForAgent,
  bearerApiContext,
  idOf,
  leaveQueue,
  openWebChatSession,
  type RoutedConversation,
} from '../../helpers/conversation-routing';
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
 *
 * The conversation is started on WebChat, and the contact carries the address of a WebChat visitor
 * session: a conversation the agent starts is `Queued` with no owner, and Platform (>= v2.26.0) refuses
 * to hand a `Queued` conversation to anyone ("Cannot transition from Queued to Active."). The visitor's
 * message routes it, the distribution worker offers it, and the spec reassigns it to the agent
 * (`helpers/conversation-routing.ts`), so the supervisor takes over an agent's active conversation.
 * A new agent also meets the first-run tour, which covers the console until it is skipped.
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
  // Platform names the created profile's id `agentId` (AdminAgentResponseDto), not `id`.
  const agentId = idOf(((await agent.json()) as { agentId: unknown }).agentId);
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
    // Two sign-ins, the contact search, the routing and offer (up to 45 s) and the monitor's 10 s poll.
    test.setTimeout(180_000);
    const suffix = `${Date.now()}`;
    const request = await adminApiContext(playwright);
    const api = new ApiHelper(request, DEMO_ADMIN.tenantId);
    const created: Provisioned[] = [];
    let contactId: string | undefined;
    let agentApi: APIRequestContext | undefined;
    let routed: RoutedConversation | undefined;

    try {
      const sessionId = await openWebChatSession(request, DEMO_ADMIN.tenantId);
      const contact = await request.post(`${API_BASE}/api/v1/contacts`, {
        data: {
          firstName: `N16${suffix}`,
          lastName: 'Contact',
          addresses: [
            { channel: 'WhatsApp', address: `+57300${suffix.slice(-7)}` },
            { channel: 'WebChat', address: sessionId },
          ],
        },
      });
      expect(contact.ok(), `create contact answered ${contact.status()}`).toBe(true);
      contactId = ((await contact.json()) as { contactId: string }).contactId;

      const agent = await provisionUserWithAgent(request, 'agent', suffix);
      created.push(agent);
      const supervisor = await provisionUserWithAgent(request, 'supervisor', suffix);
      created.push(supervisor);

      // --- The agent starts a conversation from the contact search ---
      const agentCreds = { tenantId: DEMO_ADMIN.tenantId, email: agent.email, password: PASSWORD };
      const agentPage = await authenticatedPage(browser, agentCreds);
      let conversationId: string;
      try {
        await agentPage.goto('/agent');
        await waitForAppReady(agentPage);
        await skipAgentTour(agentPage);
        await agentPage.getByTestId('new-conversation-btn').click();

        const search = agentPage.waitForResponse(
          (r) => r.url().includes('/api/v1/contacts?') && r.request().method() === 'GET' && r.ok(),
        );
        await agentPage.getByTestId('new-conv-contact-search').fill(`N16${suffix}`);
        await search;
        await agentPage.getByTestId(`new-conv-contact-option-${contactId}`).click();
        await agentPage.getByTestId('new-conv-channel-select').click();
        await agentPage.getByTestId('new-conv-channel-option-WebChat').click();

        const createRequest = agentPage.waitForRequest(
          (r) => new URL(r.url()).pathname === '/api/v1/conversations' && r.method() === 'POST',
        );
        const createResponse = agentPage.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === '/api/v1/conversations' &&
            r.request().method() === 'POST',
        );
        await agentPage.getByTestId('new-conv-submit-btn').click();

        expect((await createRequest).postDataJSON()).toMatchObject({
          contactId,
          channel: 'WebChat',
        });
        const response = await createResponse;
        expect(response.ok(), `create conversation answered ${response.status()}`).toBe(true);
        conversationId = idOf(
          ((await response.json()) as { conversationId: unknown }).conversationId,
        );
        expect(conversationId).toBeTruthy();
      } finally {
        await agentPage.context().close();
      }

      // --- Routing offers it and it is reassigned to the agent: Queued → Offered → Active ---
      // After the agent's page is closed, so its pagehide departure (`/agents/me/offline`) cannot
      // land after the agent goes Available.
      agentApi = await bearerApiContext(playwright, agentCreds);
      routed = await activateForAgent(request, agentApi, {
        conversationId,
        sessionId,
        agentId: agent.agentId,
      });

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
      await agentApi?.dispose();
      const agentId = created[0]?.agentId;
      if (agentId) await leaveQueue(request, routed, agentId);
      for (const ids of created.reverse()) {
        await api.deleteAgentWithUser({ agentId: ids.agentId, userId: ids.userId });
      }
      if (contactId) await request.delete(`${API_BASE}/api/v1/contacts/${contactId}`);
      await request.dispose();
    }
  });
});
