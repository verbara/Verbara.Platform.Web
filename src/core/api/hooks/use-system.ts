import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface SystemInfo {
  version: string;
  hostTenantId: string | null;
  platformName: string | null;
  features: Record<string, boolean>;
}

export interface LicenseInfo {
  isValid: boolean;
  licenseId: string | null;
  licensee: string | null;
  status: string;
  expiresAt: string | null;
  licensedFeatures: string[];
  maxNodes: number;
  lastValidatedAt: string;
}

export interface ClusterInfo {
  nodes: { id: string; status: string }[];
}

export interface SystemSettings {
  platformName: string;
  defaultTimezone: string;
  defaultLanguage: string;
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: () =>
      customFetch<SystemInfo>({
        url: '/api/management/system/info',
        method: 'GET',
      }),
  });
}

export function useSystemLicense() {
  return useQuery({
    queryKey: ['system', 'license'],
    queryFn: () =>
      customFetch<LicenseInfo>({
        url: '/api/management/system/license',
        method: 'GET',
      }),
  });
}

export function useSystemCluster() {
  return useQuery({
    queryKey: ['system', 'cluster'],
    queryFn: () =>
      customFetch<ClusterInfo>({
        url: '/api/admin/system/cluster',
        method: 'GET',
      }),
  });
}

export function useUpdateSystemSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SystemSettings) =>
      customFetch<SystemSettings>({
        url: '/api/management/system/settings',
        method: 'PUT',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system', 'settings'] });
      toast.success('System settings saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
