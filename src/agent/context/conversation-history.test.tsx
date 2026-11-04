import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import {
  initConversationSSE,
  useConversationStore,
  type Conversation,
} from '@/agent/stores/conversation-store';
import { ApiError } from '@/core/api/api-error';
import * as client from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { useAcceptConversation } from '@/core/api/hooks/use-conversations';
import { TEST_LOCALES } from '@/test/locale-i18n';
import enAgent from '../../../public/locales/en-US/agent.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import ptAgent from '../../../public/locales/pt-BR/agent.json';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import {
  abandonedContactSummary,
  closedContactSummary,
  contactSummaryFirstOfTwoPages,
  contactSummaryPage,
  contactSummaryShiftedSecondPage,
  conversationStateValues,
  heldContactSummary,
  historyFirstPage,
  notReadableRefusal,
  terminalConversation,
} from '@/tests/utils/contract-doubles';
import { ConversationHistory } from './conversation-history';

type Summary = components['schemas']['ContactConversationSummaryDto'];
type SummaryPage = components['schemas']['PagedResultOfContactConversationSummaryDto'];

/**
 * The History tab against the summary doubles (W3, W4, W9, W14): the hooks are the real ones, and
 * only `customFetch` is answered, by URL, so a refusal travels the path it takes in the console.
 */

const { scene, sseHandlers } = vi.hoisted(() => ({
  scene: { lng: 'en-US' as 'en-US' | 'es-419' | 'pt-BR' },
  sseHandlers: {} as Record<string, (data: unknown) => void>,
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('es-419');
  return {
    ...actual,
    useTranslation: () => ({
      t: i18n.getFixedT(scene.lng, 'agent'),
      i18n: { ...i18n, language: scene.lng },
    }),
  };
});
vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The stream itself is not under test: this hands the store's own handlers to the test.
vi.mock('@/core/hooks/use-sse', () => ({
  onSseEvent: (type: string, handler: (data: unknown) => void) => {
    sseHandlers[type] = handler;
    return () => undefined;
  },
}));

const CONVERSATION_ID = 'conv-1';
const CONTACT_ID = terminalConversation.contactId;
const RECORD_URL = `/api/v1/conversations/${CONVERSATION_ID}`;
const ACCEPT_URL = `${RECORD_URL}/accept`;
const LIST_URL = `/api/v1/contacts/${CONTACT_ID}/conversations`;

const REFUSED = () => new ApiError(403, notReadableRefusal);
const NOT_FOUND = () => new ApiError(404, null);
const SERVER_ERROR = () => new ApiError(500, null);

type Answer = unknown | (() => unknown);

/** What each URL answers now: a thrown `ApiError` for an error, the value itself otherwise. */
function serve(answers: Record<string, Answer>) {
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const url = config.url ?? '';
    if (!Object.hasOwn(answers, url)) throw new Error(`Unexpected request: ${url}`);
    const answer = answers[url];
    const value = typeof answer === 'function' ? (answer as () => unknown)() : answer;
    if (value instanceof Error) throw value;
    return value;
  });
}

/** Answers `LIST_URL` by the `page` the hook asks for. */
function servePages(pages: Record<string, Answer>) {
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const answer = pages[String(config.params?.page)];
    const value = typeof answer === 'function' ? (answer as () => unknown)() : answer;
    if (value instanceof Error) throw value;
    return value;
  });
}

function requestsTo(url: string) {
  return vi.mocked(client.customFetch).mock.calls.filter(([config]) => config.url === url);
}

function pageOf(...items: Summary[]): SummaryPage {
  return { ...contactSummaryPage, items };
}

function selectConversation(contactId = CONTACT_ID) {
  const selected = { id: CONVERSATION_ID, contactId } as Conversation;
  useConversationStore.setState({
    selectedId: CONVERSATION_ID,
    conversations: { [CONVERSATION_ID]: selected },
  });
}

/** A fresh offer, through the store's own `conversation.offered` handler: no contact id on the event. */
function receiveFreshOffer() {
  sseHandlers['conversation.offered']?.({
    conversationId: CONVERSATION_ID,
    agentId: 'a-9e8d7c6b5a493827',
    queueId: 'q-support-0001',
    channel: 'WhatsApp',
  });
  useConversationStore.setState({ selectedId: CONVERSATION_ID });
  return useConversationStore.getState().conversations[CONVERSATION_ID];
}

function AcceptButton() {
  const accept = useAcceptConversation();
  return (
    <button type="button" data-testid="accept" onClick={() => accept.mutate(CONVERSATION_ID)} />
  );
}

function renderTab() {
  // The app's settings (query-client.ts), but for the retry that would only slow a refusal down.
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <ConversationHistory />
      <AcceptButton />
    </QueryClientProvider>,
  );
  return qc;
}

const rows = () => screen.queryAllByTestId('history-row');
const rowFor = (id: string) => {
  const row = rows().find((r) => r.getAttribute('data-conversation-id') === id);
  if (!row) throw new Error(`No row for ${id}`);
  return row;
};
const shownIds = () => rows().map((r) => r.getAttribute('data-conversation-id'));

describe('ConversationHistory', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    scene.lng = 'en-US';
    useConversationStore.setState({ selectedId: null, conversations: {} });
    initConversationSSE();
  });

  afterEach(() => {
    cleanup();
  });

  describe('channel names', () => {
    function renderChannels(...channels: string[]) {
      serve({
        [LIST_URL]: pageOf(
          ...channels.map((channel, i) => ({
            ...closedContactSummary,
            id: `h-${i}`,
            channel,
          })),
        ),
      } as Record<string, Answer>);
      selectConversation();
      renderTab();
    }

    it('ConversationHistory_ShouldNameEachChannelThroughTheKeyedSet_InEs419', async () => {
      scene.lng = 'es-419';
      renderChannels('WebChat', 'Voice', 'Instagram');

      expect(await screen.findByText(esCommon.channels.webchat)).toBeInTheDocument();
      expect(screen.getByText(esCommon.channels.voice)).toBeInTheDocument();
      expect(screen.getByText(esCommon.channels.instagram)).toBeInTheDocument();
    });

    it('ConversationHistory_ShouldUseTheSameLabelAsTheRestOfTheConsole_InEnUs', async () => {
      renderChannels('WebChat');

      expect(await screen.findByText(enCommon.channels.webchat)).toBeInTheDocument();
    });

    it('ConversationHistory_ShouldShowTheChannelAsItCame_WhenItHasNoKey', async () => {
      renderChannels('Pigeon');

      expect(await screen.findByText('Pigeon')).toBeInTheDocument();
    });
  });

  describe('rows', () => {
    it('ConversationHistory_ShouldRenderTheItemsInServedOrder_WhenTheFixturePageLoads', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(shownIds()).toEqual([
        heldContactSummary.id,
        closedContactSummary.id,
        abandonedContactSummary.id,
      ]);
      expect(requestsTo(LIST_URL)[0]?.[0].params).toEqual({ page: '1', pageSize: '25' });
    });

    it('ConversationHistory_ShouldShowEveryMemberOfThePastRow_WhenTheFixturesSecondItemRenders', async () => {
      serve({ [LIST_URL]: pageOf(closedContactSummary) });
      selectConversation();
      renderTab();

      const row = within(await screen.findByTestId('history-row'));
      expect(row.getByText(enCommon.channels.whatsapp)).toBeInTheDocument();
      expect(row.getByText(enAgent.history.states.closed)).toBeInTheDocument();
      expect(row.getByText('Support')).toBeInTheDocument();
      expect(row.getByText('Agent A')).toBeInTheDocument();
      expect(row.getByText('1h 5m')).toBeInTheDocument();
      expect(row.getByText(enAgent.history.closed_reasons.inactivity)).toBeInTheDocument();
      expect(row.getByText('Card replacement requested')).toBeInTheDocument();
      expect(row.getByText(closedContactSummary.lastMessage?.preview ?? '')).toBeInTheDocument();
    });

    it('ConversationHistory_ShouldPrefixTheLastMessageByItsDirection_WhenThereIsOne', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(rowFor(closedContactSummary.id)).toHaveTextContent(
        `${enAgent.history.direction.outbound}: ${closedContactSummary.lastMessage?.preview}`,
      );
      expect(rowFor(heldContactSummary.id)).toHaveTextContent(
        `${enAgent.history.direction.inbound}: ${heldContactSummary.lastMessage?.preview}`,
      );
    });

    it('ConversationHistory_ShouldLeaveTheCellsEmpty_WhenTheFixturesThirdItemOmitsThem', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      const row = rowFor(abandonedContactSummary.id);
      expect(within(row).getByText('30m')).toBeInTheDocument();
      expect(within(row).getByText(enAgent.history.states.abandoned)).toBeInTheDocument();
      expect(within(row).queryByText('Support')).not.toBeInTheDocument();
      expect(within(row).queryByText('Agent A')).not.toBeInTheDocument();
      expect(within(row).queryByText(enAgent.history.closed_reasons.inactivity)).toBeNull();
      expect(row.querySelector('[data-testid="history-disposition"]')).toBeNull();
      expect(row.querySelector('[data-testid="history-queue"]')).toBeNull();
      expect(row.querySelector('[data-testid="history-agent"]')).toBeNull();
      expect(row.querySelector('[data-testid="history-closed-reason"]')).toBeNull();
    });

    it('ConversationHistory_ShouldNeverDisplayAnId_WhenARowRenders', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      for (const summary of contactSummaryPage.items) {
        const text = rowFor(summary.id).textContent;
        expect(text).not.toContain(summary.id);
        if (summary.agentId) expect(text).not.toContain(summary.agentId);
        if (summary.queueId) expect(text).not.toContain(summary.queueId);
        if (summary.disposition?.nodeId) expect(text).not.toContain(summary.disposition.nodeId);
      }
    });

    it('ConversationHistory_ShouldShowNoDisposition_WhenItCarriesNoLabel', async () => {
      const { disposition, ...rest } = closedContactSummary;
      serve({
        [LIST_URL]: pageOf({ ...rest, disposition: { nodeId: disposition?.nodeId ?? '' } }),
      } as Record<string, Answer>);
      selectConversation();
      renderTab();

      const row = await screen.findByTestId('history-row');
      expect(row.querySelector('[data-testid="history-disposition"]')).toBeNull();
    });

    it.each([
      [3905, '1h 5m'],
      [1800, '30m'],
      [90, '1m 30s'],
      [0, '0s'],
    ])(
      'ConversationHistory_ShouldFormatTheDurationAsServed_WhenItIs %i seconds',
      async (durationSeconds, shown) => {
        serve({ [LIST_URL]: pageOf({ ...closedContactSummary, durationSeconds }) });
        selectConversation();
        renderTab();

        const row = await screen.findByTestId('history-row');
        expect(within(row).getByTestId('history-duration')).toHaveTextContent(shown);
      },
    );

    it('ConversationHistory_ShouldShowNoDuration_WhenItIsAbsent', async () => {
      serve({ [LIST_URL]: pageOf(heldContactSummary) });
      selectConversation();
      renderTab();

      const row = await screen.findByTestId('history-row');
      expect(row.querySelector('[data-testid="history-duration"]')).toBeNull();
    });

    it('ConversationHistory_ShouldShowLastMessageAtRelativeAndCreatedAtAsTooltip_WhenARowRenders', async () => {
      serve({ [LIST_URL]: pageOf(closedContactSummary) });
      selectConversation();
      renderTab();

      const time = within(await screen.findByTestId('history-row')).getByTestId('history-time');
      expect(time).toHaveTextContent(
        formatDistanceToNow(parseISO(closedContactSummary.lastMessageAt), {
          addSuffix: true,
          locale: enUS,
        }),
      );
      expect(time).toHaveAttribute(
        'title',
        format(parseISO(closedContactSummary.createdAt), 'PPp', { locale: enUS }),
      );
    });

    it.each(['inactivity', 'inactivity-backlog', 'customer-returned'])(
      'ConversationHistory_ShouldLocalizeTheCloseReason_WhenItIs %s',
      async (closedReason) => {
        serve({ [LIST_URL]: pageOf({ ...closedContactSummary, closedReason }) });
        selectConversation();
        renderTab();

        const row = await screen.findByTestId('history-row');
        const key = closedReason.replace('-', '_') as keyof typeof enAgent.history.closed_reasons;
        expect(within(row).getByTestId('history-closed-reason')).toHaveTextContent(
          enAgent.history.closed_reasons[key],
        );
      },
    );

    it.each(['something-new', 'constructor'])(
      'ConversationHistory_ShouldShowNoCloseReason_WhenTheValueIsUnknown %s',
      async (closedReason) => {
        serve({ [LIST_URL]: pageOf({ ...closedContactSummary, closedReason }) });
        selectConversation();
        renderTab();

        const row = await screen.findByTestId('history-row');
        expect(row.querySelector('[data-testid="history-closed-reason"]')).toBeNull();
        expect(row).not.toHaveTextContent(closedReason);
      },
    );

    it.each(conversationStateValues)(
      'ConversationHistory_ShouldLabelTheStateInEveryLocale_WhenItIs %s',
      async (state) => {
        for (const lng of TEST_LOCALES) {
          scene.lng = lng;
          serve({ [LIST_URL]: pageOf({ ...closedContactSummary, state }) });
          selectConversation();
          renderTab();

          const row = await screen.findByTestId('history-row');
          expect(row).toHaveAttribute('data-state', state);
          const label = within(row).getByTestId('history-state').textContent;
          expect(label).not.toBe('');
          expect(label).not.toContain('history.states');
          cleanup();
        }
      },
    );

    it.each(['Text', 'Image', 'Audio', 'Video', 'File', 'Location', 'Interactive'] as const)(
      'ConversationHistory_ShouldLabelAnEmptyPreviewInEveryLocale_WhenTheBlockTypeIs %s',
      async (blockType) => {
        const key = blockType.toLowerCase() as keyof typeof enAgent.history.block_types;
        const labels = [
          ['en-US', enAgent.history.block_types[key]],
          ['es-419', esAgent.history.block_types[key]],
          ['pt-BR', ptAgent.history.block_types[key]],
        ] as const;
        for (const [lng, label] of labels) {
          scene.lng = lng;
          serve({
            [LIST_URL]: pageOf({
              ...abandonedContactSummary,
              lastMessage: { ...abandonedContactSummary.lastMessage!, blockType, preview: '' },
            }),
          });
          selectConversation();
          renderTab();

          const row = await screen.findByTestId('history-row');
          expect(within(row).getByTestId('history-last-message')).toHaveTextContent(label);
          cleanup();
        }
      },
    );

    it('ConversationHistory_ShouldShowNoLastMessageLine_WhenItIsAbsent', async () => {
      const { lastMessage: _omitted, ...withoutLastMessage } = closedContactSummary;
      serve({ [LIST_URL]: pageOf(withoutLastMessage) });
      selectConversation();
      renderTab();

      const row = await screen.findByTestId('history-row');
      expect(row.querySelector('[data-testid="history-last-message"]')).toBeNull();
    });
  });

  describe('held row and paging', () => {
    it('ConversationHistory_ShouldMarkOnlyTheHeldRow_WhenTheFixturePageRenders', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      const held = rows().filter((r) => r.getAttribute('data-held-by-caller') === 'true');
      expect(held.map((r) => r.getAttribute('data-conversation-id'))).toEqual([
        heldContactSummary.id,
      ]);
      expect(
        within(rowFor(heldContactSummary.id)).getByTestId('history-held-mark'),
      ).toHaveTextContent(enAgent.history.held);
      expect(rowFor(closedContactSummary.id)).toHaveAttribute('data-held-by-caller', 'false');
      expect(screen.getAllByTestId('history-held-mark')).toHaveLength(1);
    });

    it('ConversationHistory_ShouldMakeOnlyPastRowsButtons_WhenTheFixturePageRenders', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(rowFor(heldContactSummary.id).tagName).not.toBe('BUTTON');
      expect(within(rowFor(heldContactSummary.id)).queryByRole('button')).toBeNull();
      for (const summary of [closedContactSummary, abandonedContactSummary]) {
        expect(rowFor(summary.id).tagName).toBe('BUTTON');
        expect(rowFor(summary.id)).toHaveAttribute('type', 'button');
      }
    });

    it('ConversationHistory_ShouldOpenAPastRowFromTheKeyboardFocus_WithoutChangingTheSelection', async () => {
      serve({
        [LIST_URL]: contactSummaryPage,
        [`/api/v1/conversations/${closedContactSummary.id}`]: terminalConversation,
        [`/api/v1/conversations/${closedContactSummary.id}/history`]: historyFirstPage,
      });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      const row = rowFor(closedContactSummary.id);
      row.focus();
      expect(row).toHaveFocus();
      // jsdom does not turn Enter on a focused button into a click, a browser does: the native
      // `<button>` above is the keyboard path, and this is the activation it produces.
      fireEvent.click(row);

      expect(await screen.findByTestId('history-viewer')).toHaveAttribute(
        'data-conversation-id',
        closedContactSummary.id,
      );
      expect(useConversationStore.getState().selectedId).toBe(CONVERSATION_ID);
    });

    it('ConversationHistory_ShouldOpenNothing_WhenTheHeldRowIsActivated', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      fireEvent.click(rowFor(heldContactSummary.id));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId('history-viewer')).not.toBeInTheDocument();
    });

    it('ConversationHistory_ShouldOfferOlderConversationsOnlyWhileThereAreMore_WhenPaging', async () => {
      servePages({ 1: contactSummaryFirstOfTwoPages, 2: contactSummaryShiftedSecondPage });
      selectConversation();
      renderTab();

      fireEvent.click(await screen.findByTestId('history-more'));

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(shownIds()).toEqual([
        heldContactSummary.id,
        closedContactSummary.id,
        abandonedContactSummary.id,
      ]);
      expect(screen.queryByTestId('history-more')).toBeNull();
    });

    it('ConversationHistory_ShouldNotOfferOlderConversations_WhenThereIsOnePage', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(screen.queryByTestId('history-more')).toBeNull();
    });
  });

  describe('refusal and not-found states', () => {
    it('ConversationHistory_ShouldShowTheRefusalAndNoRows_WhenTheFirstPageIsNotReadable', async () => {
      serve({ [LIST_URL]: REFUSED });
      selectConversation();
      renderTab();

      const refusal = await screen.findByTestId('read-refusal');
      expect(refusal).toHaveAttribute('data-refusal', 'not-readable');
      expect(refusal).toHaveTextContent(enAgent.history.errors.not_readable);
      expect(rows()).toHaveLength(0);
      expect(screen.queryByText(enAgent.context.no_history)).toBeNull();
    });

    it('ConversationHistory_ShouldShowTheEmptyHistoryText_WhenTheContactIsNotFound', async () => {
      serve({ [LIST_URL]: NOT_FOUND });
      selectConversation();
      renderTab();

      expect(await screen.findByText(enAgent.context.no_history)).toBeInTheDocument();
      expect(screen.queryByTestId('read-refusal')).toBeNull();
    });

    it('ConversationHistory_ShouldShowTheEmptyHistoryText_WhenThePageHasNoItems', async () => {
      serve({ [LIST_URL]: pageOf() });
      selectConversation();
      renderTab();

      expect(await screen.findByText(enAgent.context.no_history)).toBeInTheDocument();
    });

    it('ConversationHistory_ShouldShowTheGenericMessage_WhenTheFirstPageFailsOtherwise', async () => {
      serve({ [LIST_URL]: SERVER_ERROR });
      selectConversation();
      renderTab();

      expect(await screen.findByTestId('read-refusal')).toHaveAttribute(
        'data-refusal',
        'read-failed',
      );
    });

    it('ConversationHistory_ShouldShowNeitherTextNorRefusal_WhileTheFirstPageLoads', async () => {
      let answerList = (_page: unknown) => undefined as unknown;
      vi.mocked(client.customFetch).mockImplementation(
        () =>
          new Promise((resolve) => {
            answerList = resolve;
          }) as never,
      );
      selectConversation();
      renderTab();

      expect(await screen.findByTestId('history-loading')).toBeInTheDocument();
      expect(screen.queryByText(enAgent.context.no_history)).toBeNull();
      answerList(contactSummaryPage);
      await waitFor(() => expect(rows()).toHaveLength(3));
    });

    // Spec audit F2: Platform applies the read rule on every request, so a refusal can arrive with
    // the loaded rows still cached, whatever the fetch phase.
    it('ConversationHistory_ShouldReplaceTheRowsWithTheRefusal_WhenANextPageIsNotReadable', async () => {
      servePages({ 1: contactSummaryFirstOfTwoPages, 2: REFUSED });
      selectConversation();
      renderTab();

      fireEvent.click(await screen.findByTestId('history-more'));

      expect(await screen.findByTestId('read-refusal')).toHaveAttribute(
        'data-refusal',
        'not-readable',
      );
      expect(rows()).toHaveLength(0);
      expect(screen.queryByTestId('history-more')).toBeNull();
    });

    it('ConversationHistory_ShouldReplaceTheRowsWithTheRefusal_WhenARefetchIsNotReadable', async () => {
      const answers: Record<string, Answer> = { [LIST_URL]: contactSummaryPage };
      serve(answers);
      selectConversation();
      const qc = renderTab();
      await waitFor(() => expect(rows()).toHaveLength(3));

      answers[LIST_URL] = REFUSED;
      await qc.invalidateQueries({ queryKey: ['contacts', CONTACT_ID, 'conversations'] });

      expect(await screen.findByTestId('read-refusal')).toHaveAttribute(
        'data-refusal',
        'not-readable',
      );
      expect(rows()).toHaveLength(0);
    });

    it.each([
      ['500', SERVER_ERROR],
      ['403 with another code', () => new ApiError(403, { error: 'not-owner' })],
    ])(
      'ConversationHistory_ShouldKeepTheRowsAndTheControl_WhenANextPageAnswers %s',
      async (_n, err) => {
        const pages: Record<string, Answer> = { 1: contactSummaryFirstOfTwoPages, 2: err };
        servePages(pages);
        selectConversation();
        renderTab();

        fireEvent.click(await screen.findByTestId('history-more'));

        await waitFor(() => expect(requestsTo(LIST_URL).length).toBeGreaterThan(1));
        await waitFor(() => expect(screen.getByTestId('history-more')).toBeEnabled());
        expect(rows()).toHaveLength(2);
        expect(screen.queryByTestId('read-refusal')).toBeNull();
      },
    );

    it.each([
      ['500', SERVER_ERROR],
      ['403 with another code', () => new ApiError(403, { error: 'not-owner' })],
    ])('ConversationHistory_ShouldKeepTheRows_WhenARefetchAnswers %s', async (_n, err) => {
      const answers: Record<string, Answer> = { [LIST_URL]: contactSummaryPage };
      serve(answers);
      selectConversation();
      const qc = renderTab();
      await waitFor(() => expect(rows()).toHaveLength(3));

      answers[LIST_URL] = err;
      await qc.invalidateQueries({ queryKey: ['contacts', CONTACT_ID, 'conversations'] });

      await waitFor(() => expect(requestsTo(LIST_URL).length).toBeGreaterThan(1));
      expect(rows()).toHaveLength(3);
      expect(screen.queryByTestId('read-refusal')).toBeNull();
    });
  });

  describe('a 404 once the rows are on screen', () => {
    it('ConversationHistory_ShouldReplaceTheRowsWithTheEmptyText_WhenARefetchAnswers404', async () => {
      const answers: Record<string, Answer> = { [LIST_URL]: contactSummaryPage };
      serve(answers);
      selectConversation();
      const qc = renderTab();
      await waitFor(() => expect(rows()).toHaveLength(3));

      answers[LIST_URL] = NOT_FOUND;
      await qc.invalidateQueries({ queryKey: ['contacts', CONTACT_ID, 'conversations'] });

      await waitFor(() => expect(rows()).toHaveLength(0));
      expect(screen.getByText(enAgent.context.no_history)).toBeInTheDocument();
      expect(screen.queryByTestId('history-more')).toBeNull();
    });

    it('ConversationHistory_ShouldReplaceTheRowsWithTheEmptyText_WhenANextPageAnswers404', async () => {
      servePages({ 1: contactSummaryFirstOfTwoPages, 2: NOT_FOUND });
      selectConversation();
      renderTab();

      fireEvent.click(await screen.findByTestId('history-more'));

      await waitFor(() => expect(rows()).toHaveLength(0));
      expect(screen.getByText(enAgent.context.no_history)).toBeInTheDocument();
    });
  });

  // W14: the store holds `contactId: ''` for a fresh offer, so the tab reads it from the record.
  describe('a fresh offer', () => {
    it('ConversationHistory_ShouldShowTheRefusal_WhenAFreshOffersContactIsNotReadable', async () => {
      serve({ [RECORD_URL]: terminalConversation, [LIST_URL]: REFUSED });
      const entry = receiveFreshOffer();
      expect(entry?.contactId).toBe('');
      renderTab();

      expect(await screen.findByTestId('read-refusal')).toHaveAttribute(
        'data-refusal',
        'not-readable',
      );
      expect(requestsTo(RECORD_URL)).toHaveLength(1);
      expect(requestsTo(LIST_URL)).toHaveLength(1);
      expect(useConversationStore.getState().conversations[CONVERSATION_ID]).toEqual(entry);
    });

    it('ConversationHistory_ShouldShowTheRows_WhenAFreshOffersContactAnswers200', async () => {
      serve({ [RECORD_URL]: terminalConversation, [LIST_URL]: contactSummaryPage });
      const entry = receiveFreshOffer();
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(useConversationStore.getState().conversations[CONVERSATION_ID]).toEqual(entry);
    });

    it('ConversationHistory_ShouldShowTheRefusal_WhenTheRecordReadIsNotReadable', async () => {
      serve({ [RECORD_URL]: REFUSED });
      const entry = receiveFreshOffer();
      renderTab();

      expect(await screen.findByTestId('read-refusal')).toHaveAttribute(
        'data-refusal',
        'not-readable',
      );
      expect(requestsTo(LIST_URL)).toHaveLength(0);
      expect(useConversationStore.getState().conversations[CONVERSATION_ID]).toEqual(entry);
    });

    it('ConversationHistory_ShouldShowTheEmptyHistoryText_WhenTheRecordReadIsNotFound', async () => {
      serve({ [RECORD_URL]: NOT_FOUND });
      const entry = receiveFreshOffer();
      renderTab();

      expect(await screen.findByText(enAgent.context.no_history)).toBeInTheDocument();
      expect(screen.queryByTestId('read-refusal')).toBeNull();
      expect(requestsTo(LIST_URL)).toHaveLength(0);
      expect(useConversationStore.getState().conversations[CONVERSATION_ID]).toEqual(entry);
    });

    it('ConversationHistory_ShouldMakeNoRecordRead_WhenTheStoreAlreadyHasTheContactId', async () => {
      serve({ [LIST_URL]: contactSummaryPage });
      selectConversation();
      const entry = useConversationStore.getState().conversations[CONVERSATION_ID];
      renderTab();

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(requestsTo(RECORD_URL)).toHaveLength(0);
      expect(useConversationStore.getState().conversations[CONVERSATION_ID]).toEqual(entry);
    });

    it('ConversationHistory_ShouldReadNothing_WhenNoConversationIsSelected', async () => {
      renderTab();

      expect(await screen.findByText(enAgent.context.no_history)).toBeInTheDocument();
      expect(client.customFetch).not.toHaveBeenCalled();
    });
  });

  // Spec audit F1: the tab stays mounted while the agent presses Accept in the panel header, and
  // nothing else refetches a refused query that stays mounted.
  describe('accepting the offer', () => {
    it('ConversationHistory_ShouldShowTheRows_WhenTheOfferIsAcceptedWhileTheRefusalIsMounted', async () => {
      const answers: Record<string, Answer> = {
        [RECORD_URL]: terminalConversation,
        [LIST_URL]: REFUSED,
        [ACCEPT_URL]: undefined,
      };
      serve(answers);
      receiveFreshOffer();
      renderTab();
      await screen.findByTestId('read-refusal');
      expect(requestsTo(LIST_URL)).toHaveLength(1);

      answers[LIST_URL] = contactSummaryPage;
      fireEvent.click(screen.getByTestId('accept'));

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(screen.queryByTestId('read-refusal')).toBeNull();
      expect(requestsTo(ACCEPT_URL)).toHaveLength(1);
      expect(requestsTo(LIST_URL)).toHaveLength(2);
    });

    it('ConversationHistory_ShouldShowTheRows_WhenTheAcceptAlsoOpensARefusedRecordRead', async () => {
      const answers: Record<string, Answer> = {
        [RECORD_URL]: REFUSED,
        [LIST_URL]: contactSummaryPage,
        [ACCEPT_URL]: undefined,
      };
      serve(answers);
      receiveFreshOffer();
      renderTab();
      await screen.findByTestId('read-refusal');

      answers[RECORD_URL] = terminalConversation;
      fireEvent.click(screen.getByTestId('accept'));

      await waitFor(() => expect(rows()).toHaveLength(3));
      expect(screen.queryByTestId('read-refusal')).toBeNull();
    });
  });
});
