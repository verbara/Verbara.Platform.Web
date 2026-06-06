/**
 * W3 — graceful-departure beacon.
 *
 * When a routable agent's tab is actually going away (close, navigation,
 * bfcache) we fire a single best-effort `POST /agents/me/offline` so the ACD
 * stops routing to a dead session immediately, rather than waiting out the
 * backend reaper's presence TTL. The reaper remains the backstop if the beacon
 * is dropped.
 */
import { useEffect } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { ROUTABLE_STATES } from '@/core/session/agent-teardown';
import type { Agent } from '@/core/api/hooks/use-agents';

/** TanStack Query cache key for the self-scoped agent profile (`GET /agents/me`). */
const AGENT_ME_KEY = ['agent-me'] as const;

/**
 * Best-effort graceful-departure beacon. Skips entirely unless there is an
 * authenticated, routable agent (nothing is being routed to a non-routable
 * agent, so there is nothing to lose).
 *
 * CRITICAL — auth on unload: this uses raw `fetch(..., { keepalive: true })`,
 * NOT `customFetch` (its async token-refresh would not survive page unload) and
 * NOT `navigator.sendBeacon` (it cannot set the `Authorization` header — our
 * token is an in-memory Bearer token, not a cookie). Both `Authorization` and
 * `X-Tenant-Id` are set the same way `customFetch` resolves them: tenant id is
 * the tenant store's active tenant, falling back to the auth store's tenant.
 */
export function sendOfflineBeacon(queryClient: QueryClient): void {
  const { accessToken } = useAuthStore.getState();
  if (!accessToken) return; // Nothing to authenticate — nothing to do.

  const agent = queryClient.getQueryData<Agent>(AGENT_ME_KEY);
  // `/agents/me` returns PascalCase `AgentState` enum names (e.g. "Busy"), so
  // normalize before comparing against the lowercase routable set.
  const state = (agent?.state ?? '').toLowerCase();
  if (!agent || !ROUTABLE_STATES.has(state)) return;

  const tenantId = useTenantStore.getState().activeTenantId ?? useAuthStore.getState().tenantId;

  void fetch('/api/v1/agents/me/offline', {
    method: 'POST',
    keepalive: true,
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantId && { 'X-Tenant-Id': tenantId }),
    },
  }).catch(() => {});
}

/**
 * Fire {@link sendOfflineBeacon} on `pagehide` (tab close, navigation, bfcache).
 * Mount inside the `/agent` layout only.
 *
 * Deliberately NOT wired to `visibilitychange`/hidden: switching to another tab
 * is not leaving — firing offline there would falsely zombie an active agent.
 * The heartbeat keeps a backgrounded tab alive; only a real `pagehide` departs.
 */
export function useAgentDeparture(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handler = (): void => sendOfflineBeacon(queryClient);
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, [queryClient]);
}
