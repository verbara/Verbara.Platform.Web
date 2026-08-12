// R5.2 PA.1 — MFA admin hooks.
//
// Backend surface (PlatformAdminOnly + `system:mfa:manage` permission):
//   - GET   /api/v1/management/mfa/users?status=...&tenant=...&page=...&pageSize=...
//   - POST  /api/v1/management/mfa/users/{id}/reset
//   - POST  /api/v1/management/mfa/users/{id}/sessions/revoke
//
// The list endpoint returns a `PagedResult<MfaUserSummary>`. Reset / revoke
// return 204; the page reflects the new status by invalidating the list query.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { customFetch } from '@/core/api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MfaUserStatus = 'enrolled' | 'not-enrolled' | 'locked';

export interface MfaUserSummary {
  readonly userId: string;
  readonly username: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly status: MfaUserStatus;
  readonly enrolledAt: string | null;
  readonly lastUsedAt: string | null;
}

interface PagedResult<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface MfaUserListFilter {
  readonly status?: MfaUserStatus | '';
  readonly tenant?: string | '';
  readonly page?: number;
  readonly pageSize?: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const LIST_KEY = ['management', 'mfa', 'users'] as const;

export function useMfaUsers(filter: MfaUserListFilter = {}) {
  const { status, tenant, page = 1, pageSize = 50 } = filter;
  return useQuery({
    queryKey: [...LIST_KEY, status ?? '', tenant ?? '', page, pageSize] as const,
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (status) params.status = status;
      if (tenant) params.tenant = tenant;
      return customFetch<PagedResult<MfaUserSummary>>({
        url: '/api/v1/management/mfa/users',
        method: 'GET',
        params,
      });
    },
    placeholderData: (prev) => prev,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useResetMfa() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (userId: string) =>
      customFetch<void>({
        url: `/api/v1/management/mfa/users/${userId}/reset`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      toast.success(t('toasts.mfa.reset'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRevokeMfaSessions() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (userId: string) =>
      customFetch<void>({
        url: `/api/v1/management/mfa/users/${userId}/sessions/revoke`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      toast.success(t('toasts.mfa.sessionsRevoked'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
