import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface Disposition {
  id: string;
  name: string;
  category: string;
}

export function useDispositions() {
  return useQuery({
    queryKey: ['dispositions'],
    queryFn: () =>
      customFetch<Disposition[]>({
        url: '/api/v1/admin/dispositions',
        method: 'GET',
      }),
  });
}

export function useCreateDisposition() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: { name: string; category: string }) =>
      customFetch<Disposition>({
        url: '/api/v1/admin/dispositions',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispositions'] });
      toast.success(t('toasts.dispositions.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteDisposition() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/admin/dispositions/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispositions'] });
      toast.success(t('toasts.dispositions.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
