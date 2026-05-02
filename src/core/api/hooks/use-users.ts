import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const result = await customFetch<PagedResult<User>>({
        url: '/api/v1/admin/users',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
      return result.items;
    },
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () =>
      customFetch<User>({ url: `/api/v1/admin/users/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: { email: string; displayName: string; role: string }) =>
      customFetch<User>({ url: '/api/v1/admin/users', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('toasts.users.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      displayName?: string;
      role?: string;
      status?: string;
    }) =>
      customFetch<User>({
        url: `/api/v1/admin/users/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('toasts.users.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/users/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success(t('toasts.users.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
