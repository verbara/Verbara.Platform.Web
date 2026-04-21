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
  useAgentStateStream,
  type AgentStateChangedPayload,
} from './use-agent-state-stream';

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

function makeEvent(overrides?: Partial<AgentStateChangedPayload>): AgentStateChangedPayload {
  return {
    agentId: 'agent-1',
    previousState: 'available',
    newState: 'busy',
    reasonCode: null,
    changedAt: '2026-04-21T00:00:00Z',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

describe('useAgentStateStream', () => {
  let capturedHandler: ((payload: AgentStateChangedPayload) => void) | null = null;
  let unsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedHandler = null;
    unsubscribeMock = vi.fn();
    mockOnHubEvent.mockClear();
    mockOnHubEvent.mockImplementation(
      (_method: string, handler: (payload: AgentStateChangedPayload) => void) => {
        capturedHandler = handler;
        return unsubscribeMock;
      },
    );
    mockUseRealtimeStore.mockReturnValue('connected');
  });

  it('InvalidateAgents_ShouldBeCalled_WhenEventReceived', () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useAgentStateStream(), { wrapper });

    expect(mockOnHubEvent).toHaveBeenCalledWith('OnAgentStateChanged', expect.any(Function));

    act(() => capturedHandler?.(makeEvent()));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['agents'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['supervisor', 'conversations'] });
  });

  it('Invalidation_ShouldNotHappen_WhenEventAgentIdDoesNotMatchFilter', () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useAgentStateStream('agent-OTHER'), { wrapper });

    act(() => capturedHandler?.(makeEvent({ agentId: 'agent-1' })));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('Invalidation_ShouldHappen_WhenEventAgentIdMatchesFilter', () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useAgentStateStream('agent-1'), { wrapper });

    act(() => capturedHandler?.(makeEvent({ agentId: 'agent-1' })));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['agents'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['supervisor', 'conversations'] });
  });

  it('Unsubscribe_ShouldBeCalled_WhenConnectionBecomesDisconnected', () => {
    const { wrapper } = makeWrapper();

    mockUseRealtimeStore.mockReturnValue('connected');
    const { rerender } = renderHook(() => useAgentStateStream(), { wrapper });

    mockUseRealtimeStore.mockReturnValue('disconnected');
    rerender();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('NoSubscription_ShouldOccur_WhenConnectionIsDisconnected', () => {
    const { wrapper } = makeWrapper();
    mockUseRealtimeStore.mockReturnValue('disconnected');

    renderHook(() => useAgentStateStream(), { wrapper });

    expect(mockOnHubEvent).not.toHaveBeenCalled();
  });
});
