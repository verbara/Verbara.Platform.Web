import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/core/api/api-error';
import * as client from '@/core/api/client';
import { useConversationStore } from '@/agent/stores/conversation-store';
import type { Conversation } from '@/core/api/hooks/use-conversations';
import { ConversationPanel } from './conversation-panel';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The panel's children own their own data and are covered by their own tests; here they are inert
// so the test measures the header actions only. The wrap-up sheet is reduced to its open state.
vi.mock('./message-thread', () => ({ MessageThread: () => null }));
vi.mock('./reply-composer', () => ({ ReplyComposer: () => null }));
vi.mock('./transfer-dialog', () => ({ TransferDialog: () => null }));
vi.mock('./suggestion-banner', () => ({ SuggestionBanner: () => null }));
vi.mock('./sentiment-gauge', () => ({ SentimentGauge: () => null }));
vi.mock('./compliance-alert', () => ({ ComplianceAlert: () => null }));
vi.mock('./wrap-up-dialog', () => ({
  WrapUpDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="wrap-up-sheet-open" /> : null,
}));

function conversation(state: Conversation['state'], channel = 'webchat'): Conversation {
  return {
    id: 'conv-1',
    contactId: 'contact-1',
    contactName: 'Ana',
    channel,
    queueName: 'Support',
    state,
    lastMessage: '',
    lastMessageAt: '2026-10-12T10:00:00Z',
    unread: false,
    assignedAt: '2026-10-12T10:00:00Z',
  };
}

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return render(<ConversationPanel conversationId="conv-1" />, { wrapper });
}

function toastedCode(): unknown {
  const calls = vi.mocked(toast.error).mock.calls;
  const element = calls[calls.length - 1]?.[0] as ReactElement<Record<string, unknown>> | undefined;
  return element?.props['data-error-code'];
}

async function confirmClose() {
  fireEvent.click(screen.getByTestId('conversation-close-btn'));
  fireEvent.click(await screen.findByTestId('confirm-dialog-confirm'));
}

beforeEach(() => {
  vi.clearAllMocks();
  useConversationStore.setState({
    conversations: { 'conv-1': conversation('active') },
    messages: {},
  });
});

describe('ConversationPanel close', () => {
  it('ConversationPanel_ShouldCloseAndLeaveTheConversation_WhenPlatformClosesAnActiveChat', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({});
    renderPanel();

    await confirmClose();

    await waitFor(() =>
      expect(useConversationStore.getState().conversations['conv-1']).toBeUndefined(),
    );
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/conversations/conv-1/close',
      method: 'POST',
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('wrap-up-sheet-open')).toBeNull();
  });

  it('ConversationPanel_ShouldOpenTheWrapUpSheet_WhenPlatformAnswersTypificationRequired', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(409, { error: 'typification-required' }),
    );
    renderPanel();
    expect(screen.queryByTestId('wrap-up-sheet-open')).toBeNull();

    await confirmClose();

    expect(await screen.findByTestId('wrap-up-sheet-open')).toBeInTheDocument();
    expect(toastedCode()).toBe('typification-required');
    expect(useConversationStore.getState().conversations['conv-1']?.state).toBe('active');
  });

  it('ConversationPanel_ShouldToastAndShowTheRefetchedState_WhenPlatformAnswersNotClosable', async () => {
    vi.mocked(client.customFetch).mockImplementation(async (config) => {
      if (config.method === 'POST') throw new ApiError(409, { error: 'conversation-not-closable' });
      return {
        conversationId: 'conv-1',
        contactId: 'contact-1',
        channel: 'WebChat',
        state: 'WrapUp',
        createdAt: '2026-10-12T10:00:00Z',
      };
    });
    renderPanel();

    await confirmClose();

    // The refetched WrapUp state replaces the stale Active actions with "Complete wrap-up".
    expect(await screen.findByTestId('conversation-complete-wrapup-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('conversation-close-btn')).toBeNull();
    expect(toastedCode()).toBe('conversation-not-closable');
    expect(screen.queryByTestId('wrap-up-sheet-open')).toBeNull();
  });

  it('ConversationPanel_ShouldOfferNoCloseButtonForAVoiceCall_WhenTheCallIsLive', () => {
    useConversationStore.setState({
      conversations: { 'conv-1': conversation('active', 'voice') },
      messages: {},
    });
    renderPanel();

    expect(screen.queryByTestId('conversation-close-btn')).toBeNull();
    expect(screen.getByTestId('voice-wrapup-btn')).toBeInTheDocument();
  });
});
