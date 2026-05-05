import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import {
  useIpAllowlist,
  useAddIpAllowlistEntry,
  useRemoveIpAllowlistEntry,
  type IpAllowlistEntry,
} from './use-tenant-settings';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useIpAllowlist', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should GET /management/tenants/{id}/ip-allowlist', async () => {
    const entries: IpAllowlistEntry[] = [
      { id: 'e1', cidr: '10.0.0.0/8', description: 'VPN', createdAt: '2026-01-01T00:00:00Z' },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(entries);
    const { result } = renderHook(() => useIpAllowlist('t1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(entries);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1/ip-allowlist',
      method: 'GET',
    });
  });

  it('should not fetch when tenantId is empty', () => {
    const { result } = renderHook(() => useIpAllowlist(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useAddIpAllowlistEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should POST to /management/tenants/{id}/ip-allowlist', async () => {
    const entry: IpAllowlistEntry = {
      id: 'e2',
      cidr: '192.168.1.0/24',
      description: 'Office',
      createdAt: '2026-05-04T00:00:00Z',
    };
    vi.mocked(client.customFetch).mockResolvedValue(entry);
    const { result } = renderHook(() => useAddIpAllowlistEntry('t1'), { wrapper });
    act(() => {
      result.current.mutate({ cidr: '192.168.1.0/24', description: 'Office' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1/ip-allowlist',
      method: 'POST',
      data: { cidr: '192.168.1.0/24', description: 'Office' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useAddIpAllowlistEntry('t1'), { wrapper });
    act(() => {
      result.current.mutate({ cidr: '10.0.0.0/8', description: 'x' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRemoveIpAllowlistEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('should DELETE /management/tenants/{id}/ip-allowlist/{entryId}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveIpAllowlistEntry('t1'), { wrapper });
    act(() => {
      result.current.mutate('entry-abc');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/tenants/t1/ip-allowlist/entry-abc',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRemoveIpAllowlistEntry('t1'), { wrapper });
    act(() => {
      result.current.mutate('x');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
