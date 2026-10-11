import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ApiHelper } from '../../fixtures/api.fixture';
import { skipAgentTour } from '../../helpers/agent-tour';
import { authenticatedPage, waitForAppReady } from '../../helpers/auth-session';
import {
  activateForAgent,
  bearerApiContext,
  idOf,
  leaveQueue,
  nameVisitorContact,
  openWebChatSession,
  type RoutedConversation,
  type WebChatVisitor,
} from '../../helpers/conversation-routing';
import { API_BASE, DEMO_ADMIN } from '../../helpers/credentials';

/**
 * LAB-W1 N16 against a real Platform (v2.28.0 or later): the console reads Platform's own entities,
 * and the new-conversation dialog shows a refused start from its machine code.
 *
 * An agent finds a contact through the new-conversation dialog's search and starts a WebChat
 * conversation with a message — the option must be keyed by Platform's `contactId` and the request
 * must carry it (before 3.21.0-web the option was `new-conv-contact-option-undefined` and Platform
 * answered 400). The contact is a WebChat visitor's, whose session conversation is already open and
 * queued with no owner, so Platform refuses the start with `conversation-open-elsewhere`, naming that
 * conversation; the dialog shows the refusal by its code and, to an agent who may not monitor, offers
 * no link to it.
 *
 * Routing then offers the visitor's conversation and the spec reassigns it to the agent
 * (`helpers/conversation-routing.ts`: Platform refuses to hand a `Queued` conversation to anyone). A
 * supervisor sees that conversation's card in the digital monitor — keyed by Platform's
 * `conversationId` (before, cards were `digital-conv-card-undefined`) — then tries the same start from
 * the agent workspace: refused `conversation-open-elsewhere` again, now with a link a monitoring user
 * may follow. The link opens the monitor on that conversation, and the supervisor takes it over — the
 * takeover must post to its id (before, it posted to `/supervisor/conversations/undefined/takeover`).
 *
 * The spec creates everything it needs through the API: a WebChat visitor session (its contact,
 * named and given a WhatsApp address so the search finds it, and its conversation), an agent user and
 * a supervisor user, each linked to an Agent profile created with the id `POST /api/v1/admin/users`
 * returned (the seed's `demo-user-*` agents are linked to no user, and a caller without an Agent
 * profile is refused a start or a takeover with `not-an-agent`). A new agent also meets the first-run
 * tour, which covers the console until it is skipped. Skipped unless E2E_FULL_STACK=true.
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

/** Starts a WebChat conversation with `contactId` from the dialog and returns Platform's answer. */
async function startFromDialog(
  page: Page,
  search: string,
  contactId: string,
  message: string,
): Promise<{ status: number; body: { error?: string; conversationId?: string | null } }> {
  await page.getByTestId('new-conversation-btn').click();
  const searched = page.waitForResponse(
    (r) => r.url().includes('/api/v1/contacts?') && r.request().method() === 'GET' && r.ok(),
  );
  await page.getByTestId('new-conv-contact-search').fill(search);
  await searched;
  await page.getByTestId(`new-conv-contact-option-${contactId}`).click();
  await page.getByTestId('new-conv-channel-select').click();
  await page.getByTestId('new-conv-channel-option-WebChat').click();
  await page.getByTestId('new-conv-message-input').fill(message);

  const isStart = (url: string, method: string) =>
    new URL(url).pathname === '/api/v1/conversations' && method === 'POST';
  const startRequest = page.waitForRequest((r) => isStart(r.url(), r.method()));
  const startResponse = page.waitForResponse((r) => isStart(r.url(), r.request().method()));
  await page.getByTestId('new-conv-submit-btn').click();

  expect((await startRequest).postDataJSON()).toMatchObject({
    contactId,
    channel: 'WebChat',
    initialMessage: message,
  });
  const response = await startResponse;
  return { status: response.status(), body: (await response.json()) as never };
}

test.describe('Monitor takeover and contact search read Platform ids (N16)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with the full stack (Platform v2.28.0+ and the demo seed)',
  );

  test('an agent is refused a start on a contact whose conversation is open, and a supervisor follows the refusal to take it over', async ({
    browser,
    playwright,
  }) => {
    // Two sign-ins, the contact search twice, the routing and offer (up to 45 s) and the monitor's
    // 10 s poll.
    test.setTimeout(180_000);
    const suffix = `${Date.now()}`;
    const search = `N16${suffix}`;
    const request = await adminApiContext(playwright);
    const api = new ApiHelper(request, DEMO_ADMIN.tenantId);
    const created: Provisioned[] = [];
    let visitor: WebChatVisitor | undefined;
    let agentApi: APIRequestContext | undefined;
    let routed: RoutedConversation | undefined;

    try {
      visitor = await openWebChatSession(request, DEMO_ADMIN.tenantId);
      const { contactId, conversationId } = visitor;
      await nameVisitorContact(request, visitor, {
        firstName: search,
        lastName: 'Contact',
        addresses: [{ channel: 'WhatsApp', address: `+57300${suffix.slice(-7)}` }],
      });

      const agent = await provisionUserWithAgent(request, 'agent', suffix);
      created.push(agent);
      const supervisor = await provisionUserWithAgent(request, 'supervisor', suffix);
      created.push(supervisor);

      // --- The agent finds the contact and is refused: its conversation is open, queued unowned ---
      const agentCreds = { tenantId: DEMO_ADMIN.tenantId, email: agent.email, password: PASSWORD };
      const agentPage = await authenticatedPage(browser, agentCreds);
      try {
        await agentPage.goto('/agent');
        await waitForAppReady(agentPage);
        await skipAgentTour(agentPage);

        const refused = await startFromDialog(agentPage, search, contactId, `hello ${suffix}`);
        expect(refused.status, 'a start on a contact with an open conversation').toBe(409);
        expect(refused.body.error).toBe('conversation-open-elsewhere');
        expect(idOf(refused.body.conversationId)).toBe(conversationId);

        const error = agentPage.getByTestId('new-conv-error');
        await expect(error).toHaveAttribute('data-error-code', 'conversation-open-elsewhere');
        // An agent may not monitor, so the dialog offers no way to the other owner's conversation.
        await expect(agentPage.getByTestId('new-conv-view-open-conversation')).toHaveCount(0);
      } finally {
        await agentPage.context().close();
      }

      // --- Routing offers it and it is reassigned to the agent: Queued → Offered → Active ---
      // After the agent's page is closed, so its pagehide departure (`/agents/me/offline`) cannot
      // land after the agent goes Available.
      agentApi = await bearerApiContext(playwright, agentCreds);
      routed = await activateForAgent(request, agentApi, visitor, agent.agentId);

      // --- The supervisor sees the card, follows the refusal's link and takes the conversation over ---
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

        // The first-run tour is an agent-role overlay; a supervisor does not meet it.
        await supervisorPage.goto('/agent');
        await waitForAppReady(supervisorPage);
        const refused = await startFromDialog(
          supervisorPage,
          search,
          contactId,
          `may I? ${suffix}`,
        );
        expect(refused.status, "a start on the agent's open conversation").toBe(409);
        expect(refused.body.error).toBe('conversation-open-elsewhere');
        expect(idOf(refused.body.conversationId)).toBe(conversationId);
        await expect(supervisorPage.getByTestId('new-conv-error')).toHaveAttribute(
          'data-error-code',
          'conversation-open-elsewhere',
        );

        await supervisorPage.getByTestId('new-conv-view-open-conversation').click();
        await supervisorPage.waitForURL(
          (url) =>
            url.pathname === '/operations/monitor' &&
            url.searchParams.get('tab') === 'digital' &&
            url.searchParams.get('conversation') === conversationId,
        );
        await expect(supervisorPage.getByTestId('digital-conversation-detail')).toBeVisible({
          timeout: 20_000,
        });

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
      if (visitor) {
        await request.delete(`${API_BASE}/api/v1/contacts/${visitor.contactId}`).catch(() => {});
      }
      await request.dispose();
    }
  });
});
