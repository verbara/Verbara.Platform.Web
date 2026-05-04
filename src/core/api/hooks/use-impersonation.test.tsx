import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useImpersonate, useEndImpersonate } from './use-impersonation';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: {
    getState: vi.fn(() => ({
      accessToken: 'original-token',
      tenantId: 'tenant-original',
      startImpersonation: vi.fn(),
      endImpersonation: vi.fn(),
    })),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const impersonateResponse = {
  accessToken: 'impersonated-token',
  expiresAt: '2026-01-01T01:00:00Z',
  targetTenantId: 'tenant-target',
  targetTenantName: 'Target Corp',
  readOnly: false,
};

describe('useImpersonate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should impersonate a tenant', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(impersonateResponse);
    const { result } = renderHook(() => useImpersonate(), { wrapper });
    act(() => {
      result.current.mutate({ targetTenantId: 'tenant-target', readOnly: false });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/impersonate',
      method: 'POST',
      data: { targetTenantId: 'tenant-target', readOnly: false },
    });
    expect(result.current.data).toEqual(impersonateResponse);
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useImpersonate(), { wrapper });
    act(() => {
      result.current.mutate({ targetTenantId: 'tenant-target' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useEndImpersonate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should end impersonation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useEndImpersonate(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/impersonate',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useEndImpersonate(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
