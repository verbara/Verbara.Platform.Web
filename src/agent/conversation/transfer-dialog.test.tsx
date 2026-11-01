/**
 * The digital transfer dialog through its real data path: the real hooks, the real `customFetch` and
 * the real conversation store, with msw answering the shapes of `contract-doubles`. The admin routes
 * answer too, with the same rows: an Agent gets a 403 there in production, but a row is what shows
 * the casing and label bugs of a dialog that still reads them, and the counter proves it does not.
 */
import type { ReactElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { server } from '@/test/msw-server';
import { createLocaleI18n, TEST_LOCALES, type TestLocale } from '@/test/locale-i18n';
import { useAuthStore } from '@/core/auth/auth-store';
import { useConversationStore, type Conversation } from '@/agent/stores/conversation-store';
import { normalizeStateToken } from '@/agent/inbox/agent-status-tokens';
import {
  agentStateValues,
  availableAgent,
  billingQueue,
  busyAgent,
  emptyTransferTargetAgentsPage,
  emptyTransferTargetQueuesPage,
  escalationsQueue,
  offlineAgent,
  onBreakAgent,
  transferTargetAgentsPage,
  transferTargetQueuesPage,
  transferToAgentWithNote,
  transferToQueueWithNote,
  transferWithOmittedNote,
  wrapUpAgent,
} from '@/tests/utils/contract-doubles';
import { TransferDialog } from './transfer-dialog';
import enAgent from '../../../public/locales/en-US/agent.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import ptAgent from '../../../public/locales/pt-BR/agent.json';
import enCommon from '../../../public/locales/en-US/common.json';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const AGENT_LOCALES = { 'en-US': enAgent, 'es-419': esAgent, 'pt-BR': ptAgent };
const CONVERSATION_ID = '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a';

const conversation: Conversation = {
  id: CONVERSATION_ID,
  contactId: 'contact-1',
  contactName: 'Ana',
  channel: 'WebChat',
  queueName: 'Support',
  state: 'active',
  lastMessage: '',
  lastMessageAt: '2026-10-30T15:00:00Z',
  unread: false,
  assignedAt: '2026-10-30T15:00:00Z',
};

type Answer = (url: URL) => Response;

let queueReads: URL[];
let agentReads: URL[];
let adminReads: string[];
let transferBodies: unknown[];
let answerQueues: Answer;
let answerAgents: Answer;
let answerTransfer: () => Response;
let holdQueues: Promise<void>;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  useConversationStore.setState({
    conversations: { [CONVERSATION_ID]: conversation },
    messages: {},
    selectedId: CONVERSATION_ID,
  });
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  queueReads = [];
  agentReads = [];
  adminReads = [];
  transferBodies = [];
  answerQueues = () => HttpResponse.json(transferTargetQueuesPage);
  answerAgents = () => HttpResponse.json(transferTargetAgentsPage);
  answerTransfer = () => HttpResponse.json({});
  holdQueues = Promise.resolve();
  server.use(
    http.get('/api/v1/transfer-targets/queues', async ({ request }) => {
      const url = new URL(request.url);
      queueReads.push(url);
      await holdQueues;
      return answerQueues(url);
    }),
    http.get('/api/v1/transfer-targets/agents', ({ request }) => {
      const url = new URL(request.url);
      agentReads.push(url);
      return answerAgents(url);
    }),
    http.get('/api/v1/admin/queues', () => {
      adminReads.push('queues');
      return HttpResponse.json(transferTargetQueuesPage);
    }),
    http.get('/api/v1/admin/agents', () => {
      adminReads.push('agents');
      return HttpResponse.json({
        items: transferTargetAgentsPage.items.map((a) => ({
          agentId: a.id,
          displayName: a.displayName,
          state: a.state,
        })),
      });
    }),
    http.post(`/api/v1/conversations/${CONVERSATION_ID}/transfer`, async ({ request }) => {
      transferBodies.push(await request.json());
      return answerTransfer();
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

async function renderDialog({
  lng = 'en-US',
  open = true,
}: { lng?: TestLocale; open?: boolean } = {}) {
  const i18n = await createLocaleI18n(lng);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const onOpenChange = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <TransferDialog open={open} onOpenChange={onOpenChange} conversationId={CONVERSATION_ID} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { onOpenChange, queryClient };
}

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function showAgents() {
  fireEvent.click(await screen.findByTestId('transfer-to-agent'));
  return screen.findByTestId(`transfer-item-${availableAgent.id}`);
}

function writeNote(text: string) {
  fireEvent.change(screen.getByTestId('transfer-note'), { target: { value: text } });
}

async function pickQueueAndSubmit(note?: string) {
  fireEvent.click(await screen.findByTestId(`transfer-item-${billingQueue.id}`));
  if (note !== undefined) writeNote(note);
  fireEvent.click(screen.getByTestId('transfer-submit'));
  await waitFor(() => expect(transferBodies).toHaveLength(1));
}

function toastedElement(): HTMLElement {
  const content = vi.mocked(toast.error).mock.calls.at(-1)?.[0] as ReactElement;
  render(<div data-testid="toast">{content}</div>);
  return screen.getByTestId('toast').firstElementChild as HTMLElement;
}

describe('TransferDialog note', () => {
  it('Submit_ShouldSendTheNote_WhenTheAgentWroteOneForAQueue', async () => {
    await renderDialog();
    await pickQueueAndSubmit(transferToQueueWithNote.note ?? '');
    expect(transferBodies[0]).toEqual({
      targetQueueId: transferToQueueWithNote.targetQueueId,
      note: transferToQueueWithNote.note,
    });
  });

  it('Submit_ShouldSendTheNote_WhenTheAgentWroteOneForAnAgent', async () => {
    await renderDialog();
    fireEvent.click(await showAgents());
    writeNote(transferToAgentWithNote.note ?? '');
    fireEvent.click(screen.getByTestId('transfer-submit'));
    await waitFor(() => expect(transferBodies).toHaveLength(1));
    expect(transferBodies[0]).toEqual({
      targetAgentId: transferToAgentWithNote.targetAgentId,
      note: transferToAgentWithNote.note,
    });
  });

  it('Submit_ShouldTrimTheNote_WhenItIsPadded', async () => {
    await renderDialog();
    await pickQueueAndSubmit('  \n Prefers Portuguese. \n  ');
    expect(transferBodies[0]).toMatchObject({ note: 'Prefers Portuguese.' });
  });

  it.each([
    ['absent', undefined],
    ['blank', '   \n  '],
  ])('Submit_ShouldLeaveNoteOut_WhenTheFieldIs_%s', async (_name, note) => {
    await renderDialog();
    fireEvent.click(await showAgents());
    if (note !== undefined) writeNote(note);
    fireEvent.click(screen.getByTestId('transfer-submit'));
    await waitFor(() => expect(transferBodies).toHaveLength(1));
    expect(transferBodies[0]).toEqual(transferWithOmittedNote);
    expect(transferBodies[0]).not.toHaveProperty('note');
  });

  it('NoteField_ShouldStopAt1000Characters', async () => {
    // jsdom does not apply `maxLength` to a programmatic change; the E2E types past it for real.
    await renderDialog();
    expect(await screen.findByTestId('transfer-note')).toHaveAttribute('maxlength', '1000');
  });

  it('Submit_ShouldCloseAndDropTheConversation_WithoutReadingTheBody', async () => {
    const { onOpenChange } = await renderDialog();
    await pickQueueAndSubmit('A note');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(useConversationStore.getState().conversations[CONVERSATION_ID]).toBeUndefined();
    // A second request about the note would have failed `onUnhandledRequest: 'error'`.
    expect(transferBodies).toHaveLength(1);
  });
});

describe('TransferDialog refusal', () => {
  it('Submit_ShouldShowTheLocalizedRefusalAndKeepTheConversation_WhenTheNoteIsRefused', async () => {
    answerTransfer = () => HttpResponse.json({ error: 'transfer-note-too-long' }, { status: 400 });
    const { onOpenChange } = await renderDialog();
    await pickQueueAndSubmit('A note');
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

    const element = toastedElement();
    expect(element).toHaveAttribute('data-error-code', 'transfer-note-too-long');
    expect(element.textContent).toBe(enCommon.errors.conversation.transfer_note_too_long);
    expect(useConversationStore.getState().conversations[CONVERSATION_ID]).toBeDefined();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('TransferDialog warm choice', () => {
  it('Render_ShouldOfferNoWarmOrColdControl', async () => {
    await renderDialog();
    await screen.findByTestId(`transfer-item-${billingQueue.id}`);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/^transfer\.(warm|cold)/)).toBeNull();
  });

  it.each(TEST_LOCALES)('Locale_ShouldHoldNoWarmOrColdKey (%s)', (lng) => {
    for (const key of ['cold', 'cold_description', 'warm', 'warm_description']) {
      expect(AGENT_LOCALES[lng].transfer).not.toHaveProperty(key);
    }
  });
});

describe('TransferDialog targets', () => {
  it('Open_ShouldListQueuesFromTheNewRouteOnly', async () => {
    const { queryClient } = await renderDialog();
    expect(await screen.findByTestId(`transfer-item-${billingQueue.id}`)).toHaveTextContent(
      billingQueue.name,
    );
    expect(screen.getByTestId(`transfer-item-${escalationsQueue.id}`)).toBeInTheDocument();
    expect(adminReads).toEqual([]);
    expect(queryClient.getQueryCache().find({ queryKey: ['queues'] })).toBeUndefined();
    expect(queryClient.getQueryCache().find({ queryKey: ['agents'] })).toBeUndefined();
  });

  it('Open_ShouldSendOnlyTheFixtureQuery_WhenThereIsNoTerm', async () => {
    await renderDialog();
    await screen.findByTestId(`transfer-item-${billingQueue.id}`);
    expect(Object.fromEntries(queueReads[0]!.searchParams)).toEqual({
      page: '1',
      pageSize: '100',
    });
  });

  it('ChooseAgent_ShouldListEachAgentWithItsState', async () => {
    await renderDialog();
    expect(await showAgents()).toHaveTextContent(availableAgent.displayName);
    expect(screen.getByTestId(`transfer-item-${offlineAgent.id}`)).toHaveAttribute(
      'data-agent-state',
      'Offline',
    );
    expect(adminReads).toEqual([]);
  });

  it('Closed_ShouldReadNothing', async () => {
    await renderDialog({ open: false });
    await settle();
    expect(queueReads).toEqual([]);
    expect(agentReads).toEqual([]);
    expect(adminReads).toEqual([]);
  });

  it('Open_ShouldReadOnlyTheKindOnView', async () => {
    await renderDialog();
    await screen.findByTestId(`transfer-item-${billingQueue.id}`);
    await settle();
    expect(queueReads).toHaveLength(1);
    expect(agentReads).toEqual([]);
  });

  it('Search_ShouldFindATargetPastTheFirstPage_ByAskingTheServer', async () => {
    answerQueues = (url) =>
      HttpResponse.json(
        url.searchParams.get('search') === 'bill'
          ? { ...transferTargetQueuesPage, items: [escalationsQueue] }
          : { ...transferTargetQueuesPage, items: [billingQueue] },
      );
    await renderDialog();
    await screen.findByTestId(`transfer-item-${billingQueue.id}`);
    fireEvent.change(screen.getByTestId('transfer-search'), { target: { value: 'bill' } });
    expect(await screen.findByTestId(`transfer-item-${escalationsQueue.id}`)).toBeInTheDocument();
    expect(Object.fromEntries(queueReads.at(-1)!.searchParams)).toEqual({
      search: 'bill',
      page: '1',
      pageSize: '100',
    });
  });

  it('Search_ShouldSendOneRead_WhenAWordIsTypedWithoutPausing', async () => {
    await renderDialog();
    await screen.findByTestId(`transfer-item-${billingQueue.id}`);
    for (const value of ['b', 'bi', 'bil', 'bill']) {
      fireEvent.change(screen.getByTestId('transfer-search'), { target: { value } });
    }
    await waitFor(() => expect(queueReads).toHaveLength(2));
    await settle();
    expect(queueReads.map((url) => url.searchParams.get('search'))).toEqual([null, 'bill']);
  });

  it('ChangeKind_ShouldNotCarryTheTerm_ToTheNewKind', async () => {
    await renderDialog();
    await screen.findByTestId(`transfer-item-${billingQueue.id}`);
    fireEvent.change(screen.getByTestId('transfer-search'), { target: { value: 'bill' } });
    await waitFor(() => expect(queueReads.at(-1)?.searchParams.get('search')).toBe('bill'));
    await showAgents();
    expect(agentReads.map((url) => url.searchParams.get('search'))).toEqual([null]);
  });

  it('EmptyAnswer_ShouldShowNoResults_OnlyOnceTheReadSettled', async () => {
    answerQueues = () => HttpResponse.json(emptyTransferTargetQueuesPage);
    let release = () => {};
    holdQueues = new Promise((resolve) => {
      release = resolve;
    });
    await renderDialog();
    await waitFor(() => expect(queueReads).toHaveLength(1));
    expect(screen.queryByText(enAgent.transfer.no_results)).toBeNull();
    release();
    expect(await screen.findByText(enAgent.transfer.no_results)).toBeInTheDocument();
  });

  it('EmptyAnswer_ShouldShowNoResults_ForTheAgentList', async () => {
    answerAgents = () => HttpResponse.json(emptyTransferTargetAgentsPage);
    await renderDialog();
    fireEvent.click(await screen.findByTestId('transfer-to-agent'));
    expect(await screen.findByText(enAgent.transfer.no_results)).toBeInTheDocument();
  });

  it('RefusedRead_ShouldShowNoResults_WhenTheAnswerIs403WithNoBody', async () => {
    answerQueues = () => new HttpResponse(null, { status: 403 });
    await renderDialog();
    expect(await screen.findByText(enAgent.transfer.no_results)).toBeInTheDocument();
  });

  it('RefusedRead_ShouldShowNoResultsAndNoProse_WhenTheTenantIsNotOperational', async () => {
    const detail = 'This tenant type cannot use this route.';
    answerQueues = () =>
      HttpResponse.json(
        {
          type: 'about:blank',
          title: 'Tenant type mismatch',
          status: 409,
          detail,
          tenantType: 'Partner',
          expectedType: 'Customer',
        },
        { status: 409 },
      );
    await renderDialog();
    expect(await screen.findByText(enAgent.transfer.no_results)).toBeInTheDocument();
    expect(screen.queryByText(detail)).toBeNull();
  });
});

describe('TransferDialog agent state', () => {
  it('BusyAgent_ShouldNotBeSelectable_EvenWhenItCanAcceptWork', async () => {
    await renderDialog();
    await showAgents();
    expect(busyAgent.canAcceptWork).toBe(true);
    const row = screen.getByTestId(`transfer-item-${busyAgent.id}`);
    expect(row).toBeDisabled();
    fireEvent.click(row);
    expect(screen.getByTestId('transfer-submit')).toBeDisabled();
  });

  it('AvailableAgent_ShouldBeSelectableAndShowTheAvailableColour', async () => {
    await renderDialog();
    const row = await showAgents();
    expect(row).toBeEnabled();
    expect(within(row).getByText(enAgent.agent_status.available)).toHaveClass('text-green-600');
    fireEvent.click(row);
    expect(screen.getByTestId('transfer-submit')).toBeEnabled();
  });

  it.each([
    ['ACW', wrapUpAgent],
    ['Offline', offlineAgent],
  ])('AgentIn_%s_ShouldStaySelectable', async (_state, agent) => {
    await renderDialog();
    await showAgents();
    expect(agent.canAcceptWork).toBe(false);
    expect(screen.getByTestId(`transfer-item-${agent.id}`)).toBeEnabled();
  });

  it('StateLabel_ShouldComeFromTheLocaleFile_InEs419', async () => {
    await renderDialog({ lng: 'es-419' });
    await showAgents();
    const row = screen.getByTestId(`transfer-item-${offlineAgent.id}`);
    expect(within(row).getByText(esAgent.agent_status.offline)).toBeInTheDocument();
    expect(within(row).queryByText('Offline')).toBeNull();
  });

  it('StateLabel_ShouldComeFromTheLocaleFile_ForTheBreakAuxStateInPtBr', async () => {
    answerAgents = () =>
      HttpResponse.json({ ...transferTargetAgentsPage, items: [availableAgent, onBreakAgent] });
    await renderDialog({ lng: 'pt-BR' });
    await showAgents();
    const row = screen.getByTestId(`transfer-item-${onBreakAgent.id}`);
    expect(within(row).getByText(ptAgent.agent_status.on_break)).toBeInTheDocument();
  });

  it.each(TEST_LOCALES)('StateLabel_ShouldExistForEveryStateValue (%s)', async (lng) => {
    const items = agentStateValues.map((state) => ({
      ...availableAgent,
      id: state === 'Available' ? availableAgent.id : state,
      state,
    }));
    answerAgents = () => HttpResponse.json({ ...transferTargetAgentsPage, items });
    await renderDialog({ lng });
    await showAgents();
    const labels = AGENT_LOCALES[lng].agent_status as Record<string, string>;
    for (const { id, state } of items) {
      const label = labels[normalizeStateToken(state)];
      expect(label).toBeTruthy();
      expect(within(screen.getByTestId(`transfer-item-${id}`)).getByText(label!)).toBeTruthy();
    }
  });
});
