import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

// ── Types ──

export interface ClusterNode {
  nodeId: string;
  state: string;
  weight: number;
  priorityTier: number;
  maxCapacity: number;
  asteriskVersion?: string;
  startupTime?: string;
  amiHostname?: string;
  amiPort?: number;
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

export interface ClusterInstance {
  instanceId: string;
  startedAt: string;
  lastSeen: string;
  ownedNodes: string[];
  activeChannels: number;
}

export interface ClusterStatus {
  instanceId: string;
  nodes: ClusterNode[];
  totalChannels: number;
  totalAgents: number;
  activeDrains: DrainStatus[];
  instances: ClusterInstance[];
}

export interface CreateNodeInput {
  nodeId: string;
  amiHostname: string;
  amiPort: number;
  amiUsername: string;
  amiPassword: string;
  weight?: number;
  priorityTier?: number;
  maxCapacity?: number;
}

export interface UpdateNodeInput {
  weight?: number;
  priorityTier?: number;
  maxCapacity?: number;
}

// ── Queries ──

export function useClusterStatus() {
  return useQuery({
    queryKey: ['cluster', 'status'],
    queryFn: () =>
      customFetch<ClusterStatus>({ url: '/api/v1/management/cluster/status', method: 'GET' }),
    refetchInterval: 10_000,
  });
}

export function useClusterNodes() {
  return useQuery({
    queryKey: ['cluster', 'nodes'],
    queryFn: () =>
      customFetch<ClusterNode[]>({ url: '/api/v1/management/cluster/nodes', method: 'GET' }),
    refetchInterval: 10_000,
  });
}

export function useClusterInstances() {
  return useQuery({
    queryKey: ['cluster', 'instances'],
    queryFn: () =>
      customFetch<ClusterInstance[]>({ url: '/api/v1/management/cluster/instances', method: 'GET' }),
    refetchInterval: 10_000,
  });
}

// ── Mutations ──

export function useCreateNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNodeInput) =>
      customFetch<ClusterNode>({
        url: '/api/v1/management/cluster/nodes',
        method: 'POST',
        data: input,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cluster'] });
      toast.success(`Node "${variables.nodeId}" created`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, ...input }: UpdateNodeInput & { nodeId: string }) =>
      customFetch<ClusterNode>({
        url: `/api/v1/management/cluster/nodes/${nodeId}`,
        method: 'PUT',
        data: input,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cluster'] });
      toast.success(`Node "${variables.nodeId}" updated`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) =>
      customFetch<void>({
        url: `/api/v1/management/cluster/nodes/${nodeId}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, nodeId) => {
      qc.invalidateQueries({ queryKey: ['cluster'] });
      toast.success(`Node "${nodeId}" removed`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDrainNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, gracePeriodSeconds }: { nodeId: string; gracePeriodSeconds?: number }) =>
      customFetch<DrainStatus>({
        url: `/api/v1/management/cluster/nodes/${nodeId}/drain`,
        method: 'POST',
        data: { gracePeriodSeconds },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['cluster'] });
      toast.success(`Drain started for node "${variables.nodeId}"`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelDrain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) =>
      customFetch<void>({
        url: `/api/v1/management/cluster/nodes/${nodeId}/drain`,
        method: 'DELETE',
      }),
    onSuccess: (_data, nodeId) => {
      qc.invalidateQueries({ queryKey: ['cluster'] });
      toast.success(`Drain cancelled for node "${nodeId}"`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useForceDrain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (nodeId: string) =>
      customFetch<DrainStatus>({
        url: `/api/v1/management/cluster/nodes/${nodeId}/force-drain`,
        method: 'POST',
      }),
    onSuccess: (_data, nodeId) => {
      qc.invalidateQueries({ queryKey: ['cluster'] });
      toast.success(`Force drain started for node "${nodeId}"`);
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
