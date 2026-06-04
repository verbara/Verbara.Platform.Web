/**
 * Mounted once inside the authenticated app shell. Wires the headless
 * {@link useSessionManager} hook to the concrete teardown side-effects and
 * renders the idle-warning dialog portal.
 *
 * Logout paths:
 *  - `onLogout` (local idle expiry / explicit "Sign out now"): the hook has
 *    already broadcast `'logout'` to sibling tabs, so we MUST NOT re-broadcast.
 *    We run the agent-aware {@link safeAgentTeardown} first — flipping a
 *    routable agent to `offline` so the ACD stops routing to this dying session
 *    — THEN clear local auth and redirect. The teardown is fire-and-redirect:
 *    the hook isn't blocked, but the redirect waits for the teardown (or its
 *    1.5s cap) so the offline PUT reliably lands before the page unloads.
 *  - `onRemoteLogout` (a `'logout'` arrived from another tab): another tab
 *    already tore down + broadcast, so we only clear local auth + redirect. No
 *    teardown PUT, no broadcast.
 *
 * `shouldSuppressWarning`: deliberate aux states (`Break`/`Lunch`/`Training`/
 * `DND`/`ACW` — the `/agents/me` `AgentState` enum names) mean the agent
 * stepped away on purpose and is non-routable — we suppress the idle nag rather
 * than logging them out. Non-agents and routable agents (`Available`/`Busy`)
 * are NOT suppressed. The wire value is normalized to lowercase before the
 * comparison, so the literal set is lowercase.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionManager } from './use-session-manager';
import { SessionWarningDialog } from './session-warning-dialog';
import { safeAgentTeardown } from './agent-teardown';
import { refreshAccessToken } from '@/core/api/client';
import { useAuthStore } from '@/core/auth/auth-store';
import type { Agent } from '@/core/api/hooks/use-agents';

/**
 * Deliberate, non-routable aux states — the idle warning is suppressed for these.
 * Lowercased `AgentState` enum names (`/agents/me` emits PascalCase, e.g. "DND"),
 * compared against a lowercased copy of `agent.state`.
 */
const SUPPRESS_WARNING_STATES = new Set(['break', 'lunch', 'training', 'acw', 'dnd']);

export function SessionManager() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  const onLogout = useCallback(() => {
    // Fire-and-redirect: don't block the hook. The redirect waits for the
    // teardown (or its internal 1.5s cap) so the offline PUT lands first.
    void safeAgentTeardown(queryClient).finally(() => {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    });
  }, [queryClient]);

  const onRemoteLogout = useCallback(() => {
    // Another tab already tore down + broadcast — just clear local auth + go.
    useAuthStore.getState().logout();
    window.location.href = '/login';
  }, []);

  const onRefresh = useCallback(() => {
    void refreshAccessToken();
  }, []);

  const shouldSuppressWarning = useCallback(() => {
    const agent = queryClient.getQueryData<Agent>(['agent-me']);
    if (!agent) return false;
    // `/agents/me` returns PascalCase `AgentState` enum names (e.g. "DND"), so
    // normalize before comparing against the lowercase suppression set.
    const state = (agent.state ?? '').toLowerCase();
    return SUPPRESS_WARNING_STATES.has(state);
  }, [queryClient]);

  const { warningOpen, secondsLeft, stayConnected, signOut } = useSessionManager({
    onLogout,
    onRemoteLogout,
    onRefresh,
    shouldSuppressWarning,
  });

  // App-shell is authenticated-only, but guard defensively: with no token there
  // is no session to manage, so render nothing (the hook's timers are harmless).
  if (!accessToken) return null;

  return (
    <SessionWarningDialog
      open={warningOpen}
      secondsLeft={secondsLeft}
      onStayConnected={stayConnected}
      onSignOut={signOut}
    />
  );
}
