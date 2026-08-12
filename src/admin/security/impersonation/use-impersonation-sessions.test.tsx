import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import {
  useActiveImpersonationSessions,
  useImpersonationSessionHistory,
  type ImpersonationSessionDto,
} from './use-impersonation-sessions';

// `impersonation-admin-page.test.tsx` mocks this whole module to test the page in
// isolation, so the hooks themselves were never executed. These tests exercise the
// two query hooks directly — chiefly their query keys, which drive both caching and
// the refetch on filter change.

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const session: ImpersonationSessionDto = {
  id: 'sess-001',
  actorUserId: 'admin-1',
  actorTenantId: 'tenant-platform',
  targetUserId: 'user-9',
  targetTenantId: 'tenant-acme',
  reason: 'support ticket 4711',
  readOnly: true,
  startedAt: '2026-08-01T10:00:00Z',
  endedAt: null,
  status: 'Active',
  closeReason: null,
  timeRemainingSeconds: 900,
  expiresAt: '2026-08-01T10:15:00Z',
};

function paged(items: ImpersonationSessionDto[]) {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 50,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

describe('useActiveImpersonationSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Requests_ActiveEndpoint_When_Rendered', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(paged([session]));

    const { result } = renderHook(() => useActiveImpersonationSessions(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toEqual([session]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/impersonation/sessions/active',
      method: 'GET',
      params: { page: '1', pageSize: '50' },
    });
  });

  it('Sends_ActorTenantFilter_When_Provided', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(paged([]));

    const { result } = renderHook(
      () => useActiveImpersonationSessions({ actorTenantId: 'tenant-acme', page: 2, pageSize: 10 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/impersonation/sessions/active',
      method: 'GET',
      params: { page: '2', pageSize: '10', actorTenantId: 'tenant-acme' },
    });
  });
});

describe('useImpersonationSessionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Requests_HistoryEndpoint_When_Rendered', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(paged([{ ...session, status: 'Completed' }]));

    const { result } = renderHook(() => useImpersonationSessionHistory(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/impersonation/sessions/history',
      method: 'GET',
      params: { page: '1', pageSize: '50' },
    });
  });

  it('Sends_DateRange_When_FromAndToProvided', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(paged([]));

    const { result } = renderHook(
      () =>
        useImpersonationSessionHistory({
          actorTenantId: 'tenant-acme',
          from: '2026-07-01',
          to: '2026-08-01',
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/management/impersonation/sessions/history',
      method: 'GET',
      params: {
        page: '1',
        pageSize: '50',
        actorTenantId: 'tenant-acme',
        from: '2026-07-01',
        to: '2026-08-01',
      },
    });
  });

  it('Refetches_When_DateRangeChanges', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(paged([]));

    const { result, rerender } = renderHook(
      ({ from }: { from: string }) => useImpersonationSessionHistory({ from }),
      { wrapper, initialProps: { from: '2026-07-01' } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The range is part of the query key, so a new range is a distinct cache
    // entry and must hit the server rather than serve the previous window.
    rerender({ from: '2026-07-15' });
    await waitFor(() => expect(client.customFetch).toHaveBeenCalledTimes(2));

    const ranges = vi
      .mocked(client.customFetch)
      .mock.calls.map((args) => (args[0] as { params: Record<string, string> }).params.from);
    expect(ranges).toEqual(['2026-07-01', '2026-07-15']);
  });
});
