import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** Narrowed literal unions retained for the request-side form/select (`CreateTenantInput.type`)
 *  and the hook tests. The server `MgmtTenantDto` widens `status`/`type` to `string`, so these are
 *  no longer part of the response `Tenant` type below — consumers already treat both as `string`. */
export type TenantStatus =
  | 'Active'
  | 'Suspended'
  | 'Deleted'
  | 'Warning'
  | 'Degraded'
  | 'PendingDeletion';

export type TenantType = 'Platform' | 'Partner' | 'Customer';

/** Server response is the named `MgmtTenantDto` schema (openapi-response-adoption, Platform/ADR-0035).
 *  Field set is identical to the former hand-written interface; `status`/`type` are `string` and
 *  `maxConcurrentChannels`/`maxActiveCampaigns` are the AOT-safe `number | string` wire union. */
export type Tenant = components['schemas']['MgmtTenantDto'];

export interface TenantStats {
  tenantId: string;
  status: string;
  maxConcurrentChannels: number;
  maxActiveCampaigns: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTenantInput {
  tenantId: string;
  name: string;
  type?: TenantType;
  parentTenantId?: string;
  template?: string;
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
  metadata?: Record<string, string>;
}

export interface StatusUpdateResponse {
  id: string;
  status: string;
}

export interface UpdateTenantInput {
  name?: string;
  status?: string;
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
}

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: () => customFetch<Tenant[]>({ url: '/api/v1/management/tenants', method: 'GET' }),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenant', id],
    queryFn: () => customFetch<Tenant>({ url: `/api/v1/management/tenants/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: CreateTenantInput) =>
      customFetch<Tenant>({ url: '/api/v1/management/tenants', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(t('toasts.tenants.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateTenantInput) =>
      customFetch<Tenant>({ url: `/api/v1/management/tenants/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', variables.id] });
      toast.success(t('toasts.tenants.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/management/tenants/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success(t('toasts.tenants.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSuspendTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<StatusUpdateResponse>({
        url: `/api/v1/management/tenants/${id}/suspend`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', id] });
      toast.success(t('toasts.tenants.suspended'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useActivateTenant() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<StatusUpdateResponse>({
        url: `/api/v1/management/tenants/${id}/activate`,
        method: 'POST',
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', id] });
      toast.success(t('toasts.tenants.activated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
