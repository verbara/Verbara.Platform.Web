import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

export interface SystemInfo {
  version: string;
  tenantId: string;
  features: Record<string, boolean>;
  setupComplete?: boolean;
}

export interface LicenseInfo {
  tier: string;
  features: Record<string, boolean>;
  maxAgents: number;
}

export interface ClusterInfo {
  nodes: { id: string; status: string }[];
}

export function useSystemInfo() {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: () =>
      customFetch<SystemInfo>({
        url: '/api/admin/system/info',
        method: 'GET',
      }),
  });
}

export function useSystemLicense() {
  return useQuery({
    queryKey: ['system', 'license'],
    queryFn: () =>
      customFetch<LicenseInfo>({
        url: '/api/admin/system/license',
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
