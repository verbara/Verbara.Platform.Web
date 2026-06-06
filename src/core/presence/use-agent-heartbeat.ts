/**
 * W3 — agent liveness heartbeat.
 *
 * While an agent tab is mounted on `/agent`, this hook posts a proof-of-life
 * beat on a FIXED interval, completely INDEPENDENT of user activity: an agent
 * idling between calls is still connected and must stay routable. The backend
 * writes a Redis presence key with a per-tenant TTL and a reaper forces Offline
 * any routable agent whose heartbeat stops (≤60s), so a transient missed beat is
 * harmless — the client only needs a best-effort signal.
 */
import { useEffect } from 'react';
import { customFetch } from '@/core/api/client';
import { useAuthStore } from '@/core/auth/auth-store';

/**
 * Fixed heartbeat cadence. Activity-INDEPENDENT and kept well under the server
 * presence TTL (60s) so a single dropped beat never lets the key expire.
 */
export const HEARTBEAT_INTERVAL_MS = 20_000;

/** Fire a single best-effort heartbeat. Skips when unauthenticated; never throws. */
function beat(): void {
  if (!useAuthStore.getState().accessToken) return;
  // Use customFetch so Authorization + X-Tenant-Id are handled for us. Errors
  // are swallowed — a transient miss is fine, the reaper TTL has margin. Note:
  // customFetch owns the auth hot-path, so a beat on an expired session may
  // trigger its refresh→logout/redirect (the SessionManager refreshes
  // proactively, so this is an edge case and ending a dead session is correct).
  void customFetch<void>({ url: '/api/v1/agents/me/heartbeat', method: 'POST' }).catch(() => {});
}

/**
 * Heartbeat while mounted and authenticated: one immediate beat, then every
 * {@link HEARTBEAT_INTERVAL_MS}. Mount this inside the `/agent` layout only.
 */
export function useAgentHeartbeat(): void {
  useEffect(() => {
    // One immediate beat so presence is asserted the moment the agent lands.
    beat();
    // Keep beating even when the tab is hidden: a backgrounded but open tab is
    // still connected. Real departure is handled separately (agent-departure).
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
}
