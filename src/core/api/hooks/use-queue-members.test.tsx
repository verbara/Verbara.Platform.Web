import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { customFetch } from '@/core/api/client';
import {
  useQueueMembers,
  useAddQueueMember,
  type QueueMember,
} from './use-queue-members';

const mockFetch = customFetch as ReturnType<typeof vi.fn>;

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, Wrapper };
}

const sample: QueueMember = {
  queueId: 'queue-1',
  agentId: 'agent-1',
  displayName: 'Alice Agent',
  penalty: 3,
  isExcluded: false,
  isPaused: false,
  pauseReason: null,
  source: 'Manual',
};

describe('useQueueMembers', () => {
  beforeEach(() => mockFetch.mockReset());

  it('FetchesOnMount_WhenQueueIdProvided', async () => {
    mockFetch.mockResolvedValueOnce([sample]);
    const { Wrapper } = createWrapper();

    const { result } = renderHook(() => useQueueMembers('queue-1'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sample]);
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/queues/queue-1/members',
      method: 'GET',
    });
  });

  it('InvalidatesQueueMembersCache_WhenAddMemberMutates', async () => {
    // Initial fetch returns empty; after mutation, invalidation triggers a re-fetch
    // that returns the newly-added row. If invalidation did not happen, the
    // second fetch would not be issued.
    mockFetch
      .mockResolvedValueOnce([])             // initial GET
      .mockResolvedValueOnce(sample)         // POST
      .mockResolvedValueOnce([sample]);      // re-fetch after invalidation

    const { Wrapper, qc } = createWrapper();

    const { result: listResult } = renderHook(
      () => useQueueMembers('queue-1'),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toEqual([]);

    const { result: addResult } = renderHook(() => useAddQueueMember(), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await addResult.current.mutateAsync({
        queueId: 'queue-1',
        agentId: 'agent-1',
        penalty: 3,
      });
    });

    // Ensure the mutation issued the POST call
    expect(mockFetch).toHaveBeenCalledWith({
      url: '/api/v1/queues/queue-1/members',
      method: 'POST',
      data: { agentId: 'agent-1', penalty: 3 },
    });

    // Confirm the query key was invalidated → total calls should now be 3
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3));

    // Sanity: the cache key is the expected tuple
    const cachedKeys = qc.getQueryCache().getAll().map((q) => q.queryKey);
    expect(cachedKeys).toContainEqual(['queue-members', 'queue-1']);
  });
});
