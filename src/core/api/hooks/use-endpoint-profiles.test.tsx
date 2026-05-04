import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useEndpointProfiles,
  useEndpointProfile,
  useCreateEndpointProfile,
  useUpdateEndpointProfile,
  useDeleteEndpointProfile,
  useSeedDefaults,
} from './use-endpoint-profiles';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleProfile = {
  id: 1,
  name: 'webrtc-default',
  type: 'webrtc',
  isDefault: true,
  transport: 'wss',
  codecs: 'opus,vp8',
  webrtc: true,
  maxContacts: 1,
  directMedia: false,
  context: 'default',
  qualifyFrequency: 60,
};

describe('useEndpointProfiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch endpoint profiles when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleProfile]);
    const { result } = renderHook(() => useEndpointProfiles(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleProfile]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/realtime/profiles',
      method: 'GET',
    });
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useEndpointProfiles(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useEndpointProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch endpoint profile by id when called', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleProfile);
    const { result } = renderHook(() => useEndpointProfile(1), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleProfile);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/realtime/profiles/1',
      method: 'GET',
    });
  });

  it('should not fetch when id is 0', () => {
    const { result } = renderHook(() => useEndpointProfile(0), { wrapper });
    expect(result.current.isFetching).toBe(false);
  });

  it('should handle error when fetch fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useEndpointProfile(1), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateEndpointProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleProfile);
    const { result } = renderHook(() => useCreateEndpointProfile(), { wrapper });
    act(() => {
      result.current.mutate({
        name: 'webrtc-default',
        type: 'webrtc',
        transport: 'wss',
        codecs: 'opus,vp8',
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/realtime/profiles',
      method: 'POST',
      data: { name: 'webrtc-default', type: 'webrtc', transport: 'wss', codecs: 'opus,vp8' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Conflict'));
    const { result } = renderHook(() => useCreateEndpointProfile(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'webrtc-default', type: 'webrtc' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateEndpointProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleProfile);
    const { result } = renderHook(() => useUpdateEndpointProfile(), { wrapper });
    act(() => {
      result.current.mutate({ id: 1, name: 'updated-profile', codecs: 'opus' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/realtime/profiles/1',
      method: 'PUT',
      data: { name: 'updated-profile', codecs: 'opus' },
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Bad request'));
    const { result } = renderHook(() => useUpdateEndpointProfile(), { wrapper });
    act(() => {
      result.current.mutate({ id: 1, name: 'x' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteEndpointProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteEndpointProfile(), { wrapper });
    act(() => {
      result.current.mutate(1);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/realtime/profiles/1',
      method: 'DELETE',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Forbidden'));
    const { result } = renderHook(() => useDeleteEndpointProfile(), { wrapper });
    act(() => {
      result.current.mutate(1);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSeedDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call correct endpoint when mutating', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSeedDefaults(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/realtime/profiles/seed-defaults',
      method: 'POST',
    });
  });

  it('should handle error when mutation fails', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));
    const { result } = renderHook(() => useSeedDefaults(), { wrapper });
    act(() => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
