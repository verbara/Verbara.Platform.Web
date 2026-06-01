import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// NOTE: `timezone`, `schedule`, `dispositionCodes`, and `agentIds` were previously
// declared here and submitted by the queue form, but the backend never persisted
// them — Queue aggregate only has Hours (not wired through the API), and
// dispositions/agent membership live in separate endpoints. Fields removed to
// make the client honestly reflect the server contract. See feat(queues):
// QueueDto + clean form commit.
export interface Queue {
  id: string;
  name: string;
  isActive: boolean;
  maxWaiting?: number;
  slaTargets?: {
    answerWithinSeconds?: number;
    firstResponseWithinSeconds?: number;
    resolutionWithinSeconds?: number;
  };
  overflowRule?: {
    overflowQueueId: string;
    overflowAfterSeconds: number;
  };
  wrapUp?: {
    defaultWrapUpSeconds: number;
    forceWrapUp: boolean;
  };
  requiredSkills: string[];
  /** Per-queue auto-answer default (3B.2b) — agents whose own override is unset inherit this. */
  autoAnswerDefault?: boolean;
  createdAt: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useQueues() {
  return useQuery({
    queryKey: ['queues'],
    queryFn: async () => {
      const result = await customFetch<PagedResult<Queue>>({
        url: '/api/v1/admin/queues',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
      return result.items;
    },
  });
}

export function useQueue(id: string | undefined) {
  return useQuery({
    queryKey: ['queues', id],
    queryFn: () => customFetch<Queue>({ url: `/api/v1/admin/queues/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateQueue() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<Omit<Queue, 'id' | 'createdAt'>>) =>
      customFetch<Queue>({ url: '/api/v1/admin/queues', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success(t('toasts.queues.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateQueue() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Omit<Queue, 'id' | 'createdAt'>>) =>
      customFetch<Queue>({
        url: `/api/v1/admin/queues/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success(t('toasts.queues.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteQueue() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/queues/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success(t('toasts.queues.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
