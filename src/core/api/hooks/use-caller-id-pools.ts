import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface CallerIdPoolSummary {
  id: number;
  name: string;
}

export interface CallerIdEntry {
  id: number;
  phoneNumber: string;
  areaCode: string;
  isActive: boolean;
}

export function useCallerIdPools() {
  return useQuery({
    queryKey: ['caller-id-pools'],
    queryFn: () =>
      customFetch<CallerIdPoolSummary[]>({ url: '/api/v1/admin/caller-id-pools', method: 'GET' }),
  });
}

export function useCallerIdPool(id: number) {
  return useQuery({
    queryKey: ['caller-id-pool', id],
    queryFn: () =>
      customFetch<CallerIdPoolSummary>({
        url: `/api/v1/admin/caller-id-pools/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useCallerIdPoolEntries(poolId: number) {
  return useQuery({
    queryKey: ['caller-id-pool-entries', poolId],
    queryFn: () =>
      customFetch<CallerIdEntry[]>({
        url: `/api/v1/admin/caller-id-pools/${poolId}/entries`,
        method: 'GET',
      }),
    enabled: !!poolId,
  });
}

export function useCreatePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<CallerIdPoolSummary, 'id'>>) =>
      customFetch<CallerIdPoolSummary>({
        url: '/api/v1/admin/caller-id-pools',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caller-id-pools'] });
      toast.success('Caller ID pool created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdatePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Partial<Omit<CallerIdPoolSummary, 'id'>>) =>
      customFetch<CallerIdPoolSummary>({
        url: `/api/v1/admin/caller-id-pools/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['caller-id-pools'] });
      qc.invalidateQueries({ queryKey: ['caller-id-pool', variables.id] });
      toast.success('Caller ID pool updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeletePool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/caller-id-pools/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caller-id-pools'] });
      toast.success('Caller ID pool deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddPoolEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      poolId,
      ...data
    }: { poolId: number } & Partial<Omit<CallerIdEntry, 'id'>>) =>
      customFetch<CallerIdEntry>({
        url: `/api/v1/admin/caller-id-pools/${poolId}/entries`,
        method: 'POST',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['caller-id-pool-entries', variables.poolId] });
      toast.success('Caller ID entry added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemovePoolEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ poolId, entryId }: { poolId: number; entryId: number }) =>
      customFetch<void>({
        url: `/api/v1/admin/caller-id-pools/${poolId}/entries/${entryId}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['caller-id-pool-entries', variables.poolId] });
      toast.success('Caller ID entry removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
