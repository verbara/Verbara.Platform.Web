import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useRoutes,
  useRoute,
  useCreateRoute,
  useUpdateRoute,
  useDeleteRoute,
  useReorderRoutes,
} from './use-routes';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleRoute = {
  id: 1,
  pattern: '^\\+1',
  patternType: 'regex',
  trunkId: 5,
  priority: 1,
  overflowTrunkId: 6,
  dialPrefix: '9',
};

describe('useRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch routes when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleRoute]);
    const { result } = renderHook(() => useRoutes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleRoute]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/routes',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useRoutes(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch route by id when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleRoute);
    const { result } = renderHook(() => useRoute(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleRoute);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/routes/1',
      method: 'GET',
    });
  });

  it('should not fetch when id is 0', () => {
    const { result } = renderHook(() => useRoute(0), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useRoute(1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleRoute);
    const { result } = renderHook(() => useCreateRoute(), { wrapper });
    act(() => {
      result.current.mutate({ pattern: '^\\+1', patternType: 'regex', trunkId: 5, priority: 1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/routes',
      method: 'POST',
      data: { pattern: '^\\+1', patternType: 'regex', trunkId: 5, priority: 1 },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation error'));
    const { result } = renderHook(() => useCreateRoute(), { wrapper });
    act(() => {
      result.current.mutate({ pattern: 'x', patternType: 'glob', trunkId: 1, priority: 1 });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleRoute);
    const { result } = renderHook(() => useUpdateRoute(), { wrapper });
    act(() => {
      result.current.mutate({ id: 1, priority: 2, dialPrefix: '00' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/routes/1',
      method: 'PUT',
      data: { priority: 2, dialPrefix: '00' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Bad request'));
    const { result } = renderHook(() => useUpdateRoute(), { wrapper });
    act(() => {
      result.current.mutate({ id: 1, priority: 2 });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteRoute(), { wrapper });
    act(() => {
      result.current.mutate(1);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/routes/1',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useDeleteRoute(), { wrapper });
    act(() => {
      result.current.mutate(1);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useReorderRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useReorderRoutes(), { wrapper });
    act(() => {
      result.current.mutate([3, 1, 2]);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/routes/reorder',
      method: 'POST',
      data: [3, 1, 2],
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));
    const { result } = renderHook(() => useReorderRoutes(), { wrapper });
    act(() => {
      result.current.mutate([1, 2, 3]);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
