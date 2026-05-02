import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface TrunkSummary {
  id: number;
  name: string;
  displayName: string;
  type: string;
  isActive: boolean;
  maxChannels: number;
}

export function useTrunks() {
  return useQuery({
    queryKey: ['trunks'],
    queryFn: () =>
      customFetch<TrunkSummary[]>({ url: '/api/v1/admin/trunks', method: 'GET' }),
  });
}

export function useTrunk(id: number) {
  return useQuery({
    queryKey: ['trunk', id],
    queryFn: () =>
      customFetch<TrunkSummary>({ url: `/api/v1/admin/trunks/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateTrunk() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Partial<Omit<TrunkSummary, 'id'>>) =>
      customFetch<TrunkSummary>({ url: '/api/v1/admin/trunks', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      toast.success(t('toasts.trunks.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTrunk() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Omit<TrunkSummary, 'id'>>) =>
      customFetch<TrunkSummary>({ url: `/api/v1/admin/trunks/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      qc.invalidateQueries({ queryKey: ['trunk', variables.id] });
      toast.success(t('toasts.trunks.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTrunk() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/trunks/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      toast.success(t('toasts.trunks.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActiveTrunks() {
  return useQuery({
    queryKey: ['trunks', 'active'],
    queryFn: () => customFetch<TrunkSummary[]>({ url: '/api/v1/admin/trunks/active', method: 'GET' }),
  });
}

export function useTrunkByName(name: string) {
  return useQuery({
    queryKey: ['trunks', 'by-name', name],
    queryFn: () => customFetch<TrunkSummary>({ url: `/api/v1/admin/trunks/by-name/${encodeURIComponent(name)}`, method: 'GET' }),
    enabled: !!name,
  });
}
