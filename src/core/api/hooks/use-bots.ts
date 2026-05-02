import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface Bot {
  id: string;
  name: string;
  defaultFlowId?: string;
  fallbackQueueId?: string;
  confidenceThreshold: number;
  maxTurns: number;
  isActive: boolean;
  createdAt: string;
}

export function useBots() {
  return useQuery({
    queryKey: ['bots'],
    queryFn: () =>
      customFetch<Bot[]>({ url: '/api/v1/admin/bots', method: 'GET' }),
  });
}

export function useBot(id: string | undefined) {
  return useQuery({
    queryKey: ['bots', id],
    queryFn: () =>
      customFetch<Bot>({ url: `/api/v1/admin/bots/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateBot() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<Omit<Bot, 'id' | 'createdAt'>>) =>
      customFetch<Bot>({ url: '/api/v1/admin/bots', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast.success(t('toasts.bots.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBot() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<Omit<Bot, 'id' | 'createdAt'>>) =>
      customFetch<Bot>({
        url: `/api/v1/admin/bots/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast.success(t('toasts.bots.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBot() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/bots/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bots'] });
      toast.success(t('toasts.bots.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
