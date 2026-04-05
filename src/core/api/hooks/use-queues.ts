import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface Queue {
  id: string;
  name: string;
  isActive: boolean;
  maxWaiting?: number;
  timezone?: string;
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
  schedule: {
    day: string;
    open: string;
    close: string;
    enabled: boolean;
  }[];
  dispositionCodes: string[];
  agentIds: string[];
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
    queryFn: () =>
      customFetch<Queue>({ url: `/api/v1/admin/queues/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<Queue, 'id' | 'createdAt'>>) =>
      customFetch<Queue>({ url: '/api/v1/admin/queues', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success('Queue created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<Omit<Queue, 'id' | 'createdAt'>>) =>
      customFetch<Queue>({
        url: `/api/v1/admin/queues/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success('Queue updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/queues/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['queues'] });
      toast.success('Queue deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
