import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// --- mocks ---

vi.mock('@/core/realtime', () => ({
  onHubEvent: vi.fn(),
}));

vi.mock('@/core/stores/realtime-store', () => ({
  useRealtimeStore: vi.fn(),
}));

import { onHubEvent } from '@/core/realtime';
import { useRealtimeStore } from '@/core/stores/realtime-store';
import {
  useClusterStateStream,
  type ClusterNodeStatePayload,
} from './use-cluster-state-stream';

const mockOnHubEvent = onHubEvent as ReturnType<typeof vi.fn>;
const mockUseRealtimeStore = useRealtimeStore as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

function makeEvent(overrides?: Partial<ClusterNodeStatePayload>): ClusterNodeStatePayload {
  return {
    nodeId: 'node-1',
    previousState: 'Healthy',
    newState: 'Draining',
    changedAt: '2026-04-21T18:30:00Z',
    ...overrides,
  };
}

describe('useClusterStateStream', () => {
  let capturedHandler: ((payload: ClusterNodeStatePayload) => void) | null = null;
  let unsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedHandler = null;
    unsubscribeMock = vi.fn();
    mockOnHubEvent.mockClear();
    mockOnHubEvent.mockImplementation(
      (_method: string, handler: (payload: ClusterNodeStatePayload) => void) => {
        capturedHandler = handler;
        return unsubscribeMock;
      },
    );
    mockUseRealtimeStore.mockReturnValue('connected');
  });

  it('Subscribe_ShouldRegisterHandler_WhenConnected', () => {
    const { wrapper } = makeWrapper();

    renderHook(() => useClusterStateStream(), { wrapper });

    expect(mockOnHubEvent).toHaveBeenCalledWith('OnClusterNodeStateChanged', expect.any(Function));
  });

  it('InvalidateCluster_ShouldBeCalled_WhenEventReceived', () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useClusterStateStream(), { wrapper });

    act(() => capturedHandler?.(makeEvent()));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cluster'] });
  });

  it('Invalidation_ShouldNotHappen_WhenEventNodeIdDoesNotMatchFilter', () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useClusterStateStream('node-1'), { wrapper });

    act(() => capturedHandler?.(makeEvent({ nodeId: 'node-2' })));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('Invalidation_ShouldHappen_WhenEventNodeIdMatchesFilter', () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useClusterStateStream('node-1'), { wrapper });

    act(() => capturedHandler?.(makeEvent({ nodeId: 'node-1' })));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cluster'] });
  });

  it('NoSubscription_ShouldOccur_WhenConnectionIsDisconnected', () => {
    const { wrapper } = makeWrapper();
    mockUseRealtimeStore.mockReturnValue('disconnected');

    renderHook(() => useClusterStateStream(), { wrapper });

    expect(mockOnHubEvent).not.toHaveBeenCalled();
  });

  it('Unsubscribe_ShouldBeCalled_WhenHookUnmounts', () => {
    const { wrapper } = makeWrapper();

    const { unmount } = renderHook(() => useClusterStateStream(), { wrapper });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });
});
