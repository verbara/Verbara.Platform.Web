import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationStore, type Conversation } from '@/agent/stores/conversation-store';
import { ApiError } from '@/core/api/api-error';
import * as client from '@/core/api/client';
import { mapPlatformContact } from '@/core/api/platform-conversation';
import {
  closedContactSummary,
  contactAnonymous,
  contactLevelOne,
  contactLevelTwo,
  contactSummaryPage,
  contactWithoutWebChat,
  heldContactSummary,
  historyFirstPage,
  notReadableRefusal,
  terminalConversation,
} from '@/tests/utils/contract-doubles';
import esAgent from '../../../public/locales/es-419/agent.json';
import { ConversationHistory } from './conversation-history';

/**
 * The mark on the History rows and in the viewer opened from one (W7, W12, spec audit of 2026-11-05 F1): the
 * rows and the transcript do not wait for the contact read, so "no answer yet" keeps the warning on them and
 * only a successful read can remove it. The hooks are real, and only `customFetch` is answered, by URL.
 */

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('es-419');
  return {
    ...actual,
    useTranslation: () => ({
      t: i18n.getFixedT('es-419', 'agent'),
      i18n: { ...i18n, language: 'es-419', resolvedLanguage: 'es-419' },
    }),
  };
});
vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

const SELECTED_ID = 'conv-1';
const VIEWED_ID = closedContactSummary.id;
const CONTACT_ID = contactLevelOne.contactId;
const CONTACT_URL = `/api/v1/contacts/${CONTACT_ID}`;
const LIST_URL = `${CONTACT_URL}/conversations`;
const SELECTED_RECORD_URL = `/api/v1/conversations/${SELECTED_ID}`;
const VIEWED_RECORD_URL = `/api/v1/conversations/${VIEWED_ID}`;

/** What the contact read and the viewed record's read answer now: an `Error` is thrown, a promise awaited. */
const answers: { contact: unknown; viewedRecord: unknown } = { contact: null, viewedRecord: null };

function serve() {
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const answerOf = (value: unknown) => {
      if (value instanceof Error) throw value;
      return value;
    };
    switch (config.url) {
      case CONTACT_URL:
        return answerOf(answers.contact);
      case LIST_URL:
        return contactSummaryPage;
      case SELECTED_RECORD_URL:
        return { ...terminalConversation, contactId: CONTACT_ID };
      case VIEWED_RECORD_URL:
        return answerOf(answers.viewedRecord);
      case `${VIEWED_RECORD_URL}/history`:
        return historyFirstPage;
      default:
        throw new Error(`Unexpected request: ${config.url}`);
    }
  });
}

function select(contactId: string = CONTACT_ID) {
  useConversationStore.setState({
    selectedId: SELECTED_ID,
    conversations: { [SELECTED_ID]: { id: SELECTED_ID, contactId } as Conversation },
  });
}

function renderTab(seed?: (qc: QueryClient) => void) {
  const qc = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: false } },
  });
  seed?.(qc);
  render(
    <QueryClientProvider client={qc}>
      <ConversationHistory />
    </QueryClientProvider>,
  );
  return qc;
}

const rows = () => screen.queryAllByTestId('history-row');
const rowOf = (id: string) => {
  const row = rows().find((r) => r.getAttribute('data-conversation-id') === id);
  if (!row) throw new Error(`No row for ${id}`);
  return row;
};
const levelsIn = (element: Element) =>
  Array.from(element.querySelectorAll('[data-identity-level]')).map((mark) =>
    mark.getAttribute('data-identity-level'),
  );
const allLevels = () => levelsIn(document.body);

async function rowsShown() {
  await waitFor(() => expect(rows()).toHaveLength(contactSummaryPage.items.length));
}

async function openViewer() {
  await rowsShown();
  fireEvent.click(rowOf(VIEWED_ID));
  return screen.findByTestId('history-viewer');
}

/** Every row and the viewer carry exactly `level`: one mark each, nothing else on the page. */
function expectEveryRowAndTheViewerToCarry(level: string, viewer: HTMLElement) {
  for (const row of rows()) expect(levelsIn(row)).toEqual([level]);
  expect(levelsIn(viewer)).toEqual([level]);
  expect(allLevels()).toHaveLength(rows().length + 1);
}

describe('the identity mark on the History rows and in the viewer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    answers.contact = contactLevelOne;
    answers.viewedRecord = terminalConversation;
    useConversationStore.setState({ selectedId: null, conversations: {} });
    serve();
  });

  afterEach(() => {
    cleanup();
  });

  describe('a contact read that answered', () => {
    it.each([
      ['Unverified', contactLevelOne, esAgent.identity.unverified_hint],
      ['Verified', contactLevelTwo, esAgent.identity.verified_hint],
    ])(
      'HistoryAndViewer_ShouldCarryTheMark_WithALocaleName_WhenTheLevelIs %s',
      async (level, contact, hint) => {
        answers.contact = contact;
        select();
        const qc = renderTab();
        await waitFor(() =>
          expect(qc.getQueryState(['contacts', CONTACT_ID])?.status).toBe('success'),
        );

        const viewer = await openViewer();

        await waitFor(() => expectEveryRowAndTheViewerToCarry(level, viewer));
        for (const mark of within(viewer).getAllByRole('img', { name: hint })) {
          expect(mark).toHaveAttribute('data-identity-level', level);
        }
        const rowMark = rowOf(VIEWED_ID).querySelector('[data-identity-level]');
        expect(rowMark).toHaveAccessibleName(hint);
      },
    );

    it.each([
      ['Anonymous', contactAnonymous],
      ['absent', contactWithoutWebChat],
    ])('HistoryAndViewer_ShouldShowNoMark_WhenTheLevelIs %s', async (_level, contact) => {
      answers.contact = contact;
      select();
      const qc = renderTab();
      await waitFor(() =>
        expect(qc.getQueryState(['contacts', CONTACT_ID])?.status).toBe('success'),
      );

      const viewer = await openViewer();

      await waitFor(() => expect(allLevels()).toHaveLength(0));
      expect(levelsIn(viewer)).toHaveLength(0);
    });

    it.each([
      ['Anonymous', contactAnonymous],
      ['absent', contactWithoutWebChat],
    ])(
      'History_ShouldNeverFlashAMark_WhenTheContactIsCachedAsLevel %s',
      async (_level, contact) => {
        select();
        const seen: (string | null)[] = [];
        const observer = new MutationObserver(() => seen.push(...allLevels()));
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });

        renderTab((qc) => qc.setQueryData(['contacts', CONTACT_ID], mapPlatformContact(contact)));
        seen.push(...allLevels());
        await rowsShown();
        fireEvent.click(rowOf(VIEWED_ID));
        await screen.findByTestId('history-viewer');
        seen.push(...allLevels());
        observer.disconnect();

        expect(seen).toEqual([]);
      },
    );

    it('History_ShouldKeepTheLastAnswer_WhenARefreshOfTheContactFails', async () => {
      answers.contact = contactLevelTwo;
      select();
      const qc = renderTab();
      await rowsShown();
      await waitFor(() => expect(levelsIn(rowOf(VIEWED_ID))).toEqual(['Verified']));

      answers.contact = new ApiError(500, null);
      await act(async () => {
        await qc.invalidateQueries({ queryKey: ['contacts', CONTACT_ID], exact: true });
      });

      expect(qc.getQueryState(['contacts', CONTACT_ID])?.status).toBe('error');
      await act(async () => {});
      expect(levelsIn(rowOf(VIEWED_ID))).toEqual(['Verified']);
    });

    it('History_ShouldReadTheContactOfTheRecord_WhenTheStoreHoldsNoContactId', async () => {
      select('');
      renderTab();

      await rowsShown();

      await waitFor(() =>
        expect(vi.mocked(client.customFetch).mock.calls.map(([c]) => c.url)).toContain(CONTACT_URL),
      );
      await waitFor(() => expect(levelsIn(rowOf(VIEWED_ID))).toEqual(['Unverified']));
    });

    it('Viewer_ShouldAddNoContactRequest_WhenItOpens', async () => {
      select();
      renderTab();
      const viewer = await openViewer();
      await waitFor(() => expectEveryRowAndTheViewerToCarry('Unverified', viewer));

      const contactReads = vi
        .mocked(client.customFetch)
        .mock.calls.filter(([config]) => config.url === CONTACT_URL);
      expect(contactReads).toHaveLength(1);
    });
  });

  describe('where the mark sits', () => {
    it('RowMark_ShouldBeSpansOnly_WithNothingInteractive', async () => {
      select();
      renderTab();
      await rowsShown();
      await waitFor(() => expect(levelsIn(rowOf(VIEWED_ID))).toEqual(['Unverified']));

      const row = rowOf(VIEWED_ID);
      const mark = row.querySelector('[data-identity-level]');
      expect(row.tagName).toBe('BUTTON');
      expect(mark?.tagName).toBe('SPAN');
      expect(mark).not.toHaveAttribute('tabindex');
      expect(mark?.querySelector('button, a, [tabindex], [role="button"]')).toBeNull();
      expect(mark?.querySelector('div, p')).toBeNull();
    });

    it('HeldRow_ShouldCarryTheMarkToo', async () => {
      select();
      renderTab();
      await rowsShown();

      await waitFor(() => expect(levelsIn(rowOf(heldContactSummary.id))).toEqual(['Unverified']));
      expect(rowOf(heldContactSummary.id).tagName).toBe('DIV');
    });

    it.each([
      ['refused', () => new ApiError(403, notReadableRefusal)],
      ['failed', () => new ApiError(500, null)],
    ])('Viewer_ShouldKeepTheMark_WhenItsRecordIs %s', async (_name, failure) => {
      answers.viewedRecord = failure();
      select();
      renderTab();

      const viewer = await openViewer();

      await within(viewer).findByTestId('read-refusal');
      expect(levelsIn(viewer)).toEqual(['Unverified']);
    });
  });

  describe('a contact read with no answer', () => {
    function pendingContact() {
      let answer: (body: unknown) => void = () => undefined;
      answers.contact = new Promise((resolve) => {
        answer = resolve;
      });
      return (body: unknown) => answer(body);
    }

    it('HistoryAndViewer_ShouldCarryTheWarning_WhileTheReadIsPending', async () => {
      pendingContact();
      select();
      const qc = renderTab();

      const viewer = await openViewer();

      expect(qc.getQueryState(['contacts', CONTACT_ID])?.status).toBe('pending');
      expect(screen.queryByTestId('history-loading')).not.toBeInTheDocument();
      expectEveryRowAndTheViewerToCarry('Unverified', viewer);
      expect(rowOf(VIEWED_ID).querySelector('[data-identity-level]')).toHaveAccessibleName(
        esAgent.identity.unverified_hint,
      );
    });

    it.each([
      ['a server error', () => new ApiError(500, null)],
      ['a refusal', () => new ApiError(403, notReadableRefusal)],
    ])(
      'HistoryAndViewer_ShouldCarryTheWarning_AndNoFailureScreen_WhenTheReadFailsWith %s',
      async (_name, failure) => {
        answers.contact = failure();
        select();
        const qc = renderTab();
        await waitFor(() =>
          expect(qc.getQueryState(['contacts', CONTACT_ID])?.status).toBe('error'),
        );

        const viewer = await openViewer();

        expect(screen.queryByTestId('read-refusal')).not.toBeInTheDocument();
        expectEveryRowAndTheViewerToCarry('Unverified', viewer);
      },
    );

    it.each([
      ['Anonymous', contactAnonymous],
      ['absent', contactWithoutWebChat],
    ])('PendingThenAnswer_ShouldLeaveNoMark_WhenTheLevelIs %s', async (_level, contact) => {
      const answer = pendingContact();
      select();
      renderTab();
      const viewer = await openViewer();
      expectEveryRowAndTheViewerToCarry('Unverified', viewer);

      await act(async () => answer(contact));

      await waitFor(() => expect(allLevels()).toEqual([]));
    });

    it('PendingThenAnswer_ShouldLeaveOnlyVerified_WhenTheLevelIsVerified', async () => {
      const answer = pendingContact();
      select();
      renderTab();
      const viewer = await openViewer();
      expectEveryRowAndTheViewerToCarry('Unverified', viewer);

      await act(async () => answer(contactLevelTwo));

      await waitFor(() => expectEveryRowAndTheViewerToCarry('Verified', viewer));
      expect(allLevels()).not.toContain('Unverified');
    });
  });
});
