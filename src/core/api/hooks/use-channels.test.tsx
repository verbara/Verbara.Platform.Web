import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { ChannelConfig } from './use-channels';
import { useChannel, useUpdateChannel } from './use-channels';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockChannel: ChannelConfig = {
  channel: 'whatsapp',
  isActive: true,
  credentials: { apiKey: 'sk-123', phoneNumberId: '12345' },
};

describe('useChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch channel config by channelId', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockChannel);

    const { result } = renderHook(() => useChannel('whatsapp'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockChannel);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/channels/whatsapp',
      method: 'GET',
    });
  });

  it('should not fetch when channelId is undefined', () => {
    const { result } = renderHook(() => useChannel(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(() => useChannel('bad-channel'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('useUpdateChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call PUT /api/v1/admin/channels/{channelId}', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockChannel);

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });

    const data = { channelId: 'whatsapp', isActive: true, credentials: { apiKey: 'sk-new' } };
    act(() => {
      result.current.mutate(data);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/channels/whatsapp',
      method: 'PUT',
      data: { isActive: true, credentials: { apiKey: 'sk-new' } },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Validation failed'));

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });

    act(() => {
      result.current.mutate({ channelId: 'whatsapp', isActive: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Validation failed');
  });
});
