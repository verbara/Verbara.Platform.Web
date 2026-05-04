import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import { useAuditSearch, useEntityHistory } from './use-audit';
import type { AuditEntry } from './use-audit';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockAuditEntry: AuditEntry = {
  entryId: 'ae1',
  occurredAt: '2026-01-01T00:00:00Z',
  action: 'user.created',
  category: 'users',
  severity: 'info',
  actorId: 'u1',
  actorType: 'user',
  targetId: 'u2',
  targetType: 'user',
  entityType: 'user',
  entityId: 'u2',
  performedBy: 'admin@example.com',
  metadata: null,
  details: null,
};

describe('useAuditSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search audit entries with default params', async () => {
    const pagedResult = {
      items: [mockAuditEntry],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      hasNextPage: false,
    };
    vi.mocked(client.customFetch).mockResolvedValue(pagedResult);
    const { result } = renderHook(() => useAuditSearch({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(pagedResult);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/audit',
      method: 'GET',
      params: { page: '1', pageSize: '25' },
    });
  });

  it('should pass filter params correctly', async () => {
    const pagedResult = {
      items: [mockAuditEntry],
      totalCount: 1,
      page: 1,
      pageSize: 25,
      hasNextPage: false,
    };
    vi.mocked(client.customFetch).mockResolvedValue(pagedResult);
    const { result } = renderHook(
      () =>
        useAuditSearch({
          action: 'user.created',
          entityType: 'user',
          performedBy: 'admin@example.com',
          from: '2026-01-01',
          to: '2026-01-31',
          page: 2,
          pageSize: 10,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/audit',
      method: 'GET',
      params: {
        action: 'user.created',
        entityType: 'user',
        performedBy: 'admin@example.com',
        from: '2026-01-01',
        to: '2026-01-31',
        page: '2',
        pageSize: '10',
      },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useAuditSearch({}), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useEntityHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch entity history', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockAuditEntry]);
    const { result } = renderHook(() => useEntityHistory('user', 'u2'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockAuditEntry]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/audit/user/u2',
      method: 'GET',
    });
  });

  it('should not fetch when entityType is undefined', () => {
    const { result } = renderHook(() => useEntityHistory(undefined, 'u2'), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should not fetch when entityId is undefined', () => {
    const { result } = renderHook(() => useEntityHistory('user', undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useEntityHistory('user', 'u2'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
