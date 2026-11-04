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
  type WebChatVisitor,
} from '../../helpers/conversation-routing';
import { API_BASE } from '../../helpers/credentials';

/**
 * A returning customer's History tab against a real Platform (change
 * `contact-history-opens-by-assignment-web`, task 7.1; requires Platform with #539). Nothing is
 * intercepted, and every read is the console's own.
 *
 * One WebChat contact, three agents:
 *  1. Former owns the session's first conversation through routing, the visitor fills it past one
 *     page of messages, and Former closes it. The next message of the same session opens the same
 *     contact's second conversation.
 *  2. Offered is the only member of the queue, so the worker offers it that second conversation. Its
 *     History tab takes the contact id from `GET /conversations/{id}` (W14) and answers with the
 *     `read-refusal` element, since an offer does not grant the contact's list (host Q3). A visitor
 *     message sent after the offer still reaches the offered card live (host Q2, D17).
 *  3. A reassign gives the open conversation to Former, and another gives it to Holder. Former owned
 *     both of the contact's conversations and holds neither now, so its History tab is refused too.
 *  4. Holder never owned the closed conversation: it reads it only because it holds the contact's
 *     open one (host D2). Its held row is marked and inert; the closed row opens the read-only viewer
 *     on the newest page and "load earlier" reaches the oldest message.
 *
 * The spec creates three Agent users with profiles and one visitor session, and removes them.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- operations/contact-history.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/**
 * Three users, a visitor session with its routing and offers (up to 45 s each), three browser
 * sign-ins and the visitor's messages. A budget, not a wait: every step is fenced on a response or on
 * `expect`.
 */
const TEST_BUDGET = 240_000;

/** A view loads on mount, over the cold start of a fresh sign-in; a refused read is retried once. */
const LIST_TIMEOUT = 15_000;

/** Routing, the worker's 2 s poll, and the 30 s after which a missed offer is made again. */
const OFFER_TIMEOUT = 45_000;

/** Platform's default page of `/history` is 50; this many visitor messages leave an older page. */
const FILLER_MESSAGES = 52;

interface Account {
  tenantId: string;
  email: string;
  password: string;
}

interface Agent {
  account: Account;
  userId: string;
  agentId: string;
}

interface HistoryMessage {
  messageId: unknown;
  content?: { blocks?: { text?: string }[] };
}

async function createAgent(api: APIRequestContext, stamp: string, label: string): Promise<Agent> {
  const account: Account = {
    tenantId: 'demo',
    email: `e2e-history-${label}-${stamp}@demo.local`,
    password: 'E2eContactHistory!2026',
  };
  const displayName = `E2E History ${label} ${stamp}`;
  const user = await api.post(`${API_BASE}/api/v1/admin/users`, {
    data: { email: account.email, displayName, role: 'Agent', password: account.password },
  });
  expect(user.status(), `create user ${label}`).toBe(201);
  const { id: userId } = (await user.json()) as { id: string };
  const agent = await api.post(`${API_BASE}/api/v1/admin/agents`, {
    data: { userId, displayName },
  });
  expect(agent.status(), `create agent profile ${label}`).toBe(201);
  return { account, userId, agentId: idOf(((await agent.json()) as { agentId: unknown }).agentId) };
}

async function visitorSays(
  api: APIRequestContext,
  visitor: WebChatVisitor,
  text: string,
): Promise<void> {
  const sent = await api.post(`${API_BASE}/api/v1/webchat/sessions/${visitor.sessionId}/messages`, {
    data: { text },
  });
  expect(sent.status(), `visitor message "${text}"`).toBe(200);
}

/** The conversation's messages as an admin reads them, newest first. */
async function transcript(
  api: APIRequestContext,
  conversationId: string,
): Promise<HistoryMessage[]> {
  const page = await api.get(
    `${API_BASE}/api/v1/conversations/${conversationId}/history?limit=100`,
  );
  expect(page.status(), `read the history of ${conversationId}`).toBe(200);
  return ((await page.json()) as { items: HistoryMessage[] }).items;
}

async function reassign(
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

async function signIn(browser: Browser, account: Account, path: string): Promise<Page> {
  const page = await authenticatedPage(browser, account);
  await page.goto(path);
  await waitForAppReady(page);
  await skipAgentTour(page);
  return page;
}

function isGet(response: Response, path: string): boolean {
  return response.request().method() === 'GET' && new URL(response.url()).pathname === path;
}

/** Opens the History tab and returns the status of the contact's list it read. */
async function openHistoryTab(page: Page, contactId: string): Promise<number> {
  const list = page.waitForResponse((r) => isGet(r, `/api/v1/contacts/${contactId}/conversations`));
  await page.getByTestId('context-tab-history').click();
  return (await list).status();
}

test.describe('Contact history by assignment (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform #539)',
  );

  test('the holder opens a closed conversation; an offered agent and a former owner are refused', async ({
    browser,
    demoApiContext,
    playwright,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const former = await createAgent(demoApiContext, stamp, 'former');
    const offered = await createAgent(demoApiContext, stamp, 'offered');
    const holder = await createAgent(demoApiContext, stamp, 'holder');
    const visitor = await openWebChatSession(demoApiContext, 'demo');
    const { contactId, conversationId: closedId } = visitor;

    const pages: Page[] = [];
    const agentApis: APIRequestContext[] = [];
    let routed: RoutedConversation | undefined;
    try {
      // ── The contact's first conversation: past one page, then closed ────────────────────────
      const formerApi = await bearerApiContext(playwright, former.account);
      agentApis.push(formerApi);
      routed = await activateForAgent(demoApiContext, formerApi, visitor, former.agentId);
      await leaveQueue(demoApiContext, routed, former.agentId);

      for (let i = 0; i < FILLER_MESSAGES; i++) {
        await visitorSays(demoApiContext, visitor, `filler ${i} ${stamp}`);
      }
      let closedTranscript: HistoryMessage[] = [];
      await expect
        .poll(
          async () => {
            closedTranscript = await transcript(demoApiContext, closedId);
            return closedTranscript.length;
          },
          { message: 'every visitor message is stored', timeout: LIST_TIMEOUT },
        )
        .toBeGreaterThan(FILLER_MESSAGES);
      const newestClosedMessage = idOf(closedTranscript[0]?.messageId);
      const oldestClosedMessage = idOf(closedTranscript.at(-1)?.messageId);

      const closed = await formerApi.post(`${API_BASE}/api/v1/conversations/${closedId}/close`, {
        data: {},
      });
      expect(closed.status(), 'close the first conversation').toBe(200);

      // ── An open offer: the only eligible agent is on the page when it is made ───────────────
      const offeredApi = await bearerApiContext(playwright, offered.account);
      agentApis.push(offeredApi);
      const member = await demoApiContext.post(
        `${API_BASE}/api/v1/queues/${routed.queueId}/members`,
        { data: { agentId: offered.agentId, allowedChannels: ['WebChat'] } },
      );
      expect(member.status(), 'the offered agent joins the queue').toBe(201);

      const offeredPage = await signIn(browser, offered.account, '/agent');
      pages.push(offeredPage);
      const available = await offeredApi.put(`${API_BASE}/api/v1/agents/me/state`, {
        data: { state: 'Available' },
      });
      expect(available.status(), 'the offered agent goes Available').toBe(200);
      const heartbeat = await offeredApi.post(`${API_BASE}/api/v1/agents/me/heartbeat`);
      expect(heartbeat.ok(), `heartbeat answered ${heartbeat.status()}`).toBe(true);

      await visitorSays(demoApiContext, visitor, `back again ${stamp}`);

      let openId = '';
      await expect
        .poll(
          async () => {
            const list = await demoApiContext.get(
              `${API_BASE}/api/v1/contacts/${contactId}/conversations`,
            );
            const { items } = (await list.json()) as { items: { id: unknown }[] };
            openId = items.map((item) => idOf(item.id)).find((id) => id !== closedId) ?? '';
            return openId;
          },
          { message: 'the next message opens a second conversation', timeout: OFFER_TIMEOUT },
        )
        .not.toBe('');

      const offeredCard = offeredPage.getByTestId(`inbox-item-${openId}`);
      await expect(offeredCard).toBeVisible({ timeout: OFFER_TIMEOUT });

      const historyReads: string[] = [];
      offeredPage.on('request', (request) => {
        if (new URL(request.url()).pathname === `/api/v1/conversations/${openId}/history`) {
          historyReads.push(request.url());
        }
      });
      const firstRead = offeredPage.waitForResponse((r) =>
        isGet(r, `/api/v1/conversations/${openId}/history`),
      );
      await offeredCard.click();
      expect((await firstRead).status(), 'an offer previews its own conversation').toBe(200);

      expect(await openHistoryTab(offeredPage, contactId), 'an offer is not holding').toBe(403);
      const offeredRefusal = offeredPage.getByTestId('read-refusal');
      await expect(offeredRefusal).toBeVisible({ timeout: LIST_TIMEOUT });
      await expect(offeredRefusal).toHaveAttribute('data-refusal', 'not-readable');
      await expect(offeredPage.getByTestId('history-list')).toHaveCount(0);

      // A second visitor message after the offer arrives by the stream, not by another read.
      const readsBeforeLive = historyReads.length;
      const liveText = `live while offered ${stamp}`;
      await visitorSays(demoApiContext, visitor, liveText);
      let liveMessage = '';
      await expect
        .poll(
          async () => {
            const stored = (await transcript(demoApiContext, openId)).find((message) =>
              message.content?.blocks?.some((block) => block.text === liveText),
            );
            liveMessage = stored ? idOf(stored.messageId) : '';
            return liveMessage;
          },
          { message: 'the live message is stored', timeout: LIST_TIMEOUT },
        )
        .not.toBe('');
      await expect(
        offeredPage.locator(`[data-testid="message-bubble"][data-message-id="${liveMessage}"]`),
      ).toBeVisible({ timeout: LIST_TIMEOUT });
      expect(historyReads.length, 'the live message took no read of the history').toBe(
        readsBeforeLive,
      );

      // ── A former owner of both conversations, holding neither: refused ──────────────────────
      await expect(async () => {
        const offer = await demoApiContext.get(`${API_BASE}/api/v1/conversations/${openId}`);
        expect(((await offer.json()) as { state: string }).state).toBe('Offered');
        await reassign(demoApiContext, openId, former.agentId);
      }).toPass({ timeout: OFFER_TIMEOUT });

      const formerPage = await signIn(browser, former.account, `/agent/conversation/${openId}`);
      pages.push(formerPage);
      await expect(formerPage.getByTestId('reply-composer-input')).toBeVisible({
        timeout: LIST_TIMEOUT,
      });

      await reassign(demoApiContext, openId, holder.agentId);

      expect(await openHistoryTab(formerPage, contactId), 'a former owner holds nothing').toBe(403);
      const formerRefusal = formerPage.getByTestId('read-refusal');
      await expect(formerRefusal).toBeVisible({ timeout: LIST_TIMEOUT });
      await expect(formerRefusal).toHaveAttribute('data-refusal', 'not-readable');

      // ── The holder: the marked row, the closed row, the viewer, an earlier page ─────────────
      const holderPath = `/agent/conversation/${openId}`;
      const holderPage = await signIn(browser, holder.account, holderPath);
      pages.push(holderPage);
      await expect(holderPage.getByTestId('reply-composer-input')).toBeVisible({
        timeout: LIST_TIMEOUT,
      });

      expect(await openHistoryTab(holderPage, contactId), 'the holder reads the list').toBe(200);
      const heldRow = holderPage.locator(
        `[data-testid="history-row"][data-conversation-id="${openId}"]`,
      );
      await expect(heldRow).toHaveAttribute('data-held-by-caller', 'true', {
        timeout: LIST_TIMEOUT,
      });
      await expect(heldRow.getByTestId('history-held-mark')).toBeVisible();
      await expect(holderPage.locator('button[data-held-by-caller="true"]')).toHaveCount(0);

      const closedRow = holderPage.locator(
        `[data-testid="history-row"][data-conversation-id="${closedId}"]`,
      );
      await expect(closedRow).toHaveAttribute('data-held-by-caller', 'false');
      await expect(closedRow).toHaveAttribute('data-state', 'Closed');

      const viewerRead = holderPage.waitForResponse((r) =>
        isGet(r, `/api/v1/conversations/${closedId}/history`),
      );
      await closedRow.click();
      expect((await viewerRead).status(), 'the holder reads the closed transcript').toBe(200);

      const viewer = holderPage.getByTestId('history-viewer');
      await expect(viewer).toHaveAttribute('data-conversation-id', closedId, {
        timeout: LIST_TIMEOUT,
      });
      await expect(viewer).toHaveAttribute('data-state', 'Closed', { timeout: LIST_TIMEOUT });
      await expect(
        viewer.locator(
          `[data-testid="history-viewer-message"][data-message-id="${newestClosedMessage}"]`,
        ),
      ).toBeVisible({ timeout: LIST_TIMEOUT });
      await expect(viewer.locator(`[data-message-id="${oldestClosedMessage}"]`)).toHaveCount(0);

      const loadEarlier = viewer.getByTestId('history-load-earlier');
      const earlierRead = holderPage.waitForResponse(
        (r) =>
          isGet(r, `/api/v1/conversations/${closedId}/history`) &&
          new URL(r.url()).searchParams.has('before'),
      );
      await loadEarlier.click();
      expect((await earlierRead).status(), 'the earlier page').toBe(200);
      await expect(loadEarlier).toHaveCount(0, { timeout: LIST_TIMEOUT });
      await expect(
        viewer.locator(
          `[data-testid="history-viewer-message"][data-message-id="${oldestClosedMessage}"]`,
        ),
      ).toBeVisible({ timeout: LIST_TIMEOUT });

      // The viewer is read only, over the conversation still being worked.
      await holderPage.getByTestId('history-viewer-close').click();
      await expect(viewer).toHaveCount(0);
      expect(new URL(holderPage.url()).pathname).toBe(holderPath);
      await expect(holderPage.getByTestId('reply-composer-input')).toBeVisible();
    } finally {
      for (const page of pages) await page.context().close();
      for (const agentApi of agentApis) await agentApi.dispose();
      await leaveQueue(demoApiContext, routed, offered.agentId);
      // Best effort: the users and profiles are unique per run, so a failed delete leaks nothing
      // another run depends on.
      for (const { agentId, userId } of [former, offered, holder]) {
        await demoApiContext.delete(`${API_BASE}/api/v1/admin/agents/${agentId}`).catch(() => {});
        await demoApiContext.delete(`${API_BASE}/api/v1/admin/users/${userId}`).catch(() => {});
      }
      await demoApiContext.delete(`${API_BASE}/api/v1/contacts/${contactId}`).catch(() => {});
    }
  });
});
