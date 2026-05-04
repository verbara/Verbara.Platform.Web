import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

import { useDialerSettings, useUpdateDialerSettings } from './use-dialer-settings';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDialerSettings', () => {
  it('should fetch dialer settings', async () => {
    const mockData = {
      maxGlobalChannels: 100,
      defaultRingTimeoutSeconds: 30,
      campaignPollIntervalSeconds: 5,
      maxConcurrentCampaigns: 10,
      blendModeEnabled: true,
      jitterMinMs: 100,
      jitterMaxMs: 500,
      ahtCacheDurationSeconds: 300,
      scheduledCallbackPollSeconds: 60,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDialerSettings(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/dialer/settings',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useDialerSettings(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Server error');
  });
});

describe('useUpdateDialerSettings', () => {
  it('should update dialer settings', async () => {
    const updated = {
      maxGlobalChannels: 200,
      defaultRingTimeoutSeconds: 45,
      campaignPollIntervalSeconds: 10,
      maxConcurrentCampaigns: 20,
      blendModeEnabled: false,
      jitterMinMs: 200,
      jitterMaxMs: 1000,
      ahtCacheDurationSeconds: 600,
      scheduledCallbackPollSeconds: 120,
    };
    vi.mocked(client.customFetch).mockResolvedValue(updated);

    const { result } = renderHook(() => useUpdateDialerSettings(), { wrapper });

    act(() => {
      result.current.mutate({ maxGlobalChannels: 200, blendModeEnabled: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/dialer/settings',
      method: 'PUT',
      data: { maxGlobalChannels: 200, blendModeEnabled: false },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('update failed'));

    const { result } = renderHook(() => useUpdateDialerSettings(), { wrapper });

    act(() => {
      result.current.mutate({ maxGlobalChannels: 999 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('update failed');
  });
});
