import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onHubEvent } from '@/core/realtime';
import { useRealtimeStore } from '@/core/stores/realtime-store';

export interface AgentStateChangedPayload {
  agentId: string;
  previousState: string;
  newState: string;
  reasonCode?: string | null;
  changedAt: string;
  tenantId: string;
}

/**
 * Subscribe to real-time agent state transitions published by the Pro T27
 * agent bridge and forwarded via `PlatformHub` to the `tenant:{tenantId}`
 * group the current connection auto-joined on login.
 *
 * On each event the hook invalidates React Query caches:
 *   - `['agents']` — always
 *   - `['supervisor', 'conversations']` — always (presence may change assignment eligibility)
 *
 * If `agentId` is supplied, only events matching that id trigger invalidation.
 */
export function useAgentStateStream(agentId?: string): void {
  const qc = useQueryClient();
  const connectionState = useRealtimeStore((s) => s.connectionState);

  useEffect(() => {
    if (connectionState !== 'connected') return;

    const unsubscribe = onHubEvent<AgentStateChangedPayload>(
      'OnAgentStateChanged',
      (evt) => {
        if (agentId && evt.agentId !== agentId) return;

        void qc.invalidateQueries({ queryKey: ['agents'] });
        void qc.invalidateQueries({ queryKey: ['supervisor', 'conversations'] });
      },
    );

    return () => unsubscribe();
  }, [agentId, connectionState, qc]);
}
