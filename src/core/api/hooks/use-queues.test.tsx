import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQueues, useQueue, useCreateQueue, useUpdateQueue, useDeleteQueue } from './use-queues';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleQueue = {
  id: 'queue-1',
  name: 'Support Queue',
  isActive: true,
  maxWaiting: 50,
  requiredSkills: ['voice'],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('useQueues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch queues when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({
      items: [sampleQueue],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    });
    const { result } = renderHook(() => useQueues(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleQueue]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/queues',
      method: 'GET',
      params: { page: '1', pageSize: '100' },
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useQueues(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch queue by id when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleQueue);
    const { result } = renderHook(() => useQueue('queue-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleQueue);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/queues/queue-1',
      method: 'GET',
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useQueue(undefined), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useQueue('queue-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleQueue);
    const { result } = renderHook(() => useCreateQueue(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'Support Queue', isActive: true, requiredSkills: ['voice'] });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/queues',
      method: 'POST',
      data: { name: 'Support Queue', isActive: true, requiredSkills: ['voice'] },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation error'));
    const { result } = renderHook(() => useCreateQueue(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'Queue', isActive: true, requiredSkills: [] });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleQueue);
    const { result } = renderHook(() => useUpdateQueue(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'queue-1', name: 'Updated Queue' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/queues/queue-1',
      method: 'PUT',
      data: { name: 'Updated Queue' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Bad request'));
    const { result } = renderHook(() => useUpdateQueue(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'queue-1', name: 'Updated Queue' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteQueue(), { wrapper });
    act(() => {
      result.current.mutate('queue-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/queues/queue-1',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useDeleteQueue(), { wrapper });
    act(() => {
      result.current.mutate('queue-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
