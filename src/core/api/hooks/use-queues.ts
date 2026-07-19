import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** Server response is the named `QueueDto` schema (openapi-response-adoption, Platform/ADR-0035).
 *  Maps 1:1 to the hand-written interface (no client-only extension fields). The generated
 *  numeric/nested fields carry AOT `number | string` wire-unions and `EntityId` (typed `unknown`
 *  in the document); consumers that need a plain `string`/`number` coerce at the boundary. */
export type Queue = components['schemas']['QueueDto'];

export function useQueues() {
  return useQuery({
    queryKey: ['queues'],
    queryFn: async () => {
      const result = await customFetch<components['schemas']['PagedResultOfQueueDto']>({
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
