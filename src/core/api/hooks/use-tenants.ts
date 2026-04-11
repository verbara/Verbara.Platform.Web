import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface Tenant {
  tenantId: string;
  name: string;
  status: string;
  maxConcurrentChannels: number;
  maxActiveCampaigns: number;
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

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
  maxConcurrentChannels?: number;
  maxActiveCampaigns?: number;
  metadata?: Record<string, string>;
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
    queryFn: () =>
      customFetch<Tenant[]>({ url: '/api/v1/management/tenants', method: 'GET' }),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenant', id],
    queryFn: () =>
      customFetch<Tenant>({ url: `/api/v1/management/tenants/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTenantInput) =>
      customFetch<Tenant>({ url: '/api/v1/management/tenants', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateTenantInput) =>
      customFetch<Tenant>({ url: `/api/v1/management/tenants/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', variables.id] });
      toast.success('Tenant updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/management/tenants/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
