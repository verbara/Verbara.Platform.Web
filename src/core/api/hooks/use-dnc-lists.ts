import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface DncListSummary {
  id: number;
  name: string;
  scope: string;
  entryCount: number;
  createdAt: string;
}

export interface DncEntry {
  id: number;
  phoneNumber: string;
  reason?: string;
  expiresAt?: string;
  createdAt: string;
}

interface DncCheckResult {
  phoneNumber: string;
  isBlocked: boolean;
  matchedListId?: number;
  matchedListName?: string;
}

export function useDncLists() {
  return useQuery({
    queryKey: ['dnc-lists'],
    queryFn: () =>
      customFetch<DncListSummary[]>({ url: '/api/v1/admin/dnc-lists', method: 'GET' }),
  });
}

export function useDncList(id: number) {
  return useQuery({
    queryKey: ['dnc-list', id],
    queryFn: () =>
      customFetch<DncListSummary>({ url: `/api/v1/admin/dnc-lists/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useDncEntries(listId: number, offset = 0, limit = 100) {
  return useQuery({
    queryKey: ['dnc-entries', listId, offset, limit],
    queryFn: () =>
      customFetch<DncEntry[]>({
        url: `/api/v1/admin/dnc-lists/${listId}/entries`,
        method: 'GET',
        params: { offset: String(offset), limit: String(limit) },
      }),
    enabled: !!listId,
  });
}

export function useCreateDncList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Omit<DncListSummary, 'id' | 'entryCount' | 'createdAt'>>) =>
      customFetch<DncListSummary>({ url: '/api/v1/admin/dnc-lists', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      toast.success('DNC list created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateDncList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Partial<Omit<DncListSummary, 'id' | 'entryCount' | 'createdAt'>>) =>
      customFetch<DncListSummary>({ url: `/api/v1/admin/dnc-lists/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      qc.invalidateQueries({ queryKey: ['dnc-list', variables.id] });
      toast.success('DNC list updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDncList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/dnc-lists/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      toast.success('DNC list deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddDncEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      ...data
    }: { listId: number } & Partial<Omit<DncEntry, 'id' | 'createdAt'>>) =>
      customFetch<DncEntry>({
        url: `/api/v1/admin/dnc-lists/${listId}/entries`,
        method: 'POST',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['dnc-entries', variables.listId] });
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      toast.success('DNC entry added');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveDncEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ listId, entryId }: { listId: number; entryId: number }) =>
      customFetch<void>({
        url: `/api/v1/admin/dnc-lists/${listId}/entries/${entryId}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['dnc-entries', variables.listId] });
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      toast.success('DNC entry removed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useImportDncEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      listId,
      entries,
    }: {
      listId: number;
      entries: Partial<Omit<DncEntry, 'id' | 'createdAt'>>[];
    }) =>
      customFetch<void>({
        url: `/api/v1/admin/dnc-lists/${listId}/import`,
        method: 'POST',
        data: entries,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['dnc-entries', variables.listId] });
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      toast.success('DNC entries imported');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCheckDncNumber() {
  return useMutation({
    mutationFn: ({ listId, phoneNumber }: { listId: number; phoneNumber: string }) =>
      customFetch<DncCheckResult>({
        url: `/api/v1/admin/dnc-lists/${listId}/check/${encodeURIComponent(phoneNumber)}`,
        method: 'GET',
      }),
    onError: (err: Error) => toast.error(err.message),
  });
}
