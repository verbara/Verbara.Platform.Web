import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { ApiErrorMap } from '@/core/api/api-error';
import { toastApiError } from '@/core/api/toast-api-error';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface DncListSummary {
  id: number;
  name: string;
  scope: string;
  entryCount: number;
  createdAt: string;
}

/**
 * The scope a tenant administrator creates a list with. `POST/PUT /admin/dnc-lists` serve tenant
 * administrators only: Platform v2.31.1 answers 403 to a body naming `Global`, because a Global
 * list applies to every tenant and belongs to the host operator.
 */
export const TENANT_DNC_SCOPE = 'Tenant';

/**
 * The i18n key suffix of a list's scope (`dnc-lists.scope.<key>`). Platform answers the enum's name
 * (`Tenant`, `Global`); the comparison ignores case, and anything that is not Global is the tenant's.
 */
export function dncScopeKey(scope: string): 'global' | 'tenant' {
  return scope.toLowerCase() === 'global' ? 'global' : 'tenant';
}

/** `POST /admin/dnc-lists`: always a Tenant-scope list. */
export interface CreateDncListBody {
  name: string;
  scope: typeof TENANT_DNC_SCOPE;
}

/**
 * `PUT /admin/dnc-lists/{id}`: the name only. A scope left out keeps the stored one, so editing a
 * Global list never sends `Global` back (Platform refuses it with 403).
 */
export interface UpdateDncListBody {
  id: number;
  name: string;
}

export const DNC_LIST_SAVE_ERRORS: ApiErrorMap = {
  statuses: {
    403: { code: 'dnc-list-scope-refused', key: 'admin:dnc-lists.errors.scope_refused' },
  },
  fallback: { code: 'dnc-list-save-failed', key: 'admin:dnc-lists.errors.save_failed' },
};

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
    queryFn: () => customFetch<DncListSummary[]>({ url: '/api/v1/admin/dnc-lists', method: 'GET' }),
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
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateDncListBody) =>
      customFetch<DncListSummary>({ url: '/api/v1/admin/dnc-lists', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      toast.success(t('toasts.dncLists.created'));
    },
    onError: (err: unknown) => {
      toastApiError(err, DNC_LIST_SAVE_ERRORS, t);
    },
  });
}

export function useUpdateDncList() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateDncListBody) =>
      customFetch<DncListSummary>({ url: `/api/v1/admin/dnc-lists/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      qc.invalidateQueries({ queryKey: ['dnc-list', variables.id] });
      toast.success(t('toasts.dncLists.updated'));
    },
    onError: (err: unknown) => {
      toastApiError(err, DNC_LIST_SAVE_ERRORS, t);
    },
  });
}

export function useDeleteDncList() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>({ url: `/api/v1/admin/dnc-lists/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      toast.success(t('toasts.dncLists.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddDncEntry() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
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
      toast.success(t('toasts.dncLists.entryAdded'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveDncEntry() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ listId, entryId }: { listId: number; entryId: number }) =>
      customFetch<void>({
        url: `/api/v1/admin/dnc-lists/${listId}/entries/${entryId}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['dnc-entries', variables.listId] });
      qc.invalidateQueries({ queryKey: ['dnc-lists'] });
      toast.success(t('toasts.dncLists.entryRemoved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useImportDncEntries() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
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
      toast.success(t('toasts.dncLists.entriesImported'));
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
