import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import type { i18n } from 'i18next';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import * as client from '@/core/api/client';
import { ApiError } from '@/core/api/api-error';
import { createLocaleI18n } from '@/test/locale-i18n';
import {
  useAcceptConversation,
  useCreateConversation,
  useHoldConversation,
  useSendMessage,
  useTransferConversation,
} from './use-conversations';
import {
  useCloseDigitalConversation,
  useReassignConversation,
  useTakeoverConversation,
} from './use-supervisor';
import { useTypify, type TypificationFormResponse } from './use-typification';

/**
 * H20 (spec `conversation-action-feedback`): a refused conversation action shows a localized message
 * chosen from the status and Platform's machine code, never the server's text.
 */

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function makeWrapper(i18nInstance: i18n) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18nInstance}>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </I18nextProvider>
    );
  }
  return { qc, wrapper };
}

/** The last error toast as the user sees it: its text and the `data-error-code` it carries. */
function lastErrorToast(): { code: string | null; text: string } {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as ReactNode;
  const { container, unmount } = render(<div>{content}</div>);
  const coded = container.querySelector('[data-error-code]');
  const out = { code: coded?.getAttribute('data-error-code') ?? null, text: container.textContent };
  unmount();
  return out;
}

describe('conversation refusals (H20)', () => {
  let es: i18n;

  beforeEach(async () => {
    vi.clearAllMocks();
    es = await createLocaleI18n('es-419');
  });

  it('useAcceptConversation_ShouldShowTheLocalizedOfferedToAnotherAgentMessage_WhenPlatformAnswers403NotOfferedToYou', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(403, { error: 'not-offered-to-you' }),
    );
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useAcceptConversation(), { wrapper });

    act(() => result.current.mutate('conv-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    const shown = lastErrorToast();
    expect(shown).toEqual({
      code: 'not-offered-to-you',
      text: es.t('errors.conversation.not_offered_to_you'),
    });
    expect(shown.text).not.toContain('not-offered-to-you');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('useAcceptConversation_ShouldShowTheLocalizedConflictAndNotTheEnglishReason_WhenPlatformAnswers409', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(409, { error: 'Agent has no capacity.' }),
    );
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useAcceptConversation(), { wrapper });

    act(() => result.current.mutate('conv-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    const shown = lastErrorToast();
    expect(shown).toEqual({
      code: 'conversation-conflict',
      text: es.t('errors.conversation.conflict'),
    });
    expect(shown.text).not.toContain('Agent has no capacity');
  });

  it('useHoldConversation_ShouldShowTheLocalizedConflictAndNotTheEnglishReason_WhenPlatformAnswers400WithoutACode', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(400, { error: 'Cannot hold conversation' }),
    );
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useHoldConversation(), { wrapper });

    act(() => result.current.mutate('conv-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    const shown = lastErrorToast();
    expect(shown).toEqual({
      code: 'conversation-conflict',
      text: es.t('errors.conversation.conflict'),
    });
    expect(shown.text).not.toContain('Cannot hold conversation');
  });

  it('useTypify_ShouldNameTheRefusedFieldByTheFormLabelAndHideTheEnglishMessages_WhenPlatformAnswers400WithAnErrorsList', async () => {
    const form: TypificationFormResponse = {
      schema: {
        schemaId: 'schema-1',
        name: 'Resultados',
        version: 1,
        isPublished: true,
        maxDepth: 2,
        nodes: [],
        fields: [
          {
            fieldId: 'f-1',
            key: 'callback_at',
            label: 'Hora de devolución',
            type: 'Date',
            required: true,
            sortOrder: 0,
          },
        ],
        createdAt: '2026-10-01T00:00:00Z',
      },
    };
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(400, {
        errors: [{ field: 'callback_at', message: "Field 'callback_at' is required." }],
      }),
    );
    const { qc, wrapper } = makeWrapper(es);
    qc.setQueryData(['typification', 'form', 'conv-1'], form);
    const { result } = renderHook(() => useTypify(), { wrapper });

    act(() =>
      result.current.mutate({
        conversationId: 'conv-1',
        selectedNodePath: ['n-1'],
        fieldValues: {},
      }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    const shown = lastErrorToast();
    expect(shown).toEqual({
      code: 'typify-invalid',
      text: es.t('errors.conversation.typify_invalid', { fields: 'Hora de devolución' }),
    });
    expect(shown.text).not.toContain('is required');
  });

  it('useSendMessage_ShouldShowTheLocalizedNotOwnerMessage_WhenPlatformAnswers403NotOwner', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, { error: 'not-owner' }));
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useSendMessage(), { wrapper });

    act(() => result.current.mutate({ conversationId: 'conv-1', text: 'hola' }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(lastErrorToast()).toEqual({
      code: 'not-owner',
      text: es.t('errors.conversation.not_owner'),
    });
  });

  it('useTransferConversation_ShouldShowTheMissingAgentMessageAndNoConfirmation_WhenPlatformAnswers400TargetAgentNotFound', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(400, { error: 'target-agent-not-found' }),
    );
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useTransferConversation(), { wrapper });

    act(() => result.current.mutate({ id: 'conv-1', targetAgentId: 'agent-gone' }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(lastErrorToast()).toEqual({
      code: 'target-agent-not-found',
      text: es.t('errors.conversation.target_agent_not_found'),
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('useCreateConversation_ShouldShowContactNotFound_WhenPlatformAnswers404ContactNotFound', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(404, { error: 'Contact not found' }),
    );
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useCreateConversation(), { wrapper });

    act(() =>
      result.current.mutate({ contactId: 'gone', channel: 'WebChat', initialMessage: 'hola' }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(lastErrorToast()).toEqual({
      code: 'contact-not-found',
      text: es.t('errors.conversation.contact_not_found'),
    });
  });

  it('useTakeoverConversation_ShouldShowTheNeedsAnAgentProfileMessage_WhenPlatformAnswers403NotAnAgent', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, { error: 'not-an-agent' }));
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useTakeoverConversation(), { wrapper });

    act(() => result.current.mutate('conv-1'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(lastErrorToast()).toEqual({
      code: 'not-an-agent',
      text: es.t('errors.conversation.not_an_agent'),
    });
  });

  it('useReassignConversation_ShouldShowTheLocalizedConflict_WhenPlatformAnswers400WithoutACode', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(
      new ApiError(400, { error: 'Conversation cannot be reassigned in its current state.' }),
    );
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useReassignConversation(), { wrapper });

    act(() => result.current.mutate({ id: 'conv-1', targetQueueId: 'q-1' }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(lastErrorToast()).toEqual({
      code: 'conversation-conflict',
      text: es.t('errors.conversation.conflict'),
    });
  });

  it('useCloseDigitalConversation_ShouldShowConversationNotFound_WhenPlatformAnswers404', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(404, null));
    const { wrapper } = makeWrapper(es);
    const { result } = renderHook(() => useCloseDigitalConversation(), { wrapper });

    act(() => result.current.mutate({ conversationId: 'gone' }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(lastErrorToast()).toEqual({
      code: 'conversation-not-found',
      text: es.t('errors.conversation.conversation_not_found'),
    });
  });
});
