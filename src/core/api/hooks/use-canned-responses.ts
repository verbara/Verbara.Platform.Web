import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface CannedResponse {
  responseId: string;
  shortcut: string;
  title: string;
  body: string;
  category: string | null;
  tags: string[];
  createdBy: string;
  createdAt: string;
}

export interface CreateCannedResponseRequest {
  shortcut: string;
  title: string;
  body: string;
  category?: string;
  tags?: string[];
}

export interface UpdateCannedResponseRequest {
  shortcut?: string;
  title?: string;
  body?: string;
  category?: string;
  tags?: string[];
}

export function useCannedResponses() {
  return useQuery({
    queryKey: ['canned-responses', 'list'],
    queryFn: () =>
      customFetch<CannedResponse[]>({
        url: '/api/v1/admin/canned-responses',
        method: 'GET',
      }),
  });
}

export function useSearchCannedResponses(query: string) {
  return useQuery({
    queryKey: ['canned-responses', 'search', query],
    queryFn: () =>
      customFetch<CannedResponse[]>({
        url: '/api/v1/canned-responses',
        method: 'GET',
        params: query ? { q: query } : undefined,
      }),
    enabled: query.length > 0,
  });
}

export function useCreateCannedResponse() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateCannedResponseRequest) =>
      customFetch<CannedResponse>({
        url: '/api/v1/admin/canned-responses',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-responses', 'list'] });
      toast.success(t('toasts.cannedResponses.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCannedResponse() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCannedResponseRequest & { id: string }) =>
      customFetch<CannedResponse>({
        url: `/api/v1/admin/canned-responses/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-responses', 'list'] });
      toast.success(t('toasts.cannedResponses.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteCannedResponse() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/admin/canned-responses/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['canned-responses', 'list'] });
      toast.success(t('toasts.cannedResponses.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
