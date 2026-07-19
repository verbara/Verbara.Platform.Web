import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** Server response is the named `TeamDto` schema (openapi-response-adoption, Platform/ADR-0035).
 *  `memberCount` is generated as the AOT-safe `number | string` wire union; consumers
 *  (`teams-page.tsx`) compare it numerically (`=== 0`, `!== 1`), so it is coerced to `number`
 *  at the fetch boundary below and narrowed to `number` here. */
export type Team = Omit<components['schemas']['TeamDto'], 'memberCount'> & {
  memberCount: number;
};

/** Boundary coercion for the AOT `number | string` union on `memberCount` (see {@link Team}). */
function normalizeTeam(dto: components['schemas']['TeamDto']): Team {
  return { ...dto, memberCount: Number(dto.memberCount) };
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const result = await customFetch<components['schemas']['PagedResultOfTeamDto']>({
        url: '/api/v1/admin/teams',
        method: 'GET',
        params: { page: '1', pageSize: '100' },
      });
      return result.items.map(normalizeTeam);
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
    select: normalizeTeam,
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
