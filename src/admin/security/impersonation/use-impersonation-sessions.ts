// R5.2 PB.2 — admin impersonation session-management hooks.
//
// Backend surface (PlatformAdminOnly + `security.impersonation.manage`):
//   - GET   /api/v1/management/impersonation/sessions/active
//   - POST  /api/v1/management/impersonation/sessions/{id}/revoke
//   - GET   /api/v1/management/impersonation/sessions/history?from=&to=
//
// Active list returns each session's `timeRemainingSeconds` so the page can
// render a live countdown that ticks client-side (no server poll per second
// required). Revoke takes a free-text reason that lands in the audit trail.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { customFetch } from '@/core/api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ImpersonationSessionStatus =
  | 'Active'
  | 'Completed'
  | 'ManuallyRevoked'
  | 'AutoTimedOut';

export interface ImpersonationSessionDto {
  readonly id: string;
  readonly actorUserId: string;
  readonly actorTenantId: string;
  readonly targetUserId: string | null;
  readonly targetTenantId: string;
  readonly reason: string | null;
  readonly readOnly: boolean;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly status: ImpersonationSessionStatus;
  readonly closeReason: string | null;
  readonly timeRemainingSeconds: number | null;
  /** ISO timestamp when the session will be auto-revoked, or null if disabled. */
  readonly expiresAt: string | null;
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

export interface ActiveSessionsFilter {
  readonly actorTenantId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface SessionHistoryFilter {
  readonly actorTenantId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface RevokeImpersonationSessionInput {
  readonly id: string;
  readonly reason: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const ACTIVE_KEY = ['admin', 'impersonation', 'sessions', 'active'] as const;
const HISTORY_KEY = ['admin', 'impersonation', 'sessions', 'history'] as const;

export function useActiveImpersonationSessions(filter: ActiveSessionsFilter = {}) {
  const { actorTenantId, page = 1, pageSize = 50 } = filter;
  return useQuery({
    queryKey: [...ACTIVE_KEY, actorTenantId ?? '', page, pageSize] as const,
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (actorTenantId) params.actorTenantId = actorTenantId;
      return customFetch<PagedResult<ImpersonationSessionDto>>({
        url: '/api/v1/management/impersonation/sessions/active',
        method: 'GET',
        params,
      });
    },
    placeholderData: (prev) => prev,
    // Re-poll the server every minute to pick up sessions started elsewhere
    // and to refresh `timeRemainingSeconds` (the client interpolates between
    // polls but a fresh value avoids drift on long sessions).
    refetchInterval: 60_000,
  });
}

export function useImpersonationSessionHistory(filter: SessionHistoryFilter = {}) {
  const { actorTenantId, from, to, page = 1, pageSize = 50 } = filter;
  return useQuery({
    queryKey: [
      ...HISTORY_KEY,
      actorTenantId ?? '',
      from ?? '',
      to ?? '',
      page,
      pageSize,
    ] as const,
    queryFn: () => {
      const params: Record<string, string> = {
        page: String(page),
        pageSize: String(pageSize),
      };
      if (actorTenantId) params.actorTenantId = actorTenantId;
      if (from) params.from = from;
      if (to) params.to = to;
      return customFetch<PagedResult<ImpersonationSessionDto>>({
        url: '/api/v1/management/impersonation/sessions/history',
        method: 'GET',
        params,
      });
    },
    placeholderData: (prev) => prev,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useRevokeImpersonationSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: RevokeImpersonationSessionInput) =>
      customFetch<void>({
        url: `/api/v1/management/impersonation/sessions/${id}/revoke`,
        method: 'POST',
        data: { reason },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ACTIVE_KEY });
      qc.invalidateQueries({ queryKey: HISTORY_KEY });
      toast.success('Session revoked.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
