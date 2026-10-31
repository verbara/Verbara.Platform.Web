import type { APIRequestContext, Page, Response } from '@playwright/test';
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
 * An Agent hands a conversation to another Agent with a note, and the second reads it (change
 * `agent-console-contract-debt`, specs `conversation-transfer-note` and
 * `conversation-transfer-targets`, task 2.4). Nothing is intercepted.
 *
 *  1. The first Agent owns a real WebChat conversation (`helpers/conversation-routing.ts`), opens the
 *     digital dialog, and finds the second through `GET /api/v1/transfer-targets/agents`, a route an
 *     Agent may read.
 *  2. The note field stops a real keystroke at the limit; a programmatic fill would not prove it.
 *  3. The transfer carries the trimmed `note` and answers 200, and the dialog closes.
 *  4. Through the API, the history holds one element with `direction` `System`, holding the note.
 *  5. The second Agent opens the conversation and sees it as a system row.
 *
 * The spec creates two Agent users with profiles and one visitor session, and removes them. The lab
 * seed's `demo-user-*` agents are linked to no user, so they cannot sign in as an owner.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- operations/agent-transfer-note.spec.ts`, against a
 * Platform that carries the `/transfer-targets` routes.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/** Two users, a visitor session, its routing and offer (up to 45 s), and two browser sign-ins. */
const TEST_BUDGET = 150_000;

/** The conversation view loads on mount, over the cold start of a fresh sign-in. */
const LIST_TIMEOUT = 15_000;

const NOTE_LIMIT = 1000;

interface Account {
  tenantId: string;
  email: string;
  password: string;
}

interface HistoryElement {
  messageId: unknown;
  direction: string;
  content: { blocks: { text?: string }[] };
}

async function createAgent(
  api: APIRequestContext,
  stamp: string,
  label: string,
): Promise<{ account: Account; userId: string; agentId: string; displayName: string }> {
  const account: Account = {
    tenantId: 'demo',
    email: `e2e-transfer-${label}-${stamp}@demo.local`,
    password: 'E2eTransfer!2026',
  };
  const displayName = `E2E Transfer ${label} ${stamp}`;
  const user = await api.post(`${API_BASE}/api/v1/admin/users`, {
    data: { email: account.email, displayName, role: 'Agent', password: account.password },
  });
  expect(user.status(), `create user ${label}`).toBe(201);
  const { id: userId } = (await user.json()) as { id: string };
  const agent = await api.post(`${API_BASE}/api/v1/admin/agents`, {
    data: { userId, displayName },
  });
  expect(agent.status(), `create agent profile ${label}`).toBe(201);
  const agentId = idOf(((await agent.json()) as { agentId: unknown }).agentId);
  return { account, userId, agentId, displayName };
}

function isPost(response: Response, path: string): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === path;
}

function isAgentSearch(response: Response, term: string): boolean {
  const url = new URL(response.url());
  return (
    url.pathname === '/api/v1/transfer-targets/agents' && url.searchParams.get('search') === term
  );
}

test.describe('Transfer a conversation with a note (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform with /transfer-targets)',
  );

  test('an Agent transfers to another with a note, and the second reads it as a system row', async ({
    browser,
    demoApiContext,
    playwright,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const note = `Prefers Portuguese. Case ${stamp} is open on the same order.`;
    const first = await createAgent(demoApiContext, stamp, 'first');
    const second = await createAgent(demoApiContext, stamp, 'second');
    const visitor = await openWebChatSession(demoApiContext, 'demo');
    const { conversationId } = visitor;
    const transferPath = `/api/v1/conversations/${conversationId}/transfer`;

    const pages: Page[] = [];
    let firstApi: APIRequestContext | undefined;
    let secondApi: APIRequestContext | undefined;
    let routed: RoutedConversation | undefined;
    try {
      firstApi = await bearerApiContext(playwright, first.account);
      secondApi = await bearerApiContext(playwright, second.account);
      routed = await activateForAgent(demoApiContext, firstApi, visitor, first.agentId);

      // ── The first Agent finds the second through the route an Agent may read ────────────────
      const firstPage = await authenticatedPage(browser, first.account);
      pages.push(firstPage);
      await firstPage.goto(`/agent/conversation/${conversationId}`);
      await waitForAppReady(firstPage);
      await skipAgentTour(firstPage);
      const transferButton = firstPage.getByTestId('conversation-transfer-btn');
      await expect(transferButton).toBeVisible({ timeout: LIST_TIMEOUT });
      await transferButton.click();

      const dialog = firstPage.getByTestId('transfer-dialog');
      await expect(dialog).toBeVisible();
      await firstPage.getByTestId('transfer-to-agent').click();
      const listed = firstPage.waitForResponse((r) => isAgentSearch(r, second.displayName));
      await firstPage.getByTestId('transfer-search').fill(second.displayName);
      expect((await listed).status()).toBe(200);
      await firstPage.getByTestId(`transfer-item-${second.agentId}`).click();

      // ── The field stops a real keystroke at the limit ───────────────────────────────────────
      const noteField = firstPage.getByTestId('transfer-note');
      const atLimit = 'x'.repeat(NOTE_LIMIT);
      await noteField.fill(atLimit);
      await noteField.press('y');
      await expect(noteField).toHaveValue(atLimit);

      // ── The transfer carries the trimmed note ───────────────────────────────────────────────
      await noteField.fill(`  ${note}\n`);
      const transfer = firstPage.waitForResponse((r) => isPost(r, transferPath));
      await firstPage.getByTestId('transfer-submit').click();
      const answered = await transfer;
      expect(answered.status()).toBe(200);
      expect(answered.request().postDataJSON()).toEqual({
        targetAgentId: second.agentId,
        note,
      });
      await expect(dialog).toHaveCount(0);

      // ── The history holds one System element, with the note ─────────────────────────────────
      const stored = await secondApi.get(
        `${API_BASE}/api/v1/conversations/${conversationId}/messages`,
      );
      expect(stored.status(), 'read the history').toBe(200);
      const systemRows = ((await stored.json()) as HistoryElement[]).filter(
        (element) => element.direction === 'System',
      );
      expect(systemRows, 'one System element in the history').toHaveLength(1);
      expect(systemRows[0]?.content.blocks.map((block) => block.text)).toEqual([note]);

      // ── The second Agent sees a system row, never a bubble ──────────────────────────────────
      const secondPage = await authenticatedPage(browser, second.account);
      pages.push(secondPage);
      await secondPage.goto(`/agent/conversation/${conversationId}`);
      await waitForAppReady(secondPage);
      await skipAgentTour(secondPage);
      const row = secondPage.locator(
        `[data-testid="system-event"][data-message-id="${idOf(systemRows[0]?.messageId)}"]`,
      );
      await expect(row).toBeVisible({ timeout: LIST_TIMEOUT });
      await expect(row).toHaveText(note);
    } finally {
      for (const page of pages) await page.context().close();
      // Best effort: the second Agent owns the conversation once the transfer went through.
      await secondApi
        ?.post(`${API_BASE}/api/v1/conversations/${conversationId}/close`, { data: {} })
        .catch(() => {});
      await firstApi?.dispose();
      await secondApi?.dispose();
      await leaveQueue(demoApiContext, routed, first.agentId);
      for (const { agentId } of [first, second]) {
        await demoApiContext.delete(`${API_BASE}/api/v1/admin/agents/${agentId}`).catch(() => {});
      }
      for (const { userId } of [first, second]) {
        await demoApiContext.delete(`${API_BASE}/api/v1/admin/users/${userId}`).catch(() => {});
      }
      await demoApiContext
        .delete(`${API_BASE}/api/v1/contacts/${visitor.contactId}`)
        .catch(() => {});
    }
  });
});
