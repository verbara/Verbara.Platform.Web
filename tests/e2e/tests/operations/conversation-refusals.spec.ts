import type { APIRequestContext, Page, Response } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { authenticatedPage } from '../../helpers/auth-session';
import { API_BASE } from '../../helpers/credentials';

/**
 * A refused conversation action shows a localized message chosen from Platform's machine code,
 * never the server's text (change `the-console-account-and-session-surfaces-match-the-api`, H20,
 * spec `conversation-action-feedback`, task 4.4).
 *
 * Two refusals against a real Platform (>= v2.25.0), each asserted by `data-error-code` only:
 *  - a Supervisor with no Agent profile takes over a conversation from the operations monitor and
 *    Platform answers 403 `not-an-agent`;
 *  - agent A opens a conversation it owns, the spec reassigns it to agent B through the API, and
 *    A's send is answered 403 `not-owner`.
 *
 * The spec creates everything it uses through the API: a contact, a conversation, two Agent users
 * whose Agent profiles are linked to the ids `POST /api/v1/admin/users` returned, and a Supervisor
 * user with no Agent profile. The lab seed's `demo-user-*` agents are linked to no user, so every
 * seeded agent would be refused with `not-an-agent`.
 *
 * The monitor card and the agent's inbox read the conversation's id, which Platform sends as
 * `conversationId`: this spec relies on group 12 of the same change (N16, N17), which maps those
 * entities at the data boundary.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- tests/e2e/tests/operations/conversation-refusals.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/**
 * The test's budget: four users, two Agent profiles, a contact, a conversation, two reassigns, two
 * browser sign-ins and two monitored refusals. A budget, not a wait: every step below is fenced on a
 * response or on `expect`.
 */
const TEST_BUDGET = 90_000;

/** The monitor lists conversations on a 10 s poll; the agent's inbox loads on mount. */
const LIST_TIMEOUT = 15_000;

/** Platform serializes an `EntityId` as its string value; tolerate the `{ value }` object form. */
function idOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return String((value as { value: unknown }).value);
  }
  throw new Error(`Unexpected id shape: ${JSON.stringify(value)}`);
}

interface Account {
  tenantId: string;
  email: string;
  password: string;
}

async function createUser(
  api: APIRequestContext,
  stamp: string,
  label: string,
  role: 'Agent' | 'Supervisor',
): Promise<{ account: Account; userId: string }> {
  const account: Account = {
    tenantId: 'demo',
    email: `e2e-refusals-${label}-${stamp}@demo.local`,
    password: 'E2eRefusals!2026',
  };
  const created = await api.post(`${API_BASE}/api/v1/admin/users`, {
    data: {
      email: account.email,
      displayName: `E2E Refusals ${label} ${stamp}`,
      role,
      password: account.password,
    },
  });
  expect(created.status(), `create user ${label}`).toBe(201);
  const { id } = (await created.json()) as { id: string };
  return { account, userId: id };
}

/** An Agent profile linked to the user id Platform assigned. */
async function createAgentProfile(
  api: APIRequestContext,
  userId: string,
  displayName: string,
): Promise<string> {
  const created = await api.post(`${API_BASE}/api/v1/admin/agents`, {
    data: { userId, displayName },
  });
  expect(created.status(), `create agent profile for ${displayName}`).toBe(201);
  return idOf(((await created.json()) as { agentId: unknown }).agentId);
}

async function createConversation(api: APIRequestContext, stamp: string): Promise<string> {
  const contact = await api.post(`${API_BASE}/api/v1/contacts`, {
    data: { firstName: 'E2E Refusals', lastName: stamp },
  });
  expect(contact.status(), 'create contact').toBe(201);
  const contactId = idOf(((await contact.json()) as { contactId: unknown }).contactId);

  const conversation = await api.post(`${API_BASE}/api/v1/conversations`, {
    data: { contactId, channel: 'WebChat' },
  });
  expect(conversation.status(), 'create conversation').toBe(201);
  return idOf(((await conversation.json()) as { conversationId: unknown }).conversationId);
}

async function reassignToAgent(
  api: APIRequestContext,
  conversationId: string,
  agentId: string,
): Promise<void> {
  const reassigned = await api.post(
    `${API_BASE}/api/v1/supervisor/conversations/${conversationId}/reassign`,
    { data: { targetAgentId: agentId } },
  );
  expect(reassigned.status(), `reassign to ${agentId}`).toBe(204);
}

function isPost(response: Response, path: string): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === path;
}

/** The refusal toast, found by its code only (the text is the active locale's). */
function refusal(page: Page, code: string) {
  return page.locator(`[data-error-code="${code}"]`);
}

test.describe('Conversation refusals (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform >= v2.25.0)',
  );

  test('a supervisor without an Agent profile and a former owner see the localized refusal of their action', async ({
    browser,
    demoApiContext,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agentA = await createUser(demoApiContext, stamp, 'agent-a', 'Agent');
    const agentB = await createUser(demoApiContext, stamp, 'agent-b', 'Agent');
    const supervisor = await createUser(demoApiContext, stamp, 'supervisor', 'Supervisor');
    const agentAId = await createAgentProfile(demoApiContext, agentA.userId, `Agent A ${stamp}`);
    const agentBId = await createAgentProfile(demoApiContext, agentB.userId, `Agent B ${stamp}`);
    const conversationId = await createConversation(demoApiContext, stamp);

    const pages: Page[] = [];
    try {
      // ── A supervisor with no Agent profile takes over: 403 not-an-agent ─────────────────────
      const supervisorPage = await authenticatedPage(browser, supervisor.account);
      pages.push(supervisorPage);
      await supervisorPage.goto('/operations/monitor');
      await waitForAppReady(supervisorPage);
      await supervisorPage.getByTestId('monitor-tab-digital').click();

      const card = supervisorPage.getByTestId(`digital-conv-card-${conversationId}`);
      await expect(card).toBeVisible({ timeout: LIST_TIMEOUT });
      await card.click();
      await supervisorPage.getByTestId('digital-takeover-btn').click();

      const takeover = supervisorPage.waitForResponse((r) =>
        isPost(r, `/api/v1/supervisor/conversations/${conversationId}/takeover`),
      );
      await supervisorPage.getByTestId('confirm-dialog-confirm').click();
      expect((await takeover).status()).toBe(403);
      await expect(refusal(supervisorPage, 'not-an-agent')).toBeVisible();

      // ── Agent A owns the conversation, loses it to B, and sends: 403 not-owner ──────────────
      await reassignToAgent(demoApiContext, conversationId, agentAId);

      const agentPage = await authenticatedPage(browser, agentA.account);
      pages.push(agentPage);
      await agentPage.goto(`/agent/conversation/${conversationId}`);
      await waitForAppReady(agentPage);
      const input = agentPage.getByTestId('reply-composer-input');
      await expect(input).toBeVisible({ timeout: LIST_TIMEOUT });

      await reassignToAgent(demoApiContext, conversationId, agentBId);

      await input.fill(`still mine? ${stamp}`);
      const send = agentPage.waitForResponse((r) =>
        isPost(r, `/api/v1/conversations/${conversationId}/messages`),
      );
      await agentPage.getByTestId('reply-composer-send').click();
      expect((await send).status()).toBe(403);
      await expect(refusal(agentPage, 'not-owner')).toBeVisible();
    } finally {
      for (const page of pages) await page.context().close();
      // Best effort: the users and profiles are unique per run, so a failed delete leaks nothing
      // another run depends on.
      for (const agentId of [agentAId, agentBId]) {
        await demoApiContext.delete(`${API_BASE}/api/v1/admin/agents/${agentId}`).catch(() => {});
      }
      for (const { userId } of [agentA, agentB, supervisor]) {
        await demoApiContext.delete(`${API_BASE}/api/v1/admin/users/${userId}`).catch(() => {});
      }
    }
  });
});
