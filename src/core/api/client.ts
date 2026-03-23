import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';

interface RequestConfig {
  url: string;
  method: string;
  data?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function customFetch<T>(config: RequestConfig): Promise<T> {
  const { apiKey } = useAuthStore.getState();
  const { activeTenantId } = useTenantStore.getState();
  const tenantId = activeTenantId ?? useAuthStore.getState().tenantId;

  const url = new URL(config.url, window.location.origin);
  if (config.params) {
    Object.entries(config.params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const response = await fetch(url.toString(), {
    method: config.method,
    body: config.data ? JSON.stringify(config.data) : undefined,
    signal: config.signal,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      ...(tenantId && { 'X-Tenant-Id': tenantId }),
    },
  });

  if (response.status === 401) {
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail ?? `API error: ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}
