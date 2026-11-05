import { randomUUID } from 'node:crypto';
import type { APIRequestContext, Browser, Page, Response } from '@playwright/test';
import { test, expect, waitForAppReady } from '../../fixtures/auth.fixture';
import { skipAgentTour } from '../../helpers/agent-tour';
import { authenticatedPage } from '../../helpers/auth-session';
import {
  activateForAgent,
  bearerApiContext,
  idOf,
  leaveQueue,
  openWebChatSession,
  type RoutedConversation,
} from '../../helpers/conversation-routing';
import { API_BASE } from '../../helpers/credentials';

/**
 * The console's mark on a WebChat contact whose identity comes from the browser alone (change
 * `webchat-visitor-identity-two-levels-web`, task 7.1; requires Platform with #543 and
 * `WebChat__VisitorIdentity__Level1Enabled=true`, which `docker-compose.full.yml` sets). Nothing is
 * intercepted.
 *
 * One browser id, two sessions through the real `POST /api/v1/webchat/sessions`: the second finds the
 * contact of the first and opens a second conversation. The agent closes the first and holds the
 * second, so the card, the header, the closed row of History and the viewer opened from it all read
 * the same contact.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- operations/contact-identity-level.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/** Two routings of up to 45 s each and a browser sign-in. A budget: every step is fenced. */
const TEST_BUDGET = 180_000;

/** A view loads on mount, over the cold start of a fresh sign-in. */
const VIEW_TIMEOUT = 15_000;

function isGet(response: Response, path: string): boolean {
  return response.request().method() === 'GET' && new URL(response.url()).pathname === path;
}

async function signIn(browser: Browser, account: Account, path: string): Promise<Page> {
  const page = await authenticatedPage(browser, account);
  await page.goto(path);
  await waitForAppReady(page);
  await skipAgentTour(page);
  return page;
}

interface Account {
  tenantId: string;
  email: string;
  password: string;
}

async function createAgent(api: APIRequestContext, stamp: string) {
  const account: Account = {
    tenantId: 'demo',
    email: `e2e-identity-${stamp}@demo.local`,
    password: 'E2eContactIdentity!2026',
  };
  const displayName = `E2E Identity ${stamp}`;
  const user = await api.post(`${API_BASE}/api/v1/admin/users`, {
    data: { email: account.email, displayName, role: 'Agent', password: account.password },
  });
  expect(user.status(), 'create user').toBe(201);
  const { id: userId } = (await user.json()) as { id: string };
  const agent = await api.post(`${API_BASE}/api/v1/admin/agents`, {
    data: { userId, displayName },
  });
  expect(agent.status(), 'create agent profile').toBe(201);
  return { account, userId, agentId: idOf(((await agent.json()) as { agentId: unknown }).agentId) };
}

test.describe('Contact identity level in the console (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform #543)',
  );

  test('a browser-level contact is marked Unverified on the card, the header, History and the viewer', async ({
    browser,
    demoApiContext,
    playwright,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const agent = await createAgent(demoApiContext, stamp);
    const visitorId = randomUUID();

    const first = await openWebChatSession(demoApiContext, 'demo', visitorId);
    expect(first.identityLevel, 'the first session of this browser').toBe('Unverified');

    let agentApi: APIRequestContext | undefined;
    let routed: RoutedConversation | undefined;
    let page: Page | undefined;
    try {
      agentApi = await bearerApiContext(playwright, agent.account);
      routed = await activateForAgent(demoApiContext, agentApi, first, agent.agentId);
      const closed = await agentApi.post(
        `${API_BASE}/api/v1/conversations/${first.conversationId}/close`,
        { data: {} },
      );
      expect(closed.status(), 'close the first conversation').toBe(200);
      await leaveQueue(demoApiContext, routed, agent.agentId);
      // `activateForAgent` takes the agent to Available, and the state machine refuses it from Available.
      const away = await agentApi.put(`${API_BASE}/api/v1/agents/me/state`, {
        data: { state: 'Offline' },
      });
      expect(away.status(), 'agent goes Offline').toBe(200);

      const second = await openWebChatSession(demoApiContext, 'demo', visitorId);
      expect(second.identityLevel, 'the return of this browser').toBe('Unverified');
      expect(second.contactId, 'the same contact').toBe(first.contactId);
      expect(second.conversationId, 'a new conversation').not.toBe(first.conversationId);
      routed = await activateForAgent(demoApiContext, agentApi, second, agent.agentId);

      page = await signIn(browser, agent.account, `/agent/conversation/${second.conversationId}`);

      // ── The header and the card ─────────────────────────────────────────────────────────
      const header = page.getByTestId('conversation-channel-badge').locator('xpath=..');
      await expect(header.locator('[data-identity-level]')).toHaveAttribute(
        'data-identity-level',
        'Unverified',
        { timeout: VIEW_TIMEOUT },
      );
      await expect(page.getByRole('tabpanel').locator('[data-identity-level]')).toHaveAttribute(
        'data-identity-level',
        'Unverified',
        { timeout: VIEW_TIMEOUT },
      );

      // ── A row of History ────────────────────────────────────────────────────────────────
      const list = page.waitForResponse((r) =>
        isGet(r, `/api/v1/contacts/${first.contactId}/conversations`),
      );
      await page.getByTestId('context-tab-history').click();
      expect((await list).status(), 'the holder reads the list').toBe(200);
      const closedRow = page.locator(
        `[data-testid="history-row"][data-conversation-id="${first.conversationId}"]`,
      );
      await expect(closedRow.locator('[data-identity-level]')).toHaveAttribute(
        'data-identity-level',
        'Unverified',
        { timeout: VIEW_TIMEOUT },
      );

      // ── The viewer opened from it ───────────────────────────────────────────────────────
      await closedRow.click();
      const viewer = page.getByTestId('history-viewer');
      await expect(viewer).toHaveAttribute('data-conversation-id', first.conversationId, {
        timeout: VIEW_TIMEOUT,
      });
      await expect(viewer.locator('[data-identity-level]')).toHaveAttribute(
        'data-identity-level',
        'Unverified',
        { timeout: VIEW_TIMEOUT },
      );
    } finally {
      if (page) await page.context().close();
      if (agentApi) await agentApi.dispose();
      await leaveQueue(demoApiContext, routed, agent.agentId);
      // Best effort: the user and profile are unique per run.
      await demoApiContext
        .delete(`${API_BASE}/api/v1/admin/agents/${agent.agentId}`)
        .catch(() => {});
      await demoApiContext.delete(`${API_BASE}/api/v1/admin/users/${agent.userId}`).catch(() => {});
    }
  });
});
