import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { onHubEvent } from '@/core/realtime';
import { useRealtimeStore } from '@/core/stores/realtime-store';

export interface ClusterNodeStatePayload {
  nodeId: string;
  previousState: string;
  newState: string;
  changedAt: string;
}

/**
 * Subscribe to real-time cluster node state transitions published by the Pro T27
 * cluster bridge and forwarded via `PlatformHub` to the `admins:platform`
 * SignalR group that connections with the `PlatformAdmin` role auto-join.
 *
 * On each event the hook invalidates the React Query `['cluster']` family
 * (status + nodes + instances queries) so the admin cluster page refreshes
 * without manual polling.
 *
 * If `nodeId` is supplied, only events for that node trigger invalidation;
 * otherwise every cluster node transition triggers.
 *
 * No-op for connections without `PlatformAdmin` — they never join the
 * `admins:platform` group so no OnClusterNodeStateChanged event is delivered.
 * The hook can be mounted unconditionally without guarding the role client-side.
 */
export function useClusterStateStream(nodeId?: string): void {
  const qc = useQueryClient();
  const connectionState = useRealtimeStore((s) => s.connectionState);

  useEffect(() => {
    if (connectionState !== 'connected') return;

    const unsubscribe = onHubEvent<ClusterNodeStatePayload>(
      'OnClusterNodeStateChanged',
      (evt) => {
        if (nodeId && evt.nodeId !== nodeId) return;
        void qc.invalidateQueries({ queryKey: ['cluster'] });
      },
    );

    return () => unsubscribe();
  }, [nodeId, connectionState, qc]);
}
