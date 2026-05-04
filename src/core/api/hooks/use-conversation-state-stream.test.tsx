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

import { asMock } from '@/tests/utils/as-mock';
import { onHubEvent } from '@/core/realtime';
import { useRealtimeStore } from '@/core/stores/realtime-store';
import {
  useConversationStateStream,
  type ConversationStateChangedPayload,
} from './use-conversation-state-stream';

const mockOnHubEvent = onHubEvent as ReturnType<typeof vi.fn>;
const mockUseRealtimeStore = asMock(useRealtimeStore);

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    qc,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

function makeEvent(
  overrides?: Partial<ConversationStateChangedPayload>,
): ConversationStateChangedPayload {
  return {
    conversationId: 'conv-1',
    previousState: 'active',
    newState: 'ended',
    changedAt: '2026-04-21T00:00:00Z',
    tenantId: 'tenant-1',
    ...overrides,
  };
}

describe('useConversationStateStream', () => {
  let capturedHandler: ((payload: ConversationStateChangedPayload) => void) | null = null;
  let unsubscribeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedHandler = null;
    unsubscribeMock = vi.fn();
    mockOnHubEvent.mockClear();
    mockOnHubEvent.mockImplementation(
      (_method: string, handler: (payload: ConversationStateChangedPayload) => void) => {
        capturedHandler = handler;
        return unsubscribeMock;
      },
    );
    mockUseRealtimeStore.mockReturnValue('connected');
  });

  it('InvalidateConversations_ShouldBeCalled_WhenEventReceived', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useConversationStateStream(), { wrapper });

    expect(mockOnHubEvent).toHaveBeenCalledWith('OnConversationStateChanged', expect.any(Function));

    act(() => capturedHandler?.(makeEvent()));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations', 'conv-1'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['messages', 'conv-1'] });
  });

  it('InvalidateMessages_ShouldNotBeCalled_WhenNewStateIsNotEnded', async () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useConversationStateStream(), { wrapper });

    act(() => capturedHandler?.(makeEvent({ newState: 'started' })));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations', 'conv-1'] });
    expect(invalidateSpy).not.toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['messages', 'conv-1'] }),
    );
  });

  it('Invalidation_ShouldNotHappen_WhenEventIdDoesNotMatchFilter', () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useConversationStateStream('conv-OTHER'), { wrapper });

    act(() => capturedHandler?.(makeEvent({ conversationId: 'conv-1' })));

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('Invalidation_ShouldHappen_WhenEventIdMatchesFilter', () => {
    const { qc, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useConversationStateStream('conv-1'), { wrapper });

    act(() => capturedHandler?.(makeEvent({ conversationId: 'conv-1' })));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['conversations', 'conv-1'] });
  });

  it('Unsubscribe_ShouldBeCalled_WhenConnectionBecomesDisconnected', () => {
    const { wrapper } = makeWrapper();

    // Start connected
    mockUseRealtimeStore.mockReturnValue('connected');
    const { rerender } = renderHook(() => useConversationStateStream(), { wrapper });

    // Transition to disconnected — effect cleanup fires
    mockUseRealtimeStore.mockReturnValue('disconnected');
    rerender();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('NoSubscription_ShouldOccur_WhenConnectionIsDisconnected', () => {
    const { wrapper } = makeWrapper();
    mockUseRealtimeStore.mockReturnValue('disconnected');

    renderHook(() => useConversationStateStream(), { wrapper });

    expect(mockOnHubEvent).not.toHaveBeenCalled();
  });
});
