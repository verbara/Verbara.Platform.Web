import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/core/api/client', () => ({
  customFetchWithHeaders: vi.fn(),
}));

import { customFetchWithHeaders } from '@/core/api/client';
import { useQueueMetrics } from './use-queue-metrics';
import type { QueueMetrics } from '@/operations/stores/queue-metrics-store';

const mockFetch = customFetchWithHeaders as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}

const sample: QueueMetrics = {
  queueId: 'queue-1',
  queueName: 'support',
  waiting: 3,
  avgWaitSeconds: 12,
  slaPercent: 88,
  agentsAvailable: 2,
  agentsBusy: 1,
  agentsAway: 0,
};

describe('useQueueMetrics', () => {
  beforeEach(() => mockFetch.mockReset());

  it('IsMetricsAvailable_ShouldBeFalse_When_HeaderIsFalse', async () => {
    const headers = new Headers({ 'X-Metrics-Available': 'false' });
    mockFetch.mockResolvedValueOnce({ data: [sample], headers });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQueueMetrics(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isMetricsAvailable).toBe(false);
    expect(result.current.data?.metrics).toEqual([sample]);
  });

  it('IsMetricsAvailable_ShouldBeTrue_When_HeaderIsAbsent', async () => {
    const headers = new Headers();
    mockFetch.mockResolvedValueOnce({ data: [sample], headers });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQueueMetrics(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isMetricsAvailable).toBe(true);
  });

  it('IsMetricsAvailable_ShouldBeTrue_When_HeaderIsTrue', async () => {
    const headers = new Headers({ 'X-Metrics-Available': 'true' });
    mockFetch.mockResolvedValueOnce({ data: [sample], headers });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQueueMetrics(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isMetricsAvailable).toBe(true);
  });

  it('IsMetricsAvailable_ShouldBeCaseInsensitive_When_HeaderIsFalseUppercase', async () => {
    const headers = new Headers({ 'X-Metrics-Available': 'FALSE' });
    mockFetch.mockResolvedValueOnce({ data: [sample], headers });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQueueMetrics(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.isMetricsAvailable).toBe(false);
  });

  it('FetchesQueueMetricsEndpoint_OnMount', async () => {
    const headers = new Headers();
    mockFetch.mockResolvedValueOnce({ data: [sample], headers });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQueueMetrics(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/operations/queue-metrics',
      method: 'GET',
    });
  });

  it('CoercesNullWaitingFields_ToNull_When_ProviderUnavailable', async () => {
    // waiting/avgWaitSeconds arrive null when the Pro.Analytics.Live provider is
    // unavailable; toQueueMetrics must preserve null (not coerce to Number(null)=0).
    const headers = new Headers();
    const nullRow = { ...sample, waiting: null, avgWaitSeconds: null };
    mockFetch.mockResolvedValueOnce({ data: [nullRow], headers });
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQueueMetrics(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.metrics[0]?.waiting).toBeNull();
    expect(result.current.data?.metrics[0]?.avgWaitSeconds).toBeNull();
    expect(result.current.data?.metrics[0]?.slaPercent).toBe(sample.slaPercent);
  });
});
