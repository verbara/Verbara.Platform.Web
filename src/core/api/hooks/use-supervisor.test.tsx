import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useActiveSessions,
  useSendWhisper,
  useStartListening,
  useSupervisorConversations,
  useSupervisorMessages,
  useTakeoverConversation,
  useCloseDigitalConversation,
  useSendCoachingNote,
  useRetryCallback,
} from './use-supervisor';
import type { ActiveSession, SupervisorConversation, SupervisorMessage } from './use-supervisor';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleSession: ActiveSession = {
  sessionId: 'sess-1',
  agentId: 'agent-1',
  agentName: 'Agent One',
  queueName: 'Support',
  callerIdNum: '+1234567890',
  connectedAt: '2026-01-01T00:00:00Z',
  sentiment: 'positive',
};

const sampleConversation: SupervisorConversation = {
  id: 'conv-1',
  contactId: 'contact-1',
  contactName: 'Jane Doe',
  channel: 'chat',
  queueName: 'Support',
  state: 'active',
  assignedAgentId: 'agent-1',
  lastMessage: 'Hello',
  lastMessageAt: '2026-01-01T00:00:00Z',
  assignedAt: '2026-01-01T00:00:00Z',
};

const sampleMessage: SupervisorMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  sender: 'customer',
  senderName: 'Jane Doe',
  text: 'Help me',
  timestamp: '2026-01-01T00:00:00Z',
  type: 'text',
};

describe('useActiveSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch active sessions', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleSession]);
    const { result } = renderHook(() => useActiveSessions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleSession]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/sessions/active',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useActiveSessions(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Fetch failed');
  });
});

describe('useSendWhisper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a whisper message', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSendWhisper(), { wrapper });
    act(() => {
      result.current.mutate({ sessionId: 'sess-1', message: 'Check pricing' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/sessions/sess-1/whisper',
      method: 'POST',
      data: { message: 'Check pricing' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Whisper failed'));
    const { result } = renderHook(() => useSendWhisper(), { wrapper });
    act(() => {
      result.current.mutate({ sessionId: 'sess-1', message: 'Check pricing' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useStartListening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start listening to a session', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useStartListening(), { wrapper });
    act(() => {
      result.current.mutate('sess-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/sessions/sess-1/listen',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Listen failed'));
    const { result } = renderHook(() => useStartListening(), { wrapper });
    act(() => {
      result.current.mutate('sess-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSupervisorConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch supervisor conversations with default params', async () => {
    const pagedResult = { items: [sampleConversation], totalCount: 1, page: 1, pageSize: 25 };
    vi.mocked(client.customFetch).mockResolvedValue(pagedResult);
    const { result } = renderHook(() => useSupervisorConversations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(pagedResult);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/conversations',
      method: 'GET',
      params: { page: '1', pageSize: '25' },
    });
  });

  it('should pass filter params', async () => {
    const pagedResult = { items: [], totalCount: 0, page: 1, pageSize: 25 };
    vi.mocked(client.customFetch).mockResolvedValue(pagedResult);
    const { result } = renderHook(
      () =>
        useSupervisorConversations({
          queue: 'Support',
          agent: 'agent-1',
          channel: 'chat',
          state: 'active',
          page: 2,
          pageSize: 10,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/conversations',
      method: 'GET',
      params: {
        page: '2',
        pageSize: '10',
        queue: 'Support',
        agent: 'agent-1',
        channel: 'chat',
        state: 'active',
      },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useSupervisorConversations(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSupervisorMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch messages for a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([sampleMessage]);
    const { result } = renderHook(() => useSupervisorMessages('conv-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([sampleMessage]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/conversations/conv-1/messages',
      method: 'GET',
      params: { limit: '50', offset: '0' },
    });
  });

  it('should not fetch when conversationId is undefined', () => {
    const { result } = renderHook(() => useSupervisorMessages(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Fetch failed'));
    const { result } = renderHook(() => useSupervisorMessages('conv-1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useTakeoverConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should takeover a conversation', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useTakeoverConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/conversations/conv-1/takeover',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Takeover failed'));
    const { result } = renderHook(() => useTakeoverConversation(), { wrapper });
    act(() => {
      result.current.mutate('conv-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCloseDigitalConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should close a digital conversation with reason', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCloseDigitalConversation(), { wrapper });
    act(() => {
      result.current.mutate({ conversationId: 'conv-1', reason: 'Resolved' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/conversations/conv-1/close',
      method: 'POST',
      data: { reason: 'Resolved' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Close failed'));
    const { result } = renderHook(() => useCloseDigitalConversation(), { wrapper });
    act(() => {
      result.current.mutate({ conversationId: 'conv-1' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useSendCoachingNote', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a coaching note', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useSendCoachingNote(), { wrapper });
    act(() => {
      result.current.mutate({ conversationId: 'conv-1', text: 'Great job!' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/conversations/conv-1/note',
      method: 'POST',
      data: { text: 'Great job!' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Note failed'));
    const { result } = renderHook(() => useSendCoachingNote(), { wrapper });
    act(() => {
      result.current.mutate({ conversationId: 'conv-1', text: 'Note' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRetryCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should POST to the retry-callback endpoint and invalidate stuck work', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const spyWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRetryCallback(), { wrapper: spyWrapper });
    act(() => {
      result.current.mutate('voice-1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/supervisor/conversations/voice-1/retry-callback',
      method: 'POST',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['supervisor', 'stuck'] });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Retry failed'));
    const { result } = renderHook(() => useRetryCallback(), { wrapper });
    act(() => {
      result.current.mutate('voice-1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
