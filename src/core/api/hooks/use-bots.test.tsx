import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { Bot } from './use-bots';
import { useBots, useBot, useCreateBot, useUpdateBot, useDeleteBot } from './use-bots';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockBot: Bot = {
  id: 'b1',
  name: 'Support Bot',
  defaultFlowId: 'f1',
  fallbackQueueId: 'q1',
  confidenceThreshold: 0.7,
  maxTurns: 10,
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('useBots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch all bots', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockBot]);

    const { result } = renderHook(() => useBots(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockBot]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/bots',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useBots(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single bot by id', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockBot);

    const { result } = renderHook(() => useBot('b1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockBot);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/bots/b1',
      method: 'GET',
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useBot(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useBot('bad-id'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call POST /api/v1/admin/bots', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockBot);

    const { result } = renderHook(() => useCreateBot(), { wrapper });

    const data = { name: 'Support Bot', confidenceThreshold: 0.7, maxTurns: 10, isActive: true };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/bots',
      method: 'POST',
      data,
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation error'));

    const { result } = renderHook(() => useCreateBot(), { wrapper });

    act(() => {
      result.current.mutate({ name: '' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call PUT /api/v1/admin/bots/{id}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockBot);

    const { result } = renderHook(() => useUpdateBot(), { wrapper });

    const data = { id: 'b1', name: 'Updated Bot', confidenceThreshold: 0.8 };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/bots/b1',
      method: 'PUT',
      data: { name: 'Updated Bot', confidenceThreshold: 0.8 },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useUpdateBot(), { wrapper });

    act(() => {
      result.current.mutate({ id: 'bad', name: 'X' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call DELETE /api/v1/admin/bots/{id}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteBot(), { wrapper });

    act(() => {
      result.current.mutate('b1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/bots/b1',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(() => useDeleteBot(), { wrapper });

    act(() => {
      result.current.mutate('b1');
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
