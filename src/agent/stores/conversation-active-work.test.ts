import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  conversationActiveWorkSource,
  initConversationSSE,
  useConversationStore,
  type Conversation,
} from './conversation-store';
import { useAuthStore } from '@/core/auth/auth-store';
import { warningAtMs } from '@/core/session/idle-config';
import { isAnyWorkActive } from '@/core/session/active-work-registry';
import { useSessionManager, type SessionManagerOptions } from '@/core/session/use-session-manager';

const IDLE_MINUTES = 2;
const WARNING_AT = warningAtMs(IDLE_MINUTES);

function makeConversation(state: Conversation['state']): Conversation {
  return {
    id: 'c1',
    contactId: '',
    contactName: 'Caller',
    channel: 'chat',
    queueName: 'support',
    state,
    lastMessage: '',
    lastMessageAt: '2026-10-31T10:00:00Z',
    unread: false,
    assignedAt: '2026-10-31T09:55:00Z',
  };
}

function setConversationState(state: Conversation['state']) {
  useConversationStore.setState({ conversations: { c1: makeConversation(state) } });
}

describe('conversationActiveWorkSource', () => {
  beforeEach(() => {
    useConversationStore.setState({ conversations: {} });
  });

  it('isActive_ShouldBeFalse_WhenThereIsNoConversation', () => {
    expect(conversationActiveWorkSource.isActive()).toBe(false);
  });

  it.each(['active', 'on_hold', 'consulting'] as const)(
    'isActive_ShouldBeTrue_WhenAConversationIs_%s',
    (state) => {
      setConversationState(state);
      expect(conversationActiveWorkSource.isActive()).toBe(true);
    },
  );

  it.each(['offered', 'queued', 'waiting_for_customer', 'snoozed', 'wrap_up'] as const)(
    'isActive_ShouldBeFalse_WhenTheOnlyConversationIs_%s',
    (state) => {
      setConversationState(state);
      expect(conversationActiveWorkSource.isActive()).toBe(false);
    },
  );

  it('subscribe_ShouldFireOnceOnTheTransition_WhenStateStaysActive', () => {
    const onBecameActive = vi.fn();
    const unsubscribe = conversationActiveWorkSource.subscribe(onBecameActive);

    setConversationState('offered');
    expect(onBecameActive).not.toHaveBeenCalled();
    setConversationState('active');
    setConversationState('on_hold');
    expect(onBecameActive).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('subscribe_ShouldStopFiring_WhenUnsubscribed', () => {
    const onBecameActive = vi.fn();
    const unsubscribe = conversationActiveWorkSource.subscribe(onBecameActive);

    unsubscribe();
    setConversationState('active');

    expect(onBecameActive).not.toHaveBeenCalled();
  });
});

describe('initConversationSSE, the agent console loading after the session manager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useConversationStore.setState({ conversations: {} });
    useAuthStore.setState({ accessToken: null, tokenExpiry: null });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  // One test on purpose: the module guard means only this file's first initConversationSSE() registers.
  it('SessionManager_ShouldRestartTheIdleCountdown_WhenAConversationBecomesActiveAfterLateInit', () => {
    const opts: SessionManagerOptions = {
      onLogout: vi.fn(),
      onRemoteLogout: vi.fn(),
      onRefresh: vi.fn(),
      idleMinutesOverride: IDLE_MINUTES,
    };
    const { result } = renderHook(() => useSessionManager(opts));
    act(() => {
      vi.advanceTimersByTime(WARNING_AT - 1_000);
    });

    expect(isAnyWorkActive()).toBe(false);
    initConversationSSE();
    expect(isAnyWorkActive()).toBe(false);

    act(() => {
      setConversationState('active');
    });
    expect(isAnyWorkActive()).toBe(true);

    // The work ends, so only the restarted clock can keep the warning away past the old deadline.
    act(() => {
      useConversationStore.setState({ conversations: {} });
      vi.advanceTimersByTime(1_500);
    });
    expect(result.current.warningOpen).toBe(false);

    act(() => {
      vi.advanceTimersByTime(WARNING_AT);
    });
    expect(result.current.warningOpen).toBe(true);
  });
});
