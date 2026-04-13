import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

export interface AuditEntry {
  entryId: string;
  occurredAt: string;
  action: string;
  category?: string;
  severity?: string;
  actorId?: string;
  actorType?: string;
  targetId?: string | null;
  targetType?: string | null;
  entityType: string;
  entityId: string;
  performedBy: string | null;
  metadata?: Record<string, string> | null;
  details?: Record<string, string> | null;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

export interface AuditSearchParams {
  action?: string;
  entityType?: string;
  performedBy?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useAuditSearch(params: AuditSearchParams) {
  const { action, entityType, performedBy, from, to, page = 1, pageSize = 25 } = params;
  return useQuery({
    queryKey: ['audit', 'search', action, entityType, performedBy, from, to, page, pageSize],
    queryFn: () =>
      customFetch<PagedResult<AuditEntry>>({
        url: '/api/v1/admin/audit',
        method: 'GET',
        params: {
          ...(action && { action }),
          ...(entityType && { entityType }),
          ...(performedBy && { performedBy }),
          ...(from && { from }),
          ...(to && { to }),
          page: String(page),
          pageSize: String(pageSize),
        },
      }),
    placeholderData: (prev) => prev,
  });
}

export function useEntityHistory(entityType: string | undefined, entityId: string | undefined) {
  return useQuery({
    queryKey: ['audit', 'entity', entityType, entityId],
    queryFn: () =>
      customFetch<AuditEntry[]>({
        url: `/api/v1/admin/audit/${entityType}/${entityId}`,
        method: 'GET',
      }),
    enabled: !!entityType && !!entityId,
  });
}
