import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface ClusterNode {
  nodeId: string;
  state: string;
  weight: number;
  priorityTier: number;
  maxCapacity: number;
  asteriskVersion?: string;
  startupTime?: string;
}

export interface DrainStatus {
  nodeId: string;
  state: string;
  startedAt: string;
  deadline: string;
  initialCallCount: number;
  remainingCallCount: number;
  naturallyCompleted: number;
  forceDisconnected: number;
}

export interface ClusterStatus {
  instanceId: string;
  nodes: ClusterNode[];
  totalChannels: number;
  totalAgents: number;
  activeDrains: DrainStatus[];
}

export function useClusterStatus() {
  return useQuery({
    queryKey: ['cluster', 'status'],
    queryFn: () =>
      customFetch<ClusterStatus>({ url: '/api/admin/cluster/status', method: 'GET' }),
    refetchInterval: 15_000,
  });
}

export function useClusterNodes() {
  return useQuery({
    queryKey: ['cluster', 'nodes'],
    queryFn: () =>
      customFetch<ClusterNode[]>({ url: '/api/admin/cluster/nodes', method: 'GET' }),
    refetchInterval: 15_000,
  });
}

export function useDrainNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, gracePeriodSeconds }: { nodeId: string; gracePeriodSeconds?: number }) =>
      customFetch<DrainStatus>({
        url: `/api/admin/cluster/nodes/${nodeId}/drain`,
        method: 'POST',
        data: { gracePeriodSeconds },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cluster'] });
      toast.success(`Drain started for node ${variables.nodeId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
