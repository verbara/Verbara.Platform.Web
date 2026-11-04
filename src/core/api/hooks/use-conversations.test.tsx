import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useConversations,
  useConversation,
  useMessageHistory,
  useMessages,
  useSendMessage,
  useAcceptConversation,
  useRejectConversation,
  useTransferConversation,
  useCloseConversation,
  useHoldConversation,
  useUnholdConversation,
  useCreateConversation,
} from './use-conversations';
import type { Conversation, Message } from './use-conversations';
import * as client from '@/core/api/client';
import { ApiError } from '@/core/api/api-error';
import {
  historyEmptyPage,
  historyFirstPage,
  historyOlderPage,
  historySecondMessage,
  invalidCursorRefusal,
  notReadableRefusal,
  terminalConversation,
} from '@/tests/utils/contract-doubles';

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

/** `sampleMessage` as Platform serializes its `Message` record (Conversations/Message.cs). */
const platformSampleMessage = {
  messageId: 'msg-1',
  conversationId: 'conv-1',
  tenantId: 'tenant-1',
  direction: 'Inbound',
  channel: 'WebChat',
  senderId: 'John Doe',
  content: { blocks: [{ $type: 'text', text: 'Hello', type: 'Text' }] },
  deliveryStatus: 'Delivered',
  externalMessageId: null,
  createdAt: '2026-01-01T00:00:00Z',
  deliveredAt: null,
  readAt: null,
  updatedAt: null,
  createdBy: null,
  updatedBy: null,
};

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch conversations with default params', async () => {
    // Platform's `Conversation` record; a closed one has left the agent's working set.
    const wire = {
      conversationId: 'conv-1',
      tenantId: 'tenant-1',
      contactId: 'contact-1',
      channel: 'WhatsApp',
      owner: { kind: 'Agent', ownerId: 'agent-1' },
      state: 'OnHold',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:05:00Z',
    };
    vi.mocked(client.customFetch).mockResolvedValue({
      items: [wire, { ...wire, conversationId: 'conv-2', state: 'Closed' }],
      totalCount: 2,
      page: 1,
      pageSize: 50,
    });
    const { result } = renderHook(() => useConversations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      {
        id: 'conv-1',
        contactId: 'contact-1',
        contactName: '',
        channel: 'whatsapp',
        queueName: '',
        state: 'on_hold',
        lastMessage: '',
        lastMessageAt: '2026-01-01T00:05:00Z',
        unread: false,
        assignedAt: '2026-01-01T00:00:00Z',
      },
    ]);
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

  it('useConversation_ShouldMapTheRecord_WhenTheConversationIsTerminal', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(terminalConversation);
    const { result } = renderHook(() => useConversation('4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      id: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
      contactId: '7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d',
      channel: 'WhatsApp',
      state: 'closed',
      createdAt: '2026-10-28T09:15:00.000+00:00',
      closedAt: '2026-10-31T10:20:05.000+00:00',
      closedReason: 'inactivity',
    });
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
      method: 'GET',
    });
  });

  it('useConversation_ShouldNotFetch_WhenIdIsUndefined', () => {
    const { result } = renderHook(() => useConversation(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('useConversation_ShouldExposeTheRefusal_WhenPlatformAnswersNotReadable', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, notReadableRefusal));
    const { result } = renderHook(() => useConversation('conv-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403, code: 'not-readable' });
  });
});

describe('useMessageHistory', () => {
  const ID = '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a';
  const URL = `/api/v1/conversations/${ID}/history`;

  /** Serves the fixture's two pages by the cursor the hook sends. */
  function serveFixturePages() {
    vi.mocked(client.customFetch).mockImplementation(async (config) =>
      config.params?.before === 'opaque-cursor-value-1' ? historyOlderPage : historyFirstPage,
    );
  }

  function clientWrapper() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const Wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return { qc, Wrapper };
  }

  const shownIds = (messages: Message[]) => messages.map((m) => m.id);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('useMessageHistory_ShouldSendNoBeforeAndShowOldestOnTop_WhenTheFirstPageLoads', async () => {
    serveFixturePages();
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(client.customFetch).toHaveBeenCalledTimes(1);
    expect(client.customFetch).toHaveBeenCalledWith({ url: URL, method: 'GET' });
    expect(shownIds(result.current.messages)).toEqual([
      'm-0002-a1b2c3d4e5f6a7b8',
      'm-0003-b1c2d3e4f5a6b7c8',
    ]);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('useMessageHistory_ShouldSendNextBeforeVerbatimAndStop_WhenHasMoreIsFalse', async () => {
    serveFixturePages();
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(client.customFetch).toHaveBeenLastCalledWith({
      url: URL,
      method: 'GET',
      params: { before: 'opaque-cursor-value-1' },
    });
    expect(shownIds(result.current.messages)).toEqual([
      'm-0001-f0e1d2c3b4a59687',
      'm-0002-a1b2c3d4e5f6a7b8',
      'm-0003-b1c2d3e4f5a6b7c8',
    ]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useMessageHistory_ShouldUseTheHistoryKeyUnderMessages_WhenItLoads', async () => {
    serveFixturePages();
    const { qc, Wrapper } = clientWrapper();
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(qc.getQueryData(['messages', ID, 'history'])).toBeDefined();
  });

  it('useMessageHistory_ShouldRepeatNothing_WhenInvalidatedAfterLoadingEarlier', async () => {
    serveFixturePages();
    const { qc, Wrapper } = clientWrapper();
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    vi.mocked(client.customFetch).mockClear();

    await act(() => qc.invalidateQueries({ queryKey: ['messages', ID] }));

    // Every loaded page is read again (design: Evidence classes) and no message shows twice.
    expect(client.customFetch).toHaveBeenCalledTimes(2);
    expect(shownIds(result.current.messages)).toEqual([
      'm-0001-f0e1d2c3b4a59687',
      'm-0002-a1b2c3d4e5f6a7b8',
      'm-0003-b1c2d3e4f5a6b7c8',
    ]);
  });

  it('useMessageHistory_ShouldShowAMessageOnce_WhenTwoPagesServeTheSameId', async () => {
    vi.mocked(client.customFetch).mockImplementation(async (config) =>
      config.params?.before ? { items: [historySecondMessage], hasMore: false } : historyFirstPage,
    );
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(shownIds(result.current.messages)).toEqual([
      'm-0002-a1b2c3d4e5f6a7b8',
      'm-0003-b1c2d3e4f5a6b7c8',
    ]);
  });

  it('useMessageHistory_ShouldKeepMessagesAndNameTheCursor_WhenANextPageIsInvalidCursor', async () => {
    vi.mocked(client.customFetch).mockImplementation(async (config) => {
      if (config.params?.before) throw new ApiError(400, invalidCursorRefusal);
      return historyFirstPage;
    });
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.nextPageError).not.toBeNull());
    expect(result.current.nextPageError).toMatchObject({ status: 400, code: 'invalid-cursor' });
    expect(result.current.readError).toBeNull();
    expect(result.current.messages).toHaveLength(2);
  });

  it('useMessageHistory_ShouldReportAReadError_WhenTheFirstPageIsRefused', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, notReadableRefusal));
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper });
    await waitFor(() => expect(result.current.readError).not.toBeNull());
    expect(result.current.readError).toMatchObject({ status: 403, code: 'not-readable' });
    expect(result.current.nextPageError).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it('useMessageHistory_ShouldReportAReadError_WhenARefetchIsRefusedAfterLoading', async () => {
    serveFixturePages();
    const { qc, Wrapper } = clientWrapper();
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, notReadableRefusal));

    await act(() => qc.invalidateQueries({ queryKey: ['messages', ID] }));

    await waitFor(() => expect(result.current.readError).not.toBeNull());
    expect(result.current.nextPageError).toBeNull();
  });

  it('useMessageHistory_ShouldShowNoMessagesAndNoNextPage_WhenTheConversationIsEmpty', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(historyEmptyPage);
    const { result } = renderHook(() => useMessageHistory(ID), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.messages).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('useMessageHistory_ShouldNotFetch_WhenTheIdIsUndefined', () => {
    const { result } = renderHook(() => useMessageHistory(undefined), { wrapper });
    expect(result.current.messages).toEqual([]);
    expect(client.customFetch).not.toHaveBeenCalled();
  });
});

describe('useMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useMessages_ShouldMapPlatformMessageRecord_WhenApiReturnsHistory', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([platformSampleMessage]);
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
