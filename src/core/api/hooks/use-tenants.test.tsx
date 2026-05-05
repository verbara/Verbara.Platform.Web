import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import {
  useTenants,
  useTenant,
  useCreateTenant,
  useUpdateTenant,
  useDeleteTenant,
  useSuspendTenant,
  useActivateTenant,
} from './use-tenants';
import type { Tenant, TenantStatus, TenantType } from './use-tenants';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockStatus: TenantStatus = 'Active';
const mockType: TenantType = 'Customer';

const mockTenant: Tenant = {
  tenantId: 't1',
  name: 'Test Tenant',
  status: mockStatus,
  type: mockType,
  parentTenantId: null,
  maxConcurrentChannels: 100,
  maxActiveCampaigns: 10,
  metadata: {},
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('useTenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch tenants', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockTenant]);
    const { result } = renderHook(() => useTenants(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockTenant]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useTenants(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single tenant by id', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockTenant);
    const { result } = renderHook(() => useTenant('t1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockTenant);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1',
      method: 'GET',
    });
  });

  it('should not fetch when id is empty string', () => {
    const { result } = renderHook(() => useTenant(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useTenant('t1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a tenant', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockTenant);
    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    act(() => {
      result.current.mutate({ tenantId: 't1', name: 'Test Tenant' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants',
      method: 'POST',
      data: { tenantId: 't1', name: 'Test Tenant' },
    });
  });

  it('should handle error when creation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useCreateTenant(), { wrapper });
    act(() => {
      result.current.mutate({ tenantId: 't1', name: 'Test' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a tenant', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockTenant);
    const { result } = renderHook(() => useUpdateTenant(), { wrapper });
    act(() => {
      result.current.mutate({ id: 't1', name: 'Updated Tenant' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1',
      method: 'PUT',
      data: { name: 'Updated Tenant' },
    });
  });

  it('should handle error when update fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUpdateTenant(), { wrapper });
    act(() => {
      result.current.mutate({ id: 't1', name: 'X' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a tenant', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteTenant(), { wrapper });
    act(() => {
      result.current.mutate('t1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1',
      method: 'DELETE',
    });
  });

  it('should handle error when delete fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useDeleteTenant(), { wrapper });
    act(() => {
      result.current.mutate('t1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSuspendTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to suspend endpoint', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ id: 't1', status: 'Suspended' });
    const { result } = renderHook(() => useSuspendTenant(), { wrapper });
    act(() => {
      result.current.mutate('tenant-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/suspend',
      method: 'POST',
    });
  });

  it('should handle error when suspend fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useSuspendTenant(), { wrapper });
    act(() => {
      result.current.mutate('tenant-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useActivateTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to activate endpoint', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({ id: 't1', status: 'Active' });
    const { result } = renderHook(() => useActivateTenant(), { wrapper });
    act(() => {
      result.current.mutate('tenant-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/tenant-1/activate',
      method: 'POST',
    });
  });

  it('should handle error when activate fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useActivateTenant(), { wrapper });
    act(() => {
      result.current.mutate('tenant-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
