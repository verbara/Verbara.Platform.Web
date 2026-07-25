import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** Server response is the named `TeamDto` schema (openapi-response-adoption, Platform/ADR-0035).
 *  `memberCount` is now single-typed `number` on the regenerated document
 *  (openapi-numeric-schema-truth, Platform/ADR-0036 strips the spurious AOT `string` arm at the
 *  source), so consumers (`teams-page.tsx`) that compare it numerically (`=== 0`, `!== 1`) read
 *  it directly. The former `Omit & { memberCount: number }` wrapper and its boundary coercion
 *  collapse to the generated DTO. */
export type Team = components['schemas']['TeamDto'];

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const result = await customFetch<components['schemas']['PagedResultOfTeamDto']>({
        url: '/api/v1/admin/teams',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
      return result.items;
    },
  });
}

export function useTeam(id: string | undefined) {
  return useQuery({
    queryKey: ['teams', id],
    queryFn: () =>
      customFetch<components['schemas']['TeamDto']>({
        url: `/api/v1/admin/teams/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: { name: string }) =>
      customFetch<components['schemas']['TeamDto']>({
        url: '/api/v1/admin/teams',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      toast.success(t('toasts.teams.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTeam() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string }) =>
      customFetch<components['schemas']['TeamDto']>({
        url: `/api/v1/admin/teams/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      toast.success(t('toasts.teams.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/teams/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      toast.success(t('toasts.teams.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
