import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useTrunks,
  useTrunk,
  useCreateTrunk,
  useUpdateTrunk,
  useDeleteTrunk,
  useActiveTrunks,
  useTrunkByName,
} from './use-trunks';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleTrunk = {
  id: 1,
  name: 'trunk-main',
  displayName: 'Main Trunk',
  type: 'sip',
  isActive: true,
  maxChannels: 30,
};

describe('useTrunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch trunks when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleTrunk]);
    const { result } = renderHook(() => useTrunks(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleTrunk]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/trunks',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useTrunks(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useTrunk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch trunk by id when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleTrunk);
    const { result } = renderHook(() => useTrunk(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleTrunk);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/trunks/1',
      method: 'GET',
    });
  });

  it('should not fetch when id is 0', () => {
    const { result } = renderHook(() => useTrunk(0), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useTrunk(1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateTrunk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleTrunk);
    const { result } = renderHook(() => useCreateTrunk(), { wrapper });
    act(() => {
      result.current.mutate({
        name: 'trunk-main',
        displayName: 'Main Trunk',
        type: 'sip',
        isActive: true,
        maxChannels: 30,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/trunks',
      method: 'POST',
      data: {
        name: 'trunk-main',
        displayName: 'Main Trunk',
        type: 'sip',
        isActive: true,
        maxChannels: 30,
      },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation error'));
    const { result } = renderHook(() => useCreateTrunk(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'trunk-main' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateTrunk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleTrunk);
    const { result } = renderHook(() => useUpdateTrunk(), { wrapper });
    act(() => {
      result.current.mutate({ id: 1, displayName: 'Updated Trunk' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/trunks/1',
      method: 'PUT',
      data: { displayName: 'Updated Trunk' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Bad request'));
    const { result } = renderHook(() => useUpdateTrunk(), { wrapper });
    act(() => {
      result.current.mutate({ id: 1, displayName: 'Updated' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteTrunk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteTrunk(), { wrapper });
    act(() => {
      result.current.mutate(1);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/trunks/1',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useDeleteTrunk(), { wrapper });
    act(() => {
      result.current.mutate(1);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useActiveTrunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch active trunks when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleTrunk]);
    const { result } = renderHook(() => useActiveTrunks(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleTrunk]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/trunks/active',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));
    const { result } = renderHook(() => useActiveTrunks(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTrunkByName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch trunk by name when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleTrunk);
    const { result } = renderHook(() => useTrunkByName('trunk-main'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleTrunk);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/trunks/by-name/trunk-main',
      method: 'GET',
    });
  });

  it('should not fetch when name is empty', () => {
    const { result } = renderHook(() => useTrunkByName(''), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useTrunkByName('trunk-main'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
