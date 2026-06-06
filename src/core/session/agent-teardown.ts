/**
 * Agent-aware safe teardown run on local session expiry, BEFORE the auth store
 * is cleared and the tab redirects to `/login`.
 *
 * The routing-zombie problem: when an agent in a ROUTABLE state (`available` /
 * `busy`) idles out, the ACD on the backend keeps routing contacts to a session
 * that no longer exists — calls/chats land on a dead tab. To avoid that, a
 * routable agent is flipped to `offline` via `PUT /api/v1/agents/me/state`
 * before the session ends.
 *
 * Constraints:
 *  - A slow or failing PUT must NEVER hang logout: the request is raced against
 *    a short timeout, and any error is swallowed. Worst case we proceed after
 *    the cap and the backend's own presence sweep cleans up the stale routable
 *    state.
 *  - Non-routable agents (deliberate aux states), and non-agent users (no
 *    `['agent-me']` cache entry), skip the PUT entirely — there is nothing to
 *    flip and nothing being routed.
 */
import type { QueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { Agent } from '@/core/api/hooks/use-agents';

/** TanStack Query cache key for the self-scoped agent profile (`GET /agents/me`). */
const AGENT_ME_KEY = ['agent-me'] as const;

/**
 * Agent states the ACD will route NEW contacts to. Compared against a
 * lowercased copy of `agent.state` so it matches the real `/agents/me` wire
 * casing (PascalCase `AgentState` enum names, e.g. `"Busy"`) as well as any
 * already-lowercase value.
 *
 * Exported so the W3 graceful-departure beacon (`core/presence/agent-departure`)
 * reuses the SAME routable set + casing convention — do not duplicate it.
 */
export const ROUTABLE_STATES = new Set(['available', 'busy']);

/** Hard cap (ms) on the teardown PUT so a slow/failing call never hangs logout. */
const TEARDOWN_TIMEOUT_MS = 1_500;

/** Resolve after `ms`, ignoring the resolved value. */
function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Flip a routable agent to `offline` before the session ends so the ACD stops
 * routing to a dead session. No-op (returns immediately) for non-routable
 * agents and non-agent users. Always resolves — never throws, never blocks
 * past {@link TEARDOWN_TIMEOUT_MS}.
 */
export async function safeAgentTeardown(queryClient: QueryClient): Promise<void> {
  const agent = queryClient.getQueryData<Agent>(AGENT_ME_KEY);
  // `/agents/me` returns PascalCase `AgentState` enum names (e.g. "Busy"), so
  // normalize before comparing against the lowercase routable set.
  const state = (agent?.state ?? '').toLowerCase();
  if (!agent || !ROUTABLE_STATES.has(state)) {
    // Not an agent, or deliberately non-routable already — nothing to tear down.
    return;
  }

  const put = customFetch<void>({
    url: '/api/v1/agents/me/state',
    method: 'PUT',
    data: { state: 'offline' },
  });

  try {
    // Race the PUT against the cap so a hung/slow backend can't block logout.
    await Promise.race([put, timeout(TEARDOWN_TIMEOUT_MS)]);
  } catch {
    // Swallow: a failed flip must not block logout. The backend presence sweep
    // is the safety net for the stale routable state.
  }
}
