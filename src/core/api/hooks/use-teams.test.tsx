import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeams, useTeam, useCreateTeam, useUpdateTeam, useDeleteTeam } from './use-teams';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleTeam = {
  id: 'team-1',
  name: 'Support Team',
  memberCount: 5,
  createdAt: '2026-01-01T00:00:00Z',
};

describe('useTeams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch teams when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({
      items: [sampleTeam],
      totalCount: 1,
      page: 1,
      pageSize: 100,
    });
    const { result } = renderHook(() => useTeams(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleTeam]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/teams',
      method: 'GET',
      params: { page: '1', pageSize: '100' },
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useTeams(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch team by id when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleTeam);
    const { result } = renderHook(() => useTeam('team-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleTeam);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/teams/team-1',
      method: 'GET',
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useTeam(undefined), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useTeam('team-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleTeam);
    const { result } = renderHook(() => useCreateTeam(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'Support Team' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/teams',
      method: 'POST',
      data: { name: 'Support Team' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Conflict'));
    const { result } = renderHook(() => useCreateTeam(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'Support Team' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleTeam);
    const { result } = renderHook(() => useUpdateTeam(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'team-1', name: 'Updated Team' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/teams/team-1',
      method: 'PUT',
      data: { name: 'Updated Team' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Bad request'));
    const { result } = renderHook(() => useUpdateTeam(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'team-1', name: 'Updated Team' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteTeam(), { wrapper });
    act(() => {
      result.current.mutate('team-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/teams/team-1',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useDeleteTeam(), { wrapper });
    act(() => {
      result.current.mutate('team-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
