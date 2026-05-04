import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useConversations,
  useConversation,
  useMessages,
  useSendMessage,
  useAcceptConversation,
  useRejectConversation,
  useTransferConversation,
  useCloseConversation,
  useWrapUp,
  useHoldConversation,
  useUnholdConversation,
  useCreateConversation,
} from './use-conversations';
import type { Conversation, Message } from './use-conversations';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleConversation: Conversation = {
  id: 'conv-1',
  contactId: 'contact-1',
  contactName: 'John Doe',
  channel: 'chat',
  queueName: 'Support',
  state: 'active',
  lastMessage: 'Hello',
  lastMessageAt: '2026-01-01T00:00:00Z',
  unread: false,
  assignedAt: '2026-01-01T00:00:00Z',
};

const sampleMessage: Message = {
  id: 'msg-1',
  conversationId: 'conv-1',
  sender: 'customer',
  senderName: 'John Doe',
  text: 'Hello',
  timestamp: '2026-01-01T00:00:00Z',
  status: 'delivered',
  type: 'text',
};

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch conversations with default params', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({
      items: [sampleConversation],
      totalCount: 1,
      page: 1,
      pageSize: 50,
    });
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleConversation]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations',
      method: 'GET',
      params: { page: '1', pageSize: '50' },
    });
  });

  it('should pass filter params', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 50,
    });
    const { result } = renderHook(
      () =>
        useConversations({
          state: 'active',
          queueId: 'q-1',
          agentId: 'a-1',
          page: 2,
          pageSize: 25,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations',
      method: 'GET',
      params: { page: '2', pageSize: '25', state: 'active', queueId: 'q-1', agentId: 'a-1' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single conversation by id', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleConversation);
    const { result } = renderHook(() => useConversation('conv-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(sampleConversation);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1',
      method: 'GET',
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useConversation(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Not found'));
    const { result } = renderHook(() => useConversation('conv-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Not found');
  });
});

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch messages for a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleMessage]);
    const { result } = renderHook(() => useMessages('conv-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleMessage]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/messages',
      method: 'GET',
      params: { limit: '50', offset: '0' },
    });
  });

  it('should not fetch when conversationId is undefined', () => {
    const { result } = renderHook(() => useMessages(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useMessages('conv-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSendMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a message', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleMessage);
    const { result } = renderHook(() => useSendMessage(), { wrapper });
    act(() => {
      result.current.mutate({ conversationId: 'conv-1', text: 'Hello' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/messages',
      method: 'POST',
      data: { text: 'Hello' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Send failed'));
    const { result } = renderHook(() => useSendMessage(), { wrapper });
    act(() => {
      result.current.mutate({ conversationId: 'conv-1', text: 'Hello' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAcceptConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAcceptConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/accept',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useAcceptConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRejectConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRejectConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/reject',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useRejectConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTransferConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should transfer a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useTransferConversation(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'conv-1', targetQueueId: 'q-2', targetAgentId: 'a-2' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/transfer',
      method: 'POST',
      data: { targetQueueId: 'q-2', targetAgentId: 'a-2' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useTransferConversation(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'conv-1', targetQueueId: 'q-2' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCloseConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should close a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCloseConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/close',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useCloseConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useWrapUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should wrap up a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useWrapUp(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'conv-1', dispositionId: 'disp-1', notes: 'Done' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/wrapup',
      method: 'POST',
      data: { dispositionId: 'disp-1', notes: 'Done' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useWrapUp(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'conv-1' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useHoldConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should hold a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useHoldConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/hold',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useHoldConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUnholdConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should unhold a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useUnholdConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/unhold',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useUnholdConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(sampleConversation);
    const { result } = renderHook(() => useCreateConversation(), { wrapper });
    act(() => {
      result.current.mutate({ contactId: 'contact-1', channel: 'chat', initialMessage: 'Hi' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations',
      method: 'POST',
      data: { contactId: 'contact-1', channel: 'chat', initialMessage: 'Hi' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Failed'));
    const { result } = renderHook(() => useCreateConversation(), { wrapper });
    act(() => {
      result.current.mutate({ contactId: 'contact-1', channel: 'chat' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
