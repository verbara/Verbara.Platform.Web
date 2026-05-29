import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
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
  /**
   * ADR-0026 Phase A.6 channel-aware membership. `null` means the agent is
   * a member for all channels the queue accepts (pre-v2.6.0 implicit
   * behavior). A populated list restricts membership to the listed channels
   * only and gates Asterisk sync (voice in list ⇒ sync; voice out ⇒ no sync).
   */
  allowedChannels?: string[] | null;
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
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      queueId,
      agentId,
      penalty,
      allowedChannels,
    }: {
      queueId: string;
      agentId: string;
      penalty?: number;
      /** ADR-0026 Phase A.6: omit (or null) = all channels; populated = restrict. */
      allowedChannels?: string[] | null;
    }) =>
      customFetch<QueueMember>({
        url: `/api/v1/queues/${queueId}/members`,
        method: 'POST',
        data: { agentId, penalty, allowedChannels: allowedChannels ?? undefined },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      qc.invalidateQueries({ queryKey: ['queues'] });
      qc.invalidateQueries({ queryKey: ['agents'] });
      qc.invalidateQueries({ queryKey: ['agent-memberships', variables.agentId] });
      toast.success(t('toasts.queueMembers.added'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveQueueMember() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
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
      qc.invalidateQueries({ queryKey: ['agent-memberships', variables.agentId] });
      toast.success(t('toasts.queueMembers.removed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

/**
 * Unified PATCH hook for queue membership updates. PATCH semantics mirror
 * the backend (ADR-0026 Phase A.6):
 * - `clearAllowedChannels: true` resets channels to NULL (= all channels)
 * - `allowedChannels` populated replaces the existing list
 * - both omitted preserves the existing value
 */
export function useUpdateQueueMember() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      queueId,
      agentId,
      penalty,
      isExcluded,
      allowedChannels,
      clearAllowedChannels,
    }: {
      queueId: string;
      agentId: string;
      penalty?: number;
      isExcluded?: boolean;
      allowedChannels?: string[];
      clearAllowedChannels?: boolean;
    }) =>
      customFetch<QueueMember>({
        url: `/api/v1/queues/${queueId}/members/${agentId}`,
        method: 'PATCH',
        data: { penalty, isExcluded, allowedChannels, clearAllowedChannels },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      qc.invalidateQueries({ queryKey: ['agent-memberships', variables.agentId] });
      toast.success(t('toasts.queueMembers.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useQueueMemberPause() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      queueId,
      agentId,
      reason,
    }: {
      queueId: string;
      agentId: string;
      reason?: string;
    }) =>
      customFetch<unknown>({
        url: `/api/v1/queues/${queueId}/members/${agentId}/pause`,
        method: 'POST',
        data: { reason },
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      toast.success(t('toasts.queueMembers.paused'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useQueueMemberResume() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ queueId, agentId }: { queueId: string; agentId: string }) =>
      customFetch<unknown>({
        url: `/api/v1/queues/${queueId}/members/${agentId}/resume`,
        method: 'POST',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['queue-members', variables.queueId] });
      toast.success(t('toasts.queueMembers.resumed'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
