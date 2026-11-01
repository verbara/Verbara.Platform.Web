import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import { transferTargetAgentsPage, transferTargetQueuesPage } from '@/tests/utils/contract-doubles';
import { useTransferTargetAgents, useTransferTargetQueues } from './use-transfer-targets';

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

describe.each([
  {
    name: 'useTransferTargetQueues',
    useHook: useTransferTargetQueues,
    url: '/api/v1/transfer-targets/queues',
    key: 'queues',
    body: transferTargetQueuesPage,
  },
  {
    name: 'useTransferTargetAgents',
    useHook: useTransferTargetAgents,
    url: '/api/v1/transfer-targets/agents',
    key: 'agents',
    body: transferTargetAgentsPage,
  },
])('$name', ({ useHook, url, key, body }) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(client.customFetch).mockResolvedValue(body);
  });

  it('ShouldReturnTheItems_WhenTheReadAnswers', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useHook('', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(body.items);
  });

  it('ShouldLeaveSearchOut_WhenTheTermIsEmpty', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useHook('', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url,
      method: 'GET',
      params: { page: '1', pageSize: '100' },
    });
  });

  it('ShouldLeaveSearchOut_WhenTheTermIsOnlySpaces', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useHook('   ', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url,
      method: 'GET',
      params: { page: '1', pageSize: '100' },
    });
  });

  it('ShouldSendTheTermAsSearch_WhenThereIsOne', async () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useHook('bill', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url,
      method: 'GET',
      params: { search: 'bill', page: '1', pageSize: '100' },
    });
  });

  it('ShouldNotRead_WhenDisabled', () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useHook('bill', false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('ShouldKeepItsOwnCacheEntry_AndLeaveTheAdminKeysAlone', async () => {
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useHook('bill', true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData(['transfer-targets', key, 'bill'])).toEqual(body.items);
    expect(qc.getQueryCache().find({ queryKey: ['queues'] })).toBeUndefined();
    expect(qc.getQueryCache().find({ queryKey: ['agents'] })).toBeUndefined();
  });
});
