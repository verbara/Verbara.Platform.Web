// R5.2 PB.1 — paged query hook backing the admin audit log viewer.
//
// Distinct from `core/api/hooks/use-audit-events.ts` (the per-resource history
// alias used by AuditTrailMini). This file is colocated with the page so the
// PB.1 surface owns its own query key + filter shape; sharing the legacy hook
// would couple the new viewer to the per-entity contract and re-introduce the
// `entityType/entityId` mental model the PB.1 spec deliberately moved away
// from.
//
// Backend: GET /api/v1/admin/audit/events (audit.read). Returns a paged
// `AuditEventDto` list and an `X-Audit-Retention-Days` response header that
// the page surfaces in its disclosure link.

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AuditEventDto {
  readonly entryId: string;
  readonly tenantId: string;
  readonly action: string;
  readonly category: string;
  readonly severity: string;
  readonly actorId: string;
  readonly actorType: string;
  readonly targetId: string | null;
  readonly targetType: string | null;
  readonly correlationId: string | null;
  readonly impersonatorId: string | null;
  readonly occurredAt: string;
  readonly status: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly metadata: Record<string, string> | null;
}

export interface AuditEventsPagedResult {
  readonly items: ReadonlyArray<AuditEventDto>;
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface AuditEventsQueryResult {
  readonly data: AuditEventsPagedResult | null;
  readonly retentionDays: number | null;
}

export interface AuditEventsFilter {
  readonly actionPrefix?: string;
  readonly actor?: string;
  readonly target?: string;
  readonly from?: string;
  readonly to?: string;
  readonly tenantId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

// ─── Fetcher ─────────────────────────────────────────────────────────────────

const QUERY_KEY = ['admin', 'audit', 'events'] as const;

function buildSearchParams(filter: AuditEventsFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.actionPrefix) params.set('actionPrefix', filter.actionPrefix);
  if (filter.actor) params.set('actor', filter.actor);
  if (filter.target) params.set('target', filter.target);
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.tenantId) params.set('tenantId', filter.tenantId);
  params.set('page', String(filter.page ?? 1));
  params.set('pageSize', String(filter.pageSize ?? 50));
  return params;
}

async function fetchAuditEvents(
  filter: AuditEventsFilter,
  signal: AbortSignal,
): Promise<AuditEventsQueryResult> {
  const params = buildSearchParams(filter);
  const url = `/api/v1/admin/audit/events?${params.toString()}`;

  const { accessToken } = useAuthStore.getState();
  const { activeTenantId } = useTenantStore.getState();
  const tenantId = activeTenantId ?? useAuthStore.getState().tenantId;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;

  const response = await fetch(url, { method: 'GET', headers, credentials: 'include', signal });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? `Audit events request failed: ${response.status}`);
  }

  const retentionHeader = response.headers.get('X-Audit-Retention-Days');
  const retentionDays = retentionHeader ? Number.parseInt(retentionHeader, 10) : null;
  const data = (await response.json()) as AuditEventsPagedResult;

  return { data, retentionDays: Number.isFinite(retentionDays) ? retentionDays : null };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuditEvents(filter: AuditEventsFilter = {}) {
  const { actionPrefix, actor, target, from, to, tenantId, page = 1, pageSize = 50 } = filter;
  return useQuery({
    queryKey: [
      ...QUERY_KEY,
      actionPrefix ?? '',
      actor ?? '',
      target ?? '',
      from ?? '',
      to ?? '',
      tenantId ?? '',
      page,
      pageSize,
    ] as const,
    queryFn: ({ signal }) =>
      fetchAuditEvents({ actionPrefix, actor, target, from, to, tenantId, page, pageSize }, signal),
    placeholderData: (prev) => prev,
  });
}
