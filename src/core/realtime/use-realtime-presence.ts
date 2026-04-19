import { useEffect } from 'react';
import { useRealtimeStore, type AgentPresenceSnapshot } from '@/core/stores/realtime-store';
import { invokeHub } from './platform-hub';

/**
 * Subscribe to an agent's real-time presence updates. On mount the hook invokes
 * `SubscribeToAgentPresenceAsync(agentId)` on `PlatformHub` and joins the SignalR
 * group `presence:agent:{agentId}`; on unmount it leaves the group.
 *
 * Returns the latest snapshot for the agent from `useRealtimeStore`, or
 * `undefined` if no presence event has arrived yet.
 */
export function useRealtimePresence(agentId: string | undefined): AgentPresenceSnapshot | undefined {
  const snapshot = useRealtimeStore((s) => (agentId ? s.agentPresences[agentId] : undefined));
  const connectionState = useRealtimeStore((s) => s.connectionState);

  useEffect(() => {
    if (!agentId) return;
    if (connectionState !== 'connected') return;

    let cancelled = false;

    invokeHub('SubscribeToAgentPresenceAsync', agentId).catch(() => {
      /* hub transport will log; UI stays idle */
    });

    return () => {
      cancelled = true;
      invokeHub('UnsubscribeFromAgentPresenceAsync', agentId).catch(() => {
        /* ignore — cleanup is best-effort */
      });
      void cancelled;
    };
  }, [agentId, connectionState]);

  return snapshot;
}

/** Read all agent presence snapshots currently tracked by the hub. */
export function useAllPresences(): AgentPresenceSnapshot[] {
  return useRealtimeStore((s) => Object.values(s.agentPresences));
}
