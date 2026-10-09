import { expect, type APIRequestContext } from '@playwright/test';
import type { Credentials, LoginResult } from './auth-session';
import { API_BASE } from './credentials';

/**
 * Puts a conversation in an agent's hands the way Platform does it, for full-stack specs.
 *
 * A conversation created through `POST /api/v1/conversations` starts `Queued` with no owner, and
 * Platform (>= v2.26.0) moves an owner only along its state machine: `Queued → Offered → Active`.
 * A reassign or a takeover of a `Queued` conversation is answered "Cannot transition from Queued to
 * Active." (`ConversationSwitchboard.TransferToAgentAsync`), so a spec that needs an agent-owned
 * conversation has to let routing offer it first. No SQL: every step is a public endpoint.
 *
 *  1. The conversation's contact carries a WebChat address equal to a WebChat session id
 *     ({@link openWebChatSession}), and the conversation is created on the WebChat channel.
 *  2. The visitor's first message on that session (`POST /webchat/sessions/{id}/messages`) resolves
 *     the contact by that address, finds its open WebChat conversation and routes it to a queue
 *     (`WebChatInboundRouter` → `AssignToQueueAsync`): the owner becomes that queue.
 *  3. The agent joins the queue for WebChat and goes Available, so the distribution worker (2 s poll)
 *     finds an eligible member and offers the conversation.
 *  4. A supervisor reassigns the offered conversation to the agent: `Offered → Active`, owned by the
 *     agent. The reassign does not depend on whom the worker chose, so another eligible agent of the
 *     tenant cannot make the spec flaky; and it is retried only while the 30 s offer timeout has put
 *     the conversation back in the queue for the worker's next pass.
 */

/** Routing, the offer and the reassign: the worker polls every 2 s and offers time out after 30 s. */
const ROUTE_TIMEOUT = 45_000;

/** Platform serializes an `EntityId` as its string value; tolerate the `{ value }` object form. */
export function idOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return String((value as { value: unknown }).value);
  }
  throw new Error(`Unexpected id shape: ${JSON.stringify(value)}`);
}

/** A bearer-authenticated API context for one user — the agent's own calls (`/agents/me/*`). */
export async function bearerApiContext(
  playwright: { request: { newContext: (o?: object) => Promise<APIRequestContext> } },
  creds: Credentials,
): Promise<APIRequestContext> {
  const anonymous = await playwright.request.newContext();
  const login = await anonymous.post(`${API_BASE}/api/v1/auth/login`, { data: creds });
  expect(login.ok(), `login of ${creds.email} answered ${login.status()}`).toBe(true);
  const { accessToken } = (await login.json()) as LoginResult;
  await anonymous.dispose();
  return playwright.request.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}`, 'X-Tenant-Id': creds.tenantId },
  });
}

/**
 * Opens a WebChat visitor session and returns its id — the address the visitor's messages come from.
 *
 * Platform also creates an anonymous contact and an unowned conversation for the session; they are
 * not the ones the spec uses (the visitor's messages resolve the contact by the session id).
 */
export async function openWebChatSession(
  api: APIRequestContext,
  tenantId: string,
): Promise<string> {
  const session = await api.post(`${API_BASE}/api/v1/webchat/sessions`, { data: { tenantId } });
  expect(session.status(), 'open webchat session').toBe(200);
  return ((await session.json()) as { sessionId: string }).sessionId;
}

interface ConversationView {
  state?: string;
  owner?: { kind?: string; ownerId?: unknown } | null;
}

async function readConversation(
  api: APIRequestContext,
  conversationId: string,
): Promise<ConversationView> {
  const response = await api.get(`${API_BASE}/api/v1/conversations/${conversationId}`);
  expect(response.status(), `read conversation ${conversationId}`).toBe(200);
  return (await response.json()) as ConversationView;
}

export interface RoutedConversation {
  /** The queue routing chose; the agent is a member of it until {@link leaveQueue}. */
  queueId: string;
}

/**
 * Routes the conversation and gives it to the agent (steps 2–4 above). `api` is a supervisor-or-admin
 * context of the tenant; `agentApi` is the agent's own ({@link bearerApiContext}). On return the
 * conversation is `Active` and owned by `agentId`.
 */
export async function activateForAgent(
  api: APIRequestContext,
  agentApi: APIRequestContext,
  ids: { conversationId: string; sessionId: string; agentId: string },
): Promise<RoutedConversation> {
  const { conversationId, sessionId, agentId } = ids;

  const message = await api.post(`${API_BASE}/api/v1/webchat/sessions/${sessionId}/messages`, {
    data: { text: `hello from the e2e visitor ${sessionId}` },
  });
  expect(message.status(), 'visitor message').toBe(200);

  let queueId = '';
  await expect
    .poll(
      async () => {
        const { owner } = await readConversation(api, conversationId);
        queueId = owner?.kind === 'Queue' && owner.ownerId ? idOf(owner.ownerId) : '';
        return queueId;
      },
      { message: 'routing assigns the conversation to a queue', timeout: ROUTE_TIMEOUT },
    )
    .not.toBe('');

  const member = await api.post(`${API_BASE}/api/v1/queues/${queueId}/members`, {
    data: { agentId, allowedChannels: ['WebChat'] },
  });
  expect(member.status(), `add ${agentId} to queue ${queueId}`).toBe(201);

  const available = await agentApi.put(`${API_BASE}/api/v1/agents/me/state`, {
    data: { state: 'Available' },
  });
  expect(available.status(), 'agent goes Available').toBe(200);
  // The liveness reaper takes a routable agent with no heartbeat back to Offline.
  const heartbeat = await agentApi.post(`${API_BASE}/api/v1/agents/me/heartbeat`);
  expect(heartbeat.ok(), `agent heartbeat answered ${heartbeat.status()}`).toBe(true);

  await expect(async () => {
    const { state } = await readConversation(api, conversationId);
    expect(state, 'the distribution worker offers the conversation').toBe('Offered');
    const reassigned = await api.post(
      `${API_BASE}/api/v1/supervisor/conversations/${conversationId}/reassign`,
      { data: { targetAgentId: agentId } },
    );
    expect(reassigned.status(), `reassign the offered conversation to ${agentId}`).toBe(204);
  }).toPass({ timeout: ROUTE_TIMEOUT });

  const active = await readConversation(api, conversationId);
  expect(active.state).toBe('Active');
  expect(active.owner?.kind).toBe('Agent');
  expect(idOf(active.owner?.ownerId)).toBe(agentId);
  return { queueId };
}

/** Best effort: takes the agent back out of the queue routing chose. */
export async function leaveQueue(
  api: APIRequestContext,
  routed: RoutedConversation | undefined,
  agentId: string,
): Promise<void> {
  if (!routed) return;
  await api
    .delete(`${API_BASE}/api/v1/queues/${routed.queueId}/members/${agentId}`)
    .catch(() => {});
}
