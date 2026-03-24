import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      customFetch<TrunkSummary[]>({ url: '/api/admin/trunks', method: 'GET' }),
  });
}

export function useTrunk(id: number) {
  return useQuery({
    queryKey: ['trunk', id],
    queryFn: () =>
      customFetch<TrunkSummary>({ url: `/api/admin/trunks/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateTrunk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<TrunkSummary, 'id'>>) =>
      customFetch<TrunkSummary>({ url: '/api/admin/trunks', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      toast.success('Trunk created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTrunk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Omit<TrunkSummary, 'id'>>) =>
      customFetch<TrunkSummary>({ url: `/api/admin/trunks/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      qc.invalidateQueries({ queryKey: ['trunk', variables.id] });
      toast.success('Trunk updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTrunk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/admin/trunks/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trunks'] });
      toast.success('Trunk deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
