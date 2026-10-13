import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/core/api/api-error';
import * as client from '@/core/api/client';
import { useConversationStore } from '@/agent/stores/conversation-store';
import type { Conversation } from '@/core/api/hooks/use-conversations';
import { useCloseConversationAction } from './use-close-conversation-action';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const active: Conversation = {
  id: 'conv-1',
  contactId: 'contact-1',
  contactName: 'Ana',
  channel: 'webchat',
  queueName: 'Support',
  state: 'active',
  lastMessage: 'hola',
  lastMessageAt: '2026-10-12T10:00:00Z',
  unread: false,
  assignedAt: '2026-10-12T10:00:00Z',
};

/** Platform's `Conversation` record as `GET /conversations/{id}` returns it. */
function platformRecord(state: string) {
  return {
    conversationId: 'conv-1',
    contactId: 'contact-1',
    channel: 'WebChat',
    state,
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-12T10:05:00Z',
  };
}

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

/** The `data-error-code` of the error toast shown last. */
function toastedCode(): unknown {
  const calls = vi.mocked(toast.error).mock.calls;
  const element = calls[calls.length - 1]?.[0] as ReactElement<Record<string, unknown>> | undefined;
  return element?.props['data-error-code'];
}

beforeEach(() => {
  vi.clearAllMocks();
  useConversationStore.setState({ conversations: { [active.id]: active }, messages: {} });
});

describe('useCloseConversationAction', () => {
  it('close_ShouldPostCloseDropTheConversationAndNotify_WhenPlatformClosesAnActiveChat', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(platformRecord('Closed'));
    const onClosed = vi.fn();
    const onTypificationRequired = vi.fn();
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useCloseConversationAction('conv-1', { onClosed, onTypificationRequired }),
      { wrapper },
    );

    act(() => result.current.close());

    await waitFor(() => expect(onClosed).toHaveBeenCalledTimes(1));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/close',
      method: 'POST',
    });
    expect(useConversationStore.getState().conversations['conv-1']).toBeUndefined();
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
    expect(onTypificationRequired).not.toHaveBeenCalled();
  });

  it('close_ShouldAskForTypificationAndRefetchTheForm_WhenPlatformAnswersTypificationRequired', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(409, { error: 'typification-required' }),
    );
    const onClosed = vi.fn();
    const onTypificationRequired = vi.fn();
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(
      () => useCloseConversationAction('conv-1', { onClosed, onTypificationRequired }),
      { wrapper },
    );

    act(() => result.current.close());

    await waitFor(() => expect(onTypificationRequired).toHaveBeenCalledTimes(1));
    expect(toastedCode()).toBe('typification-required');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['typification', 'form', 'conv-1'] });
    expect(onClosed).not.toHaveBeenCalled();
    // Nothing changed server-side: the conversation stays where it was.
    expect(useConversationStore.getState().conversations['conv-1']?.state).toBe('active');
  });

  it('close_ShouldToastAndMergeTheRefetchedState_WhenPlatformAnswersNotClosable', async () => {
    vi.mocked(client.customFetch).mockImplementation(async (config) => {
      if (config.method === 'POST') throw new ApiError(409, { error: 'conversation-not-closable' });
      return platformRecord('Queued');
    });
    const onTypificationRequired = vi.fn();
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(
      () => useCloseConversationAction('conv-1', { onTypificationRequired }),
      { wrapper },
    );

    act(() => result.current.close());

    await waitFor(() =>
      expect(useConversationStore.getState().conversations['conv-1']?.state).toBe('queued'),
    );
    expect(toastedCode()).toBe('conversation-not-closable');
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1',
      method: 'GET',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['conversations', 'conv-1'] });
    // A merge keeps what SSE delivered (Platform's record has no contact name).
    expect(useConversationStore.getState().conversations['conv-1']?.contactName).toBe('Ana');
    expect(onTypificationRequired).not.toHaveBeenCalled();
  });

  it('close_ShouldDropTheConversation_WhenTheRefetchShowsItLeftTheWorkingSet', async () => {
    vi.mocked(client.customFetch).mockImplementation(async (config) => {
      if (config.method === 'POST') throw new ApiError(409, { error: 'conversation-not-closable' });
      return platformRecord('Closed');
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCloseConversationAction('conv-1'), { wrapper });

    act(() => result.current.close());

    await waitFor(() =>
      expect(useConversationStore.getState().conversations['conv-1']).toBeUndefined(),
    );
    expect(toastedCode()).toBe('conversation-not-closable');
  });

  it('close_ShouldKeepTheStore_WhenTheRefetchFails', async () => {
    vi.mocked(client.customFetch).mockImplementation(async (config) => {
      if (config.method === 'POST') throw new ApiError(409, { error: 'conversation-not-closable' });
      throw new ApiError(500, null);
    });
    const { wrapper } = setup();
    const { result } = renderHook(() => useCloseConversationAction('conv-1'), { wrapper });

    act(() => result.current.close());

    await waitFor(() => expect(client.customFetch).toHaveBeenCalledTimes(2));
    expect(toastedCode()).toBe('conversation-not-closable');
    expect(useConversationStore.getState().conversations['conv-1']?.state).toBe('active');
  });

  it('close_ShouldOnlyToast_WhenTheRefusalIsAnotherCode', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, { error: 'not-owner' }));
    const onTypificationRequired = vi.fn();
    const { wrapper, invalidate } = setup();
    const { result } = renderHook(
      () => useCloseConversationAction('conv-1', { onTypificationRequired }),
      { wrapper },
    );

    act(() => result.current.close());

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(toastedCode()).toBe('not-owner');
    expect(client.customFetch).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
    expect(onTypificationRequired).not.toHaveBeenCalled();
  });
});
