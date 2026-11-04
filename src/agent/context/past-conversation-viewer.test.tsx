import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useConversationStore, type Conversation } from '@/agent/stores/conversation-store';
import { ApiError } from '@/core/api/api-error';
import * as client from '@/core/api/client';
import {
  closedContactSummary,
  contactSummaryPage,
  historyEmptyPage,
  historyFirstPage,
  historyNewestMessage,
  historyOlderPage,
  historyOldestMessage,
  historySecondMessage,
  invalidCursorRefusal,
  notReadableRefusal,
  terminalConversation,
  terminalConversationWithOfferMetadata,
} from '@/tests/utils/contract-doubles';
import enAgent from '../../../public/locales/en-US/agent.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import ptAgent from '../../../public/locales/pt-BR/agent.json';
import esCommon from '../../../public/locales/es-419/common.json';
import { ConversationHistory } from './conversation-history';

/**
 * The read-only viewer through the row that opens it (W5, W7, W9): the tab, the `React.lazy` boundary,
 * the `Sheet`, the hooks, the list and the bubbles are the real ones. Only `customFetch` is answered,
 * by URL and `before`, so a refusal travels the path it takes in the console.
 */

const { scene } = vi.hoisted(() => ({
  scene: { lng: 'en-US' as 'en-US' | 'es-419' | 'pt-BR' },
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('es-419');
  return {
    ...actual,
    useTranslation: () => ({
      t: i18n.getFixedT(scene.lng, 'agent'),
      i18n: { ...i18n, language: scene.lng, resolvedLanguage: scene.lng },
    }),
  };
});
vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

const SELECTED_ID = 'conv-1';
const VIEWED_ID = closedContactSummary.id;
const LIST_URL = `/api/v1/contacts/${terminalConversation.contactId}/conversations`;
const RECORD_URL = `/api/v1/conversations/${VIEWED_ID}`;
const HISTORY_URL = `${RECORD_URL}/history`;
const CURSOR = String(historyFirstPage.nextBefore);

const NEWEST_ID = String(historyNewestMessage.messageId);
const SECOND_ID = String(historySecondMessage.messageId);
const OLDEST_ID = String(historyOldestMessage.messageId);

const REFUSED = () => new ApiError(403, notReadableRefusal);
const NOT_FOUND = () => new ApiError(404, null);
const SERVER_ERROR = () => new ApiError(500, null);
const BAD_CURSOR = () => new ApiError(400, invalidCursorRefusal);
const OTHER_FORBIDDEN = () => new ApiError(403, { error: 'not-an-agent' });

type Answer = unknown | (() => unknown);

/** What each read answers now. Replace a member to change the answer of the next read. */
const answers: {
  list: Answer;
  record: Answer;
  firstPage: Answer;
  olderPage: Answer;
} = { list: null, record: null, firstPage: null, olderPage: null };

function resolve(answer: Answer) {
  const value = typeof answer === 'function' ? (answer as () => unknown)() : answer;
  if (value instanceof Error) throw value;
  return value;
}

function serve() {
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    if (config.method !== 'GET') throw new Error(`Unexpected write: ${config.url}`);
    if (config.url === LIST_URL) return resolve(answers.list);
    if (config.url === RECORD_URL) return resolve(answers.record);
    if (config.url === HISTORY_URL) {
      return resolve(config.params?.before === CURSOR ? answers.olderPage : answers.firstPage);
    }
    throw new Error(`Unexpected request: ${config.url}`);
  });
}

function historyRequests() {
  return vi.mocked(client.customFetch).mock.calls.filter(([c]) => c.url === HISTORY_URL);
}

function renderTab() {
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } },
  });
  render(
    <QueryClientProvider client={qc}>
      <ConversationHistory />
    </QueryClientProvider>,
  );
  return qc;
}

const rowOf = (id: string) => {
  const row = screen
    .queryAllByTestId('history-row')
    .find((r) => r.getAttribute('data-conversation-id') === id);
  if (!row) throw new Error(`No row for ${id}`);
  return row;
};

async function openViewer() {
  const qc = renderTab();
  await waitFor(() => rowOf(VIEWED_ID));
  fireEvent.click(rowOf(VIEWED_ID));
  await screen.findByTestId('history-viewer');
  return qc;
}

const shownMessageIds = () =>
  screen.queryAllByTestId('history-viewer-message').map((m) => m.getAttribute('data-message-id'));

const refusalShown = () => screen.findByTestId('read-refusal');

/**
 * Refetches, then lets the observers' notification reach the DOM: it is scheduled after the fetch
 * settles, so an assertion that nothing changed would otherwise read the screen before the answer.
 */
async function refetchAndSettle(qc: QueryClient, ...queryKeys: unknown[][]) {
  await act(async () => {
    await Promise.all(queryKeys.map((queryKey) => qc.invalidateQueries({ queryKey })));
    await new Promise((done) => setTimeout(done, 0));
  });
}

describe('PastConversationViewer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    scene.lng = 'en-US';
    answers.list = contactSummaryPage;
    answers.record = terminalConversation;
    answers.firstPage = historyFirstPage;
    answers.olderPage = historyOlderPage;
    serve();
    useConversationStore.setState({
      selectedId: SELECTED_ID,
      conversations: {
        [SELECTED_ID]: {
          id: SELECTED_ID,
          contactId: terminalConversation.contactId,
        } as Conversation,
      },
      messages: {},
    });
    // jsdom lays nothing out: the list needs a viewport to draw its rows.
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('header and transcript', () => {
    it('PastConversationViewer_ShouldShowTheHeaderOfTheFixture_WhenItOpensOnAClosedConversation', async () => {
      await openViewer();

      await waitFor(() => screen.getByTestId('history-viewer-state'));
      expect(screen.getByTestId('history-viewer')).toHaveAttribute('data-state', 'Closed');
      expect(screen.getByTestId('history-viewer-channel')).toHaveTextContent('WhatsApp');
      expect(screen.getByTestId('history-viewer-state')).toHaveTextContent(
        enAgent.history.states.closed,
      );
      expect(screen.getByTestId('history-viewer-closed-reason')).toHaveTextContent(
        enAgent.history.closed_reasons.inactivity,
      );
      expect(screen.getByTestId('history-viewer-created-at')).toHaveTextContent(
        format(parseISO(terminalConversation.createdAt), 'PPp', { locale: enUS }),
      );
      expect(screen.getByTestId('history-viewer-closed-at')).toHaveTextContent(
        format(parseISO(String(terminalConversation.closedAt)), 'PPp', { locale: enUS }),
      );
    });

    it.each(['Closed', 'Abandoned', 'Merged', 'Spam'] as const)(
      'PastConversationViewer_ShouldShowTheHeaderAndTheTranscript_WhenTheStateIs%s',
      async (state) => {
        answers.record = { ...terminalConversation, state };
        await openViewer();

        await waitFor(() =>
          expect(screen.getByTestId('history-viewer')).toHaveAttribute('data-state', state),
        );
        const key = state.toLowerCase() as 'closed' | 'abandoned' | 'merged' | 'spam';
        expect(screen.getByTestId('history-viewer-state')).toHaveTextContent(
          enAgent.history.states[key],
        );
        await waitFor(() => expect(shownMessageIds()).toEqual([SECOND_ID, NEWEST_ID]));
        expect(screen.queryByTestId('read-refusal')).not.toBeInTheDocument();
      },
    );

    it('PastConversationViewer_ShouldReadOnlyTheCloseReasonFromMetadata_WhenTheRecordCarriesOfferKeys', async () => {
      answers.record = terminalConversationWithOfferMetadata;
      await openViewer();

      await waitFor(() => screen.getByTestId('history-viewer-closed-reason'));
      const header = screen.getByRole('dialog').querySelector('[data-slot="sheet-header"]');
      const { _offeredTo, _offeredAt } = terminalConversationWithOfferMetadata.metadata ?? {};
      expect(header?.textContent).not.toContain(_offeredTo);
      expect(header?.textContent).not.toContain(_offeredAt);
      expect(header?.textContent).not.toContain('_offered');
    });

    it('PastConversationViewer_ShouldShowNoCloseCells_WhenTheRecordHasNeither', async () => {
      const { closedAt: _closedAt, metadata: _metadata, ...open } = terminalConversation;
      answers.record = { ...open, state: 'Active' };
      await openViewer();

      await waitFor(() => screen.getByTestId('history-viewer-state'));
      expect(screen.queryByTestId('history-viewer-closed-at')).not.toBeInTheDocument();
      expect(screen.queryByTestId('history-viewer-closed-reason')).not.toBeInTheDocument();
    });

    it('PastConversationViewer_ShouldShowTheOldestMessageOnTop_WhenTheFirstPageOfTheFixtureLoads', async () => {
      await openViewer();

      await waitFor(() => expect(shownMessageIds()).toEqual([SECOND_ID, NEWEST_ID]));
      const [first, second] = screen.getAllByTestId('history-viewer-message');
      expect(first).toHaveTextContent('My card was blocked after I reported it lost');
      expect(second).toHaveTextContent('Your replacement card has been ordered');
      expect(historyRequests()[0]?.[0].params).toBeUndefined();
    });

    it('PastConversationViewer_ShouldShowTheNoMessagesText_WhenThePageIsEmpty', async () => {
      answers.firstPage = historyEmptyPage;
      await openViewer();

      expect(await screen.findByTestId('history-viewer-empty')).toHaveTextContent(
        enAgent.history.viewer.no_messages,
      );
      expect(screen.queryByTestId('history-load-earlier')).not.toBeInTheDocument();
    });

    it('PastConversationViewer_ShouldKeepTheNoMessagesText_WhenARefetchOfTheEmptyPageFails', async () => {
      answers.firstPage = historyEmptyPage;
      const qc = await openViewer();
      await screen.findByTestId('history-viewer-empty');

      answers.firstPage = SERVER_ERROR;
      await refetchAndSettle(qc, ['messages', VIEWED_ID, 'history']);

      expect(qc.getQueryState(['messages', VIEWED_ID, 'history'])?.error).toBeInstanceOf(ApiError);
      expect(screen.getByTestId('history-viewer-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('read-refusal')).not.toBeInTheDocument();
    });

    it('PastConversationViewer_ShouldShowALoadingState_WhileTheTranscriptIsRead', async () => {
      answers.firstPage = () => new Promise(() => undefined);
      await openViewer();

      expect(screen.getByTestId('history-viewer-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('history-viewer-empty')).not.toBeInTheDocument();
    });
  });

  describe('read only', () => {
    it('PastConversationViewer_ShouldOfferOnlyCloseAndLoadEarlier_WhenItOpensOnAClosedConversation', async () => {
      await openViewer();
      await waitFor(() => expect(shownMessageIds()).toHaveLength(2));

      const dialog = screen.getByRole('dialog');
      expect(
        within(dialog)
          .getAllByRole('button')
          .map((b) => b.getAttribute('data-testid')),
      ).toEqual(['history-viewer-close', 'history-load-earlier']);
      expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
      expect(within(dialog).queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('PastConversationViewer_ShouldSendOnlyReads_WhenItOpensAndLoadsEarlier', async () => {
      await openViewer();
      fireEvent.click(await screen.findByTestId('history-load-earlier'));
      await waitFor(() => expect(shownMessageIds()).toHaveLength(3));

      const calls = vi.mocked(client.customFetch).mock.calls.map(([c]) => c);
      expect(new Set(calls.map((c) => c.method))).toEqual(new Set(['GET']));
      expect(new Set(calls.map((c) => c.url))).toEqual(
        new Set([LIST_URL, RECORD_URL, HISTORY_URL]),
      );
    });

    it('PastConversationViewer_ShouldLeaveTheStoreAndTheSelection_WhenItOpensAndCloses', async () => {
      const before = useConversationStore.getState();
      await openViewer();
      await waitFor(() => expect(shownMessageIds()).toHaveLength(2));

      const open = useConversationStore.getState();
      expect(open.selectedId).toBe(SELECTED_ID);
      expect(open.conversations).toBe(before.conversations);
      expect(open.messages).toBe(before.messages);

      fireEvent.click(screen.getByTestId('history-viewer-close'));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      const closed = useConversationStore.getState();
      expect(closed.selectedId).toBe(SELECTED_ID);
      expect(closed.conversations).toBe(before.conversations);
      expect(closed.messages).toBe(before.messages);
    });

    it('PastConversationViewer_ShouldNameEveryTextInTheAgentsLanguage_InEs419', async () => {
      scene.lng = 'es-419';
      await openViewer();
      await waitFor(() => expect(shownMessageIds()).toHaveLength(2));

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(esAgent.history.viewer.title)).toBeInTheDocument();
      expect(within(dialog).getByText(esAgent.history.viewer.created_at)).toBeInTheDocument();
      expect(within(dialog).getByText(esAgent.history.viewer.closed_at)).toBeInTheDocument();
      expect(screen.getByTestId('history-load-earlier')).toHaveTextContent(
        esAgent.history.viewer.load_earlier,
      );
      expect(screen.getByTestId('history-viewer-close')).toHaveAccessibleName(
        esCommon.actions.close,
      );
      expect(screen.getByTestId('history-viewer-state')).toHaveTextContent(
        esAgent.history.states.closed,
      );
    });

    it.each([
      ['en-US', enAgent],
      ['es-419', esAgent],
      ['pt-BR', ptAgent],
    ] as const)('PastConversationViewer_ShouldHaveTheViewerKeys_In%s', (_locale, agent) => {
      expect(Object.keys(agent.history.viewer).sort()).toEqual([
        'closed_at',
        'created_at',
        'load_earlier',
        'no_messages',
        'title',
      ]);
    });
  });

  describe('opening and closing with the tab', () => {
    it('PastConversationViewer_ShouldClose_WhenTheSelectionChanges', async () => {
      await openViewer();
      await waitFor(() => expect(shownMessageIds()).toHaveLength(2));

      act(() => {
        const other = {
          id: 'conv-2',
          contactId: terminalConversation.contactId,
        } as Conversation;
        useConversationStore.setState((s) => ({
          selectedId: other.id,
          conversations: { ...s.conversations, [other.id]: other },
        }));
      });
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      // Coming back to the conversation does not bring the viewer back.
      act(() => useConversationStore.setState({ selectedId: SELECTED_ID }));
      await waitFor(() => rowOf(VIEWED_ID));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('PastConversationViewer_ShouldClose_WhenTheListBehindItIsRefused', async () => {
      const qc = await openViewer();
      await waitFor(() => expect(shownMessageIds()).toHaveLength(2));

      answers.list = REFUSED;
      await act(() => qc.invalidateQueries({ queryKey: ['contacts'] }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(shownMessageIds()).toEqual([]);

      // The list readable again does not reopen it.
      answers.list = contactSummaryPage;
      await act(() => qc.invalidateQueries({ queryKey: ['contacts'] }));
      await waitFor(() => rowOf(VIEWED_ID));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('load earlier', () => {
    it('PastConversationViewer_ShouldSendTheCursorAndPlaceTheOlderMessageOnTop_WhenLoadEarlierIsChosen', async () => {
      await openViewer();

      fireEvent.click(await screen.findByTestId('history-load-earlier'));

      await waitFor(() => expect(shownMessageIds()).toEqual([OLDEST_ID, SECOND_ID, NEWEST_ID]));
      expect(historyRequests().at(-1)?.[0].params).toEqual({ before: 'opaque-cursor-value-1' });
      expect(screen.queryByTestId('history-load-earlier')).not.toBeInTheDocument();
    });

    it('PastConversationViewer_ShouldKeepTheMessagesAndHideTheControl_WhenTheCursorIsRefused', async () => {
      answers.olderPage = BAD_CURSOR;
      await openViewer();

      fireEvent.click(await screen.findByTestId('history-load-earlier'));

      expect(await refusalShown()).toHaveAttribute('data-refusal', 'invalid-cursor');
      expect(screen.getByTestId('read-refusal')).toHaveTextContent(
        enAgent.history.errors.invalid_cursor,
      );
      expect(shownMessageIds()).toEqual([SECOND_ID, NEWEST_ID]);
      expect(screen.queryByTestId('history-load-earlier')).not.toBeInTheDocument();
    });

    it.each([
      ['a server error', SERVER_ERROR, 'read-failed'],
      ['a 403 of another code', OTHER_FORBIDDEN, 'read-failed'],
    ])(
      'PastConversationViewer_ShouldKeepTheMessagesAndTheControl_WhenANextPageAnswers %s',
      async (_name, answer, refusal) => {
        answers.olderPage = answer;
        await openViewer();

        fireEvent.click(await screen.findByTestId('history-load-earlier'));

        expect(await refusalShown()).toHaveAttribute('data-refusal', refusal);
        expect(shownMessageIds()).toEqual([SECOND_ID, NEWEST_ID]);
        expect(screen.getByTestId('history-load-earlier')).toBeEnabled();
      },
    );

    it('PastConversationViewer_ShouldLoadOnRetry_WhenANextPageFailedOnce', async () => {
      answers.olderPage = SERVER_ERROR;
      await openViewer();
      fireEvent.click(await screen.findByTestId('history-load-earlier'));
      await refusalShown();

      answers.olderPage = historyOlderPage;
      fireEvent.click(screen.getByTestId('history-load-earlier'));

      await waitFor(() => expect(shownMessageIds()).toEqual([OLDEST_ID, SECOND_ID, NEWEST_ID]));
      expect(screen.queryByTestId('read-refusal')).not.toBeInTheDocument();
    });
  });

  describe('refusal and not-found states', () => {
    function expectRefusalAlone(
      refusal: HTMLElement,
      code: 'not-readable' | '404' = 'not-readable',
    ) {
      expect(refusal).toHaveAttribute('data-refusal', code);
      expect(refusal).toHaveTextContent(
        code === '404' ? enAgent.history.errors.not_found : enAgent.history.errors.not_readable,
      );
      expect(shownMessageIds()).toEqual([]);
      expect(screen.queryByTestId('history-viewer-state')).not.toBeInTheDocument();
      expect(screen.queryByTestId('history-viewer-created-at')).not.toBeInTheDocument();
      expect(screen.queryByTestId('history-load-earlier')).not.toBeInTheDocument();
    }

    it('PastConversationViewer_ShouldShowTheRefusalAndNoTranscript_WhenTheRecordIsNotReadable', async () => {
      answers.record = REFUSED;
      await openViewer();

      expectRefusalAlone(await refusalShown());
    });

    it('PastConversationViewer_ShouldShowTheRefusalAndNoHeader_WhenTheFirstPageIsNotReadable', async () => {
      answers.firstPage = REFUSED;
      await openViewer();

      expectRefusalAlone(await refusalShown());
    });

    it('PastConversationViewer_ShouldReplaceTheTranscript_WhenANextPageIsNotReadable', async () => {
      answers.olderPage = REFUSED;
      await openViewer();
      await waitFor(() => expect(shownMessageIds()).toHaveLength(2));

      fireEvent.click(screen.getByTestId('history-load-earlier'));

      expectRefusalAlone(await refusalShown());
    });

    it('PastConversationViewer_ShouldReplaceTheTranscript_WhenARefetchIsNotReadable', async () => {
      const qc = await openViewer();
      await waitFor(() => expect(shownMessageIds()).toHaveLength(2));

      answers.firstPage = REFUSED;
      await act(() => qc.invalidateQueries({ queryKey: ['messages', VIEWED_ID] }));

      expectRefusalAlone(await refusalShown());
    });

    it('PastConversationViewer_ShouldReplaceTheTranscript_WhenARefetchOfTheRecordIsNotReadable', async () => {
      const qc = await openViewer();
      await waitFor(() => expect(shownMessageIds()).toHaveLength(2));
      await screen.findByTestId('history-viewer-state');

      answers.record = REFUSED;
      await act(() => qc.invalidateQueries({ queryKey: ['conversations', VIEWED_ID] }));

      expectRefusalAlone(await refusalShown());
    });

    it.each([
      ['a server error', SERVER_ERROR],
      ['a 403 of another code', OTHER_FORBIDDEN],
    ])(
      'PastConversationViewer_ShouldKeepTheTranscript_WhenARefetchAnswers %s',
      async (_name, answer) => {
        const qc = await openViewer();
        await waitFor(() => expect(shownMessageIds()).toHaveLength(2));
        await screen.findByTestId('history-viewer-state');

        answers.firstPage = answer;
        answers.record = answer;
        await refetchAndSettle(
          qc,
          ['messages', VIEWED_ID, 'history'],
          ['conversations', VIEWED_ID],
        );

        expect(qc.getQueryState(['messages', VIEWED_ID, 'history'])?.error).toBeInstanceOf(
          ApiError,
        );
        expect(qc.getQueryState(['conversations', VIEWED_ID])?.error).toBeInstanceOf(ApiError);
        expect(shownMessageIds()).toEqual([SECOND_ID, NEWEST_ID]);
        expect(screen.getByTestId('history-viewer-state')).toBeInTheDocument();
        expect(screen.queryByTestId('read-refusal')).not.toBeInTheDocument();
      },
    );

    it('PastConversationViewer_ShouldShowNotFoundAlone_WhenANextPageAnswers404', async () => {
      answers.olderPage = NOT_FOUND;
      await openViewer();

      fireEvent.click(await screen.findByTestId('history-load-earlier'));

      expectRefusalAlone(await refusalShown(), '404');
    });

    it.each([
      ['the record', ['conversations', VIEWED_ID], 'record' as const],
      ['the transcript', ['messages', VIEWED_ID, 'history'], 'firstPage' as const],
    ])(
      'PastConversationViewer_ShouldShowNotFoundAlone_WhenARefetchOf %s answers 404',
      async (_name, queryKey, read) => {
        const qc = await openViewer();
        await waitFor(() => expect(shownMessageIds()).toHaveLength(2));
        await screen.findByTestId('history-viewer-state');

        answers[read] = NOT_FOUND;
        await refetchAndSettle(qc, queryKey);

        expectRefusalAlone(await refusalShown(), '404');
      },
    );

    it.each([
      ['the record', 'record' as const],
      ['the first page', 'firstPage' as const],
    ])('PastConversationViewer_ShouldShowNotFound_When %s answers 404', async (_name, read) => {
      answers[read] = NOT_FOUND;
      await openViewer();

      const refusal = await refusalShown();
      expect(refusal).toHaveAttribute('data-refusal', '404');
      expect(refusal).toHaveTextContent(enAgent.history.errors.not_found);
      expect(shownMessageIds()).toEqual([]);
    });

    it.each([
      ['the record', 'record' as const],
      ['the first page', 'firstPage' as const],
    ])(
      'PastConversationViewer_ShouldShowTheGenericMessage_When %s fails otherwise',
      async (_name, read) => {
        answers[read] = SERVER_ERROR;
        await openViewer();

        expect(await refusalShown()).toHaveAttribute('data-refusal', 'read-failed');
        expect(shownMessageIds()).toEqual([]);
      },
    );

    it('PastConversationViewer_ShouldNeverShowTheServersText_WhenItRefuses', async () => {
      answers.record = () =>
        new ApiError(403, { ...notReadableRefusal, message: 'Tenant demo row 42' });
      await openViewer();

      expect((await refusalShown()).textContent).not.toContain('Tenant demo row 42');
    });
  });
});
