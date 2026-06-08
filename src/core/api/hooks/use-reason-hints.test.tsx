import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import {
  useReasonHints,
  useCreateReasonHint,
  useUpdateReasonHint,
  useDeleteReasonHint,
} from './use-reason-hints';
import type { ReasonHint } from './use-reason-hints';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockHint: ReasonHint = {
  id: 'rh1',
  scope: 'Did',
  scopeRef: '+541143218765',
  reasonPath: '["CITAS","REPROG"]',
  priority: 0,
  isActive: true,
};

describe('useReasonHints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useReasonHints_ShouldFetchList_WhenCalled', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockHint]);
    const { result } = renderHook(() => useReasonHints(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockHint]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reason-hints',
      method: 'GET',
    });
  });

  it('useReasonHints_ShouldSurfaceError_WhenFetchFails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useReasonHints(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateReasonHint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useCreateReasonHint_ShouldPostBody_WhenMutated', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockHint);
    const { result } = renderHook(() => useCreateReasonHint(), { wrapper });
    act(() => {
      result.current.mutate({
        scope: 'Did',
        scopeRef: '+541143218765',
        reasonPath: '["CITAS","REPROG"]',
        priority: 0,
        isActive: true,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reason-hints',
      method: 'POST',
      data: {
        scope: 'Did',
        scopeRef: '+541143218765',
        reasonPath: '["CITAS","REPROG"]',
        priority: 0,
        isActive: true,
      },
    });
  });
});

describe('useUpdateReasonHint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useUpdateReasonHint_ShouldPutToIdUrl_WhenMutated', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockHint);
    const { result } = renderHook(() => useUpdateReasonHint(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'rh1', isActive: false });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reason-hints/rh1',
      method: 'PUT',
      data: { isActive: false },
    });
  });
});

describe('useDeleteReasonHint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useDeleteReasonHint_ShouldDeleteIdUrl_WhenMutated', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteReasonHint(), { wrapper });
    act(() => {
      result.current.mutate('rh1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/reason-hints/rh1',
      method: 'DELETE',
    });
  });
});
