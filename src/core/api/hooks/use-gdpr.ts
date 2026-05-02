import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: { contactId: string }) =>
      customFetch<GdprExportResult>({
        url: '/api/v1/admin/gdpr/export',
        method: 'POST',
        data,
      }),
    onSuccess: () => toast.success(t('toasts.gdpr.dataExported')),
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Purge ---

export function useGdprPurge() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: { contactId: string; reason: string }) =>
      customFetch<PurgeResult>({
        url: '/api/v1/admin/gdpr/purge',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purge-log'] });
      toast.success(t('toasts.gdpr.contactDataPurged'));
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
        url: '/api/v1/management/gdpr/purge-log',
        method: 'GET',
        params: queryParams,
      }),
    placeholderData: (prev) => prev,
  });
}

// --- Purge Preview ---

export interface PurgePreview {
  conversations: number;
  messages: number;
  authEvents: number;
  auditEntries: number;
}

export function usePurgePreview(userId: string | undefined) {
  return useQuery({
    queryKey: ['gdpr', 'purge-preview', userId],
    queryFn: () =>
      customFetch<PurgePreview>({
        url: '/api/v1/admin/gdpr/purge-preview',
        method: 'GET',
        params: { userId: userId ?? '' },
      }),
    enabled: !!userId,
  });
}

// --- Purge User ---

export function useGdprPurgeUser() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: { userId: string; reason: string }) =>
      customFetch<PurgeResult>({
        url: '/api/v1/admin/gdpr/purge-user',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purge-log'] });
      toast.success(t('toasts.gdpr.userDataPurged'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- Retention Policy ---

export function useRetentionPolicy(tenantId: string) {
  return useQuery({
    queryKey: ['retention-policy', tenantId],
    queryFn: () =>
      customFetch<RetentionPolicy>({
        url: `/api/v1/management/tenants/${tenantId}/retention`,
        method: 'GET',
      }),
    enabled: !!tenantId,
  });
}

export function useUpdateRetentionPolicy(tenantId: string) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: UpdateRetentionPolicyRequest) =>
      customFetch<RetentionPolicy>({
        url: `/api/v1/management/tenants/${tenantId}/retention`,
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['retention-policy', tenantId] });
      toast.success(t('toasts.gdpr.retentionPolicyUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
