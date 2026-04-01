import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

// --- Types ---

export interface GdprExportResult {
  contact: unknown;
  conversations: unknown[];
  messages: unknown[];
  authEvents: unknown[];
  auditEntries: unknown[];
}

export interface PurgeResult {
  purgeId: string;
  tenantId: string;
  subjectType: string;
  subjectId: string;
  performedBy: string;
  reason: string;
  entitiesDeleted: Record<string, number>;
  purgedAt: string;
}

export interface PurgeEntry {
  purgeId: string;
  tenantId: string;
  subjectType: string;
  subjectId: string;
  performedBy: string;
  reason: string;
  entitiesDeleted: Record<string, number>;
  purgedAt: string;
}

export interface RetentionPolicy {
  tenantId: string;
  conversationRetentionDays: number | null;
  authEventRetentionDays: number | null;
  auditRetentionDays: number | null;
  usageRecordRetentionDays: number | null;
}

export interface UpdateRetentionPolicyRequest {
  conversationRetentionDays?: number | null;
  authEventRetentionDays?: number | null;
  auditRetentionDays?: number | null;
  usageRecordRetentionDays?: number | null;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// --- Export ---

export function useGdprExport() {
  return useMutation({
    mutationFn: (data: { contactId: string }) =>
      customFetch<GdprExportResult>({
        url: '/api/admin/gdpr/export',
        method: 'POST',
        data,
      }),
    onSuccess: () => toast.success('Data exported successfully'),
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Purge ---

export function useGdprPurge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { contactId: string; reason: string }) =>
      customFetch<PurgeResult>({
        url: '/api/admin/gdpr/purge',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purge-log'] });
      toast.success('Contact data purged');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Purge Log ---

export function usePurgeLog(params?: {
  tenantId?: string;
  from?: string;
  to?: string;
}) {
  const queryParams: Record<string, string> = {};
  if (params?.tenantId) queryParams.tenantId = params.tenantId;
  if (params?.from) queryParams.from = params.from;
  if (params?.to) queryParams.to = params.to;

  return useQuery({
    queryKey: ['purge-log', params],
    queryFn: () =>
      customFetch<PagedResult<PurgeEntry>>({
        url: '/api/management/gdpr/purge-log',
        method: 'GET',
        params: queryParams,
      }),
    placeholderData: (prev) => prev,
  });
}

// --- Retention Policy ---

export function useRetentionPolicy(tenantId: string) {
  return useQuery({
    queryKey: ['retention-policy', tenantId],
    queryFn: () =>
      customFetch<RetentionPolicy>({
        url: `/api/management/tenants/${tenantId}/retention`,
        method: 'GET',
      }),
    enabled: !!tenantId,
  });
}

export function useUpdateRetentionPolicy(tenantId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateRetentionPolicyRequest) =>
      customFetch<RetentionPolicy>({
        url: `/api/management/tenants/${tenantId}/retention`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-policy', tenantId] });
      toast.success('Retention policy updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
