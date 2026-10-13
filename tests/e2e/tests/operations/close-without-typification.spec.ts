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
 * An agent closes an Active chat with no typification schema bound (Platform change
 * `close-chat-without-typification-licence`, task 4.3; requires Platform with #375).
 *
 * Against a real Platform, with one refusal injected:
 *  1. the agent's first Close is answered — by a route this spec installs, once — 409
 *     `typification-required`, as Platform answers when the tenant binds a published schema; the
 *     console opens the wrap-up sheet, toasts that code, and (no schema is bound for real) the sheet
 *     shows the no-schema panel;
 *  2. the panel's "Close conversation" reaches Platform, which closes the chat (200) and leaves it
 *     `Closed`; the sheet closes.
 *
 * Prerequisite: the `demo` tenant binds no typification schema (the default: no seeder inserts
 * one, and schema administration is licence-gated). Every assertion is on `data-*` attributes.
 *
 * Run with `E2E_FULL_STACK=true npm run e2e -- tests/e2e/tests/operations/close-without-typification.spec.ts`.
 */

const SHOULD_RUN = process.env.E2E_FULL_STACK === 'true';

/** Two users' worth of setup, routing and offer (up to 45 s), a sign-in and two closes. */
const TEST_BUDGET = 120_000;

const LIST_TIMEOUT = 15_000;

interface Account {
  tenantId: string;
  email: string;
  password: string;
}

function isPost(response: Response, path: string): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === path;
}

function refusal(page: Page, code: string) {
  return page.locator(`[data-error-code="${code}"]`);
}

test.describe('Close a chat without a typification schema (full stack)', () => {
  test.skip(
    !SHOULD_RUN,
    'requires E2E_FULL_STACK=true with docker-compose.full.yml (Platform with close-chat-without-typification-licence)',
  );

  test('a typification-required refusal opens the wrap-up sheet, and its Close closes the chat', async ({
    browser,
    demoApiContext,
    playwright,
  }) => {
    test.setTimeout(TEST_BUDGET);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const account: Account = {
      tenantId: 'demo',
      email: `e2e-close-${stamp}@demo.local`,
      password: 'E2eCloseChat!2026',
    };
    const createdUser = await demoApiContext.post(`${API_BASE}/api/v1/admin/users`, {
      data: {
        email: account.email,
        displayName: `E2E Close ${stamp}`,
        role: 'Agent',
        password: account.password,
      },
    });
    expect(createdUser.status(), 'create agent user').toBe(201);
    const { id: userId } = (await createdUser.json()) as { id: string };
    const createdAgent = await demoApiContext.post(`${API_BASE}/api/v1/admin/agents`, {
      data: { userId, displayName: `E2E Close ${stamp}` },
    });
    expect(createdAgent.status(), 'create agent profile').toBe(201);
    const agentId = idOf(((await createdAgent.json()) as { agentId: unknown }).agentId);
    const visitor = await openWebChatSession(demoApiContext, 'demo');
    const { conversationId } = visitor;
    const closePath = `/api/v1/conversations/${conversationId}/close`;

    let page: Page | undefined;
    let agentApi: APIRequestContext | undefined;
    let routed: RoutedConversation | undefined;
    try {
      agentApi = await bearerApiContext(playwright, account);
      routed = await activateForAgent(demoApiContext, agentApi, visitor, agentId);

      page = await authenticatedPage(browser, account);
      await page.goto(`/agent/conversation/${conversationId}`);
      await waitForAppReady(page);
      await skipAgentTour(page);
      const closeButton = page.getByTestId('conversation-close-btn');
      await expect(closeButton).toBeVisible({ timeout: LIST_TIMEOUT });

      // ── 1. Close answered 409 typification-required (injected once) → wrap-up sheet ────────
      await page.route(
        `**${closePath}`,
        (route) =>
          route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'typification-required' }),
          }),
        { times: 1 },
      );
      await closeButton.click();
      await page.getByTestId('confirm-dialog-confirm').click();
      await expect(refusal(page, 'typification-required')).toBeVisible();
      const noSchemaPanel = page.getByTestId('typification-no-schema');
      await expect(noSchemaPanel).toBeVisible();
      await expect(page.getByTestId('typification-notes')).toHaveCount(0);

      // ── 2. The panel's Close reaches Platform: 200, conversation Closed, sheet gone ─────────
      const close = page.waitForResponse((r) => isPost(r, closePath));
      await page.getByTestId('typification-close-conversation').click();
      expect((await close).status()).toBe(200);
      await expect(noSchemaPanel).toHaveCount(0);

      const after = await demoApiContext.get(`${API_BASE}/api/v1/conversations/${conversationId}`);
      expect(after.status()).toBe(200);
      expect(((await after.json()) as { state: string }).state).toBe('Closed');
    } finally {
      await page?.context().close();
      await agentApi?.dispose();
      await leaveQueue(demoApiContext, routed, agentId);
      await demoApiContext.delete(`${API_BASE}/api/v1/admin/agents/${agentId}`).catch(() => {});
      await demoApiContext.delete(`${API_BASE}/api/v1/admin/users/${userId}`).catch(() => {});
      await demoApiContext
        .delete(`${API_BASE}/api/v1/contacts/${visitor.contactId}`)
        .catch(() => {});
    }
  });
});
