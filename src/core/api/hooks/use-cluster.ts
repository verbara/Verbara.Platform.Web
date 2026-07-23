import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

// ── Types ──

/**
 * Kept hand-written (openapi-typed-client-operations): read off `useClusterNodes`
 * (GET `/management/cluster/nodes`) and the create/update mutation responses, all of which the
 * document declares with `content?: never` (no response schema). It also carries `amiHostname`
 * and `amiPort` (read by `node-detail-drawer.tsx`) that the document's `MgmtClusterNodeDto`
 * omits — so it is not structurally interchangeable with that DTO either.
 */
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

/**
 * Kept hand-written (openapi-typed-client-operations): the drain/force-drain endpoints return
 * `content?: never` / `StatusUpdateResponse` (not a drain shape), and this type is nested in the
 * hand-written `ClusterStatus` below — so there is no matching response schema to swap onto.
 */
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

/**
 * Kept hand-written (openapi-typed-client-operations): `useClusterInstances`
 * (GET `/management/cluster/instances`) has `content?: never` (no response schema). The
 * document's `MgmtInstanceDto` is also a different shape (`ownedNodeIds`, no `startedAt`/
 * `activeChannels` — both read by `cluster-page.tsx`), so it is not interchangeable.
 */
export interface ClusterInstance {
  instanceId: string;
  startedAt: string;
  lastSeen: string;
  ownedNodes: string[];
  activeChannels: number;
}

/**
 * Kept hand-written (openapi-typed-client-operations): although GET `/management/cluster/status`
 * DOES declare `MgmtClusterStatusDto`, its nested `nodes`/`instances` are `MgmtClusterNodeDto`/
 * `MgmtInstanceDto`, which diverge from the `ClusterNode`/`ClusterInstance` fields the cluster UI
 * reads (`amiHostname`, `activeChannels`, `ownedNodes`). Swapping onto it would break those
 * consumers, so it stays hand-written until the nested DTOs carry those fields.
 */
export interface ClusterStatus {
  instanceId: string;
  nodes: ClusterNode[];
  totalChannels: number;
  totalAgents: number;
  activeDrains: DrainStatus[];
  instances: ClusterInstance[];
}

/**
 * Kept hand-written (openapi-typed-client-operations): the document's `CreateNodeRequest` makes
 * `weight`/`priorityTier`/`maxCapacity` REQUIRED (`number | string`), but the add-node form's zod
 * schema declares them `.optional()` (`number | undefined`) so the server can apply its defaults —
 * swapping onto the required shape would force the form to always send explicit values, changing
 * the create contract. `amiPort` alone would migrate, but the whole body cannot cleanly.
 */
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

/**
 * Kept hand-written (openapi-typed-client-operations): the document's `UpdateNodeRequest` adds a
 * required `tags` field and makes `weight`/`priorityTier`/`maxCapacity` required-nullable, whereas
 * the edit-node form submits only `{ weight, priorityTier, maxCapacity }` — swapping onto it would
 * force the form to send a `tags` payload it has no field for.
 */
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
      customFetch<ClusterInstance[]>({
        url: '/api/v1/management/cluster/instances',
        method: 'GET',
      }),
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
