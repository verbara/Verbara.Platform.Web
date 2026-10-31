import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import { availableChannels, noAvailableChannels } from '@/tests/utils/contract-doubles';
import { useAvailableChannels } from './use-available-channels';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

describe('useAvailableChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ShouldReturnTheArray_WhenTheReadAnswers', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(availableChannels);
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useAvailableChannels(true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(availableChannels);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/channels/available',
      method: 'GET',
    });
    expect(qc.getQueryData(['available-channels'])).toEqual(availableChannels);
  });

  it('ShouldReturnAnEmptyArray_WhenTheTenantHasNoChannel', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(noAvailableChannels);
    const { wrapper } = setup();
    const { result } = renderHook(() => useAvailableChannels(true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('ShouldNotRead_WhenDisabled', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useAvailableChannels(false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });
});
