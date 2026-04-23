import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface QueueMember {
  queueId: string;
  agentId: string;
  displayName: string;
  penalty: number;
  isExcluded: boolean;
  isPaused: boolean;
  pauseReason?: string | null;
  source: 'Skill' | 'Manual';
}

/**
 * Canonical list hook for the queue-members RESTful endpoint
 * (Platform R5.1 Task I).
 *
 * Resolves the phantom `assignedAgents = []` in the queue-detail page by
 * hitting `GET /api/v1/queues/{queueId}/members` and returning the fully
 * composed list (skill-derived ∪ manual overrides - exclusions).
 */
export function useQueueMembers(queueId: string | undefined) {
  return useQuery({
    queryKey: ['queue-members', queueId],
    queryFn: () =>
      customFetch<QueueMember[]>({
        url: `/api/v1/queues/${queueId}/members`,
        method: 'GET',
      }),
    enabled: !!queueId,
  });
}

export function useAddQueueMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, agentId, penalty }: { queueId: string; agentId: string; penalty?: number }) =>
      customFetch<QueueMember>({
        url: `/api/v1/queues/${queueId}/members`,
        method: 'POST',
        data: { agentId, penalty },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      qc.invalidateQueries({ queryKey: ['queues'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Member added to queue');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveQueueMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, agentId }: { queueId: string; agentId: string }) =>
      customFetch<void>({
        url: `/api/v1/queues/${queueId}/members/${agentId}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      qc.invalidateQueries({ queryKey: ['queues'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Member removed from queue');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateQueueMemberPenalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      queueId,
      agentId,
      penalty,
      isExcluded,
    }: {
      queueId: string;
      agentId: string;
      penalty?: number;
      isExcluded?: boolean;
    }) =>
      customFetch<QueueMember>({
        url: `/api/v1/queues/${queueId}/members/${agentId}`,
        method: 'PATCH',
        data: { penalty, isExcluded },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      toast.success('Member updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useQueueMemberPause() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, agentId, reason }: { queueId: string; agentId: string; reason?: string }) =>
      customFetch<unknown>({
        url: `/api/v1/queues/${queueId}/members/${agentId}/pause`,
        method: 'POST',
        data: { reason },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      toast.success('Member paused');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useQueueMemberResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queueId, agentId }: { queueId: string; agentId: string }) =>
      customFetch<unknown>({
        url: `/api/v1/queues/${queueId}/members/${agentId}/resume`,
        method: 'POST',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      toast.success('Member resumed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
