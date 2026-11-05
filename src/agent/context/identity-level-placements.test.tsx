import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  applyVoiceScreenPop,
  initConversationSSE,
  useConversationStore,
  type Conversation,
} from '@/agent/stores/conversation-store';
import { ConversationPanel } from '@/agent/conversation/conversation-panel';
import { ApiError } from '@/core/api/api-error';
import * as client from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useAcceptConversation } from '@/core/api/hooks/use-conversations';
import {
  contactAnonymous,
  contactLevelOne,
  contactLevelTwo,
  contactWithoutWebChat,
  terminalConversation,
  voiceScreenPopInbound,
} from '@/tests/utils/contract-doubles';
import esAgent from '../../../public/locales/es-419/agent.json';
import { ContactInfo } from './contact-info';

/**
 * The mark on the contact card and in the conversation header (W7, spec `agent-console-contact-identity`):
 * the real `useContact`, the real store and a non-English locale, with only `customFetch` answered, by URL.
 */

const { sseHandlers } = vi.hoisted(() => ({
  sseHandlers: {} as Record<string, (data: unknown) => void>,
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('es-419');
  return {
    ...actual,
    useTranslation: (ns?: string | string[]) => ({
      t: i18n.getFixedT('es-419', Array.isArray(ns) ? ns[0] : (ns ?? 'common')),
      i18n,
    }),
  };
});
vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/i18n/use-format-phone', () => ({
  useFormatPhone: () => ({ formatPhone: (raw: string) => raw }),
}));
vi.mock('@/core/hooks/use-sse', () => ({
  onSseEvent: (type: string, handler: (data: unknown) => void) => {
    sseHandlers[type] = handler;
    return () => undefined;
  },
}));
vi.mock('@/agent/conversation/message-thread', () => ({ MessageThread: () => null }));
vi.mock('@/agent/conversation/reply-composer', () => ({ ReplyComposer: () => null }));
vi.mock('@/agent/conversation/transfer-dialog', () => ({ TransferDialog: () => null }));
vi.mock('@/agent/conversation/suggestion-banner', () => ({ SuggestionBanner: () => null }));
vi.mock('@/agent/conversation/sentiment-gauge', () => ({ SentimentGauge: () => null }));
vi.mock('@/agent/conversation/compliance-alert', () => ({ ComplianceAlert: () => null }));
vi.mock('@/agent/conversation/wrap-up-dialog', () => ({ WrapUpDialog: () => null }));

type WireContact = components['schemas']['Contact'];

const CONVERSATION_ID = 'conv-1';
const RECORD_URL = `/api/v1/conversations/${CONVERSATION_ID}`;
const contactUrl = (id: string | undefined) => `/api/v1/contacts/${id}`;

const reservedAddressNoLevel: WireContact = {
  ...contactWithoutWebChat,
  addresses: [{ channel: 'WebChat', address: 'webchat-external:cust-48151623' }],
};
const unknownLevel = { ...contactLevelTwo, identityLevel: 'Trusted' } as unknown as WireContact;

function serve(answers: Record<string, unknown>) {
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const url = config.url ?? '';
    if (config.method === 'POST' && url.endsWith('/accept')) return {};
    if (!Object.hasOwn(answers, url)) throw new Error(`Unexpected request: ${url}`);
    const value = answers[url];
    if (value instanceof Error) throw value;
    return value;
  });
}

function requestedUrls() {
  return vi.mocked(client.customFetch).mock.calls.map(([config]) => config.url);
}

function select(contactId: string | undefined) {
  useConversationStore.setState({
    selectedId: CONVERSATION_ID,
    conversations: {
      [CONVERSATION_ID]: {
        id: CONVERSATION_ID,
        contactId,
        contactName: 'Ana',
        channel: 'webchat',
        queueName: 'Support',
        state: 'active',
        lastMessage: '',
        lastMessageAt: '2026-11-04T14:05:00.000+00:00',
        unread: false,
        assignedAt: '2026-11-04T14:05:00.000+00:00',
      } as Conversation,
    },
  });
}

function AcceptButton() {
  const accept = useAcceptConversation();
  return (
    <button type="button" data-testid="accept" onClick={() => accept.mutate(CONVERSATION_ID)} />
  );
}

const PLACEMENTS = [
  ['the contact card', () => <ContactInfo />],
  ['the conversation header', () => <ConversationPanel conversationId={CONVERSATION_ID} />],
] as const;

function renderPlacement(placement: () => React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      {placement()}
      <AcceptButton />
    </QueryClientProvider>,
  );
  return qc;
}

/** The read has answered and React has rendered its answer, so "no mark" is not "not yet". */
async function readSettled(qc: QueryClient, id: string | undefined) {
  await waitFor(() => {
    const status = qc.getQueryState(['contacts', id])?.status;
    expect(status === 'success' || status === 'error').toBe(true);
  });
  await act(async () => {});
}

const marks = () => Array.from(document.querySelectorAll('[data-identity-level]'));

describe('the identity mark on the card and in the header', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useConversationStore.setState({ selectedId: null, conversations: {} });
    initConversationSSE();
  });

  afterEach(() => {
    cleanup();
  });

  describe.each(PLACEMENTS)('%s', (_name, placement) => {
    it('Placement_ShouldShowTheUnverifiedMarkFromTheLocale_WhenTheLevelIsUnverified', async () => {
      serve({ [contactUrl(contactLevelOne.contactId)]: contactLevelOne });
      select(contactLevelOne.contactId);
      renderPlacement(placement);

      const mark = await waitFor(() => {
        const [first] = marks();
        if (!first) throw new Error('no mark yet');
        return first;
      });
      expect(marks()).toHaveLength(1);
      expect(mark).toHaveAttribute('data-identity-level', 'Unverified');
      expect(mark.textContent).toBe(esAgent.identity.unverified);
      expect(mark).toHaveAccessibleName(esAgent.identity.unverified_hint);
    });

    it('Placement_ShouldShowTheVerifiedBadgeFromTheLocale_WhenTheLevelIsVerified', async () => {
      serve({ [contactUrl(contactLevelTwo.contactId)]: contactLevelTwo });
      select(contactLevelTwo.contactId);
      renderPlacement(placement);

      const mark = await waitFor(() => {
        const [first] = marks();
        if (!first) throw new Error('no mark yet');
        return first;
      });
      expect(marks()).toHaveLength(1);
      expect(mark).toHaveAttribute('data-identity-level', 'Verified');
      expect(mark.textContent).toBe(esAgent.identity.verified);
      expect(mark).toHaveAccessibleName(esAgent.identity.verified_hint);
    });

    it.each([
      ['Anonymous', contactAnonymous],
      ['absent', contactWithoutWebChat],
      ['absent with a reserved address', reservedAddressNoLevel],
      ['outside the three values', unknownLevel],
    ])('Placement_ShouldShowNoMark_WhenTheLevelIs %s', async (_level, contact) => {
      serve({ [contactUrl(contact.contactId)]: contact });
      select(contact.contactId);
      const qc = renderPlacement(placement);

      await readSettled(qc, contact.contactId);

      expect(qc.getQueryState(['contacts', contact.contactId])?.status).toBe('success');
      expect(marks()).toHaveLength(0);
    });

    it('Placement_ShouldReadNothing_OnAFreshOffer_ThenMarkTheContact_WhenTheOfferIsAccepted', async () => {
      const contactRequest = contactUrl(contactLevelOne.contactId);
      serve({
        [RECORD_URL]: { ...terminalConversation, contactId: contactLevelOne.contactId },
        [contactRequest]: contactLevelOne,
      });
      sseHandlers['conversation.offered']?.({
        conversationId: CONVERSATION_ID,
        channel: 'WebChat',
      });
      useConversationStore.setState({ selectedId: CONVERSATION_ID });
      expect(useConversationStore.getState().conversations[CONVERSATION_ID]?.contactId).toBe('');
      renderPlacement(placement);

      fireEvent.click(screen.getByTestId('accept'));

      await waitFor(() =>
        expect(document.querySelector('[data-identity-level="Unverified"]')).toBeInTheDocument(),
      );
      // The accept itself gave the store no id: the mark came from the id on the record.
      expect(useConversationStore.getState().conversations[CONVERSATION_ID]?.contactId).toBe('');
      expect(requestedUrls()).not.toContain(contactUrl(''));
      expect(requestedUrls()).not.toContain(contactUrl(undefined));
    });
  });

  describe('the header before the contact read answers', () => {
    const header = PLACEMENTS[1][1];

    it('Header_ShouldShowNoMark_WhileTheReadIsPending_ThenTheMark_WhenItAnswers', async () => {
      let answer: (body: WireContact) => void = () => undefined;
      vi.mocked(client.customFetch).mockImplementation(
        () =>
          new Promise((resolve) => {
            answer = resolve as (body: WireContact) => void;
          }),
      );
      select(contactLevelOne.contactId);
      renderPlacement(header);

      await waitFor(() => expect(requestedUrls()).toContain(contactUrl(contactLevelOne.contactId)));
      expect(screen.getByTestId('conversation-channel-badge')).toBeInTheDocument();
      expect(marks()).toHaveLength(0);

      await act(async () => answer(contactLevelOne));

      await waitFor(() => expect(marks()).toHaveLength(1));
    });

    it('Header_ShouldShowNoMark_WhenTheReadFailed', async () => {
      serve({ [contactUrl(contactLevelOne.contactId)]: new ApiError(500, null) });
      select(contactLevelOne.contactId);
      const qc = renderPlacement(header);

      await readSettled(qc, contactLevelOne.contactId);

      expect(qc.getQueryState(['contacts', contactLevelOne.contactId])?.status).toBe('error');
      expect(marks()).toHaveLength(0);
    });

    it('Header_ShouldReadTheContactOfTheScreenPop_OnAVoiceConversation', async () => {
      const contactRequest = '/api/v1/contacts/0b1c2d3e4f5a46b7c8d9e0f1a2b3c4d5';
      serve({ [contactRequest]: contactWithoutWebChat });
      applyVoiceScreenPop(voiceScreenPopInbound);
      const conversationId = voiceScreenPopInbound.conversationId;
      useConversationStore.setState({ selectedId: conversationId });

      const qc = renderPlacement(() => <ConversationPanel conversationId={conversationId} />);

      await readSettled(qc, voiceScreenPopInbound.contactId);
      expect(vi.mocked(client.customFetch)).toHaveBeenCalledWith({
        url: contactRequest,
        method: 'GET',
      });
      expect(requestedUrls()).not.toContain(`/api/v1/conversations/${conversationId}`);
      expect(marks()).toHaveLength(0);
    });
  });
});
