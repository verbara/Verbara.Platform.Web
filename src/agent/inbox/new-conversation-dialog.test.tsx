/**
 * The agent's new-conversation dialog searches `GET /api/v1/contacts`, which answers Platform's
 * `PagedResult<Contact>` (ContactEndpoints): each item is the raw `Contact` record — `contactId`,
 * `firstName`, `lastName`, `addresses[{ channel: 'WhatsApp', address }]` — with no `id`. Before
 * 3.21.0-web the options read `id`, so every option was `new-conv-contact-option-undefined` and the
 * create request carried no `contactId`; Platform answered 400 "Value cannot be null" (LAB-W1 N16).
 * Real hooks, real `customFetch`, msw answering as Platform v2.25.0+.
 *
 * Platform 2.28.0 (agent-started conversations): a start sends `initialMessage` (the queued path
 * without one is deprecated), WhatsApp may name a template, a refusal is a `ConversationStartRefusal`
 * whose machine code the dialog shows inline with `data-error-code`, and a 201 opens the conversation.
 *
 * Change `agent-console-contract-debt`: the channels come from `GET /api/v1/channels/available`, never
 * from a fixed list, and only a read that stands offers anything. A refresh that fails takes the
 * cached list away with it.
 */
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import type { components } from '@/core/api/generated/openapi';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import { createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import {
  availableChannels,
  channelTypeValues,
  everyChannelListed,
  messengerChannels,
  noAvailableChannels,
  smsThenWebChatChannels,
  webChatOnlyChannels,
  whatsAppOnlyChannels,
} from '@/tests/utils/contract-doubles';
import { NewConversationDialog } from './new-conversation-dialog';
import enAgent from '../../../public/locales/en-US/agent.json';
import enCommon from '../../../public/locales/en-US/common.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import esCommon from '../../../public/locales/es-419/common.json';

const CONTACT_ID = '1a2b3c4d5e6f4a7b8c9d0e1f2a3b4c5d';

const platformContact: components['schemas']['Contact'] = {
  contactId: CONTACT_ID,
  tenantId: 'tenant-1',
  firstName: 'Ana',
  lastName: 'Pérez',
  company: null,
  segment: null,
  preferredChannel: 'WhatsApp',
  preferredLanguage: null,
  timezone: null,
  doNotContact: false,
  addresses: [{ channel: 'WhatsApp', address: '+573001234567' }],
  customFields: null,
  channelConsent: null,
  createdAt: '2026-10-04T10:00:00+00:00',
  updatedAt: null,
  createdBy: null,
  updatedBy: null,
  fullName: 'Ana Pérez',
};

async function createAgentI18n() {
  const instance = i18next.createInstance();
  await instance.init({
    lng: 'en-US',
    fallbackLng: false,
    resources: { 'en-US': { agent: enAgent, common: enCommon } },
    ns: ['agent', 'common'],
    defaultNS: 'agent',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}

const CONVERSATION_ID = '9f8e7d6c5b4a4f3e2d1c0b9a8f7e6d5c';

function createdConversation(id = CONVERSATION_ID): components['schemas']['Conversation'] {
  return {
    conversationId: id,
    tenantId: 'tenant-1',
    contactId: CONTACT_ID,
    channel: 'WhatsApp',
    state: 'Active',
    createdAt: '2026-10-11T10:00:00+00:00',
  } as components['schemas']['Conversation'];
}

type StartAnswer = { status: number; body: unknown };

/** What the channels route answers; the promise holds it open, to observe a read in flight. */
type ChannelsAnswer = { status: number; body: unknown; hold?: Promise<void> };

let createBodies: unknown[] = [];
let startAnswer: StartAnswer;
let channelsAnswer: ChannelsAnswer;
let channelReads = 0;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  createBodies = [];
  startAnswer = { status: 201, body: createdConversation() };
  channelsAnswer = { status: 200, body: availableChannels };
  channelReads = 0;
  server.use(
    http.get('/api/v1/channels/available', async () => {
      channelReads += 1;
      const { status, body, hold } = channelsAnswer;
      await hold;
      return HttpResponse.json(body as object, { status });
    }),
    http.get('/api/v1/contacts', () =>
      HttpResponse.json({ items: [platformContact], totalCount: 1, page: 1, pageSize: 20 }),
    ),
    http.post('/api/v1/conversations', async ({ request }) => {
      createBodies.push(await request.json());
      return HttpResponse.json(startAnswer.body as object, { status: startAnswer.status });
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

function OpenedConversation() {
  const { id } = useParams();
  return <div data-testid="opened-conversation" data-id={id} />;
}

function MonitorStub() {
  const location = useLocation();
  return <div data-testid="monitor-stub" data-search={location.search} />;
}

async function renderDialog(onOpenChange: (open: boolean) => void = () => undefined) {
  const i18n = await createAgentI18n();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/agent']}>
          <Routes>
            <Route
              path="/agent"
              element={<NewConversationDialog open onOpenChange={onOpenChange} />}
            />
            <Route path="/agent/conversation/:id" element={<OpenedConversation />} />
            <Route path="/operations/monitor" element={<MonitorStub />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByTestId('new-conv-contact-search'), {
    target: { value: 'Ana' },
  });
}

async function pickContactAndType(message = 'Hola Ana') {
  await fillContactAndMessage(message);
  // The start needs a channel, and the list answers on its own request.
  await waitFor(() => expect(channelTrigger()).toBeEnabled());
}

async function fillContactAndMessage(message = 'Hola Ana') {
  const form = screen.getByTestId('new-conversation-form');
  fireEvent.click(await within(form).findByText('Ana Pérez'));
  fireEvent.change(screen.getByTestId('new-conv-message-input'), { target: { value: message } });
}

function channelTrigger() {
  return screen.getByTestId('new-conv-channel-select');
}

/** The text the closed channel field shows, without its icon. */
function selectedChannelText() {
  return channelTrigger().querySelector('[data-slot="select-value"]')?.textContent;
}

async function offeredChannels() {
  fireEvent.click(channelTrigger());
  const options = await screen.findAllByRole('option');
  return options.map((o) => ({ testId: o.getAttribute('data-testid'), label: o.textContent }));
}

/** A press starts on the option, as a real click does: base-ui ignores any other click. */
async function pickChannel(channel: string) {
  fireEvent.click(channelTrigger());
  await chooseOpenOption(channel);
}

async function chooseOpenOption(channel: string) {
  const option = await screen.findByTestId(`new-conv-channel-option-${channel}`);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

function ReopenableDialog({ startOpen }: Readonly<{ startOpen: boolean }>) {
  const [open, setOpen] = useState(startOpen);
  return (
    <>
      <button type="button" data-testid="reopen" onClick={() => setOpen(true)} />
      <NewConversationDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Mounts the dialog behind a real open state, with the client at hand to refresh the list. */
async function renderReopenable({
  lng = 'en-US',
  startOpen = true,
}: { lng?: TestLocale; startOpen?: boolean } = {}) {
  const i18n = await createLocaleI18n(lng);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/agent']}>
          <Routes>
            <Route path="/agent" element={<ReopenableDialog startOpen={startOpen} />} />
            <Route path="/agent/conversation/:id" element={<OpenedConversation />} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return queryClient;
}

async function searchContact() {
  fireEvent.change(await screen.findByTestId('new-conv-contact-search'), {
    target: { value: 'Ana' },
  });
}

function closeDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
}

function reopenDialog() {
  fireEvent.click(screen.getByTestId('reopen'));
}

function refreshChannels(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ['available-channels'] });
}

/** A held answer, released by the test. */
function deferred() {
  let release: () => void = () => undefined;
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { hold, release };
}

async function submitAndAwaitRefusal(code: string): Promise<HTMLElement> {
  fireEvent.click(screen.getByTestId('new-conv-submit-btn'));
  return waitFor(() => {
    const el = screen.getByTestId('new-conv-error');
    expect(el).toHaveAttribute('data-error-code', code);
    return el;
  });
}

describe('NewConversationDialog with Platform contacts', () => {
  it('NewConversationDialog_ShouldKeyEachContactOptionByPlatformContactId_WhenSearchAnswers', async () => {
    await renderDialog();

    expect(await screen.findByTestId(`new-conv-contact-option-${CONTACT_ID}`)).toBeInTheDocument();
    expect(screen.queryByTestId('new-conv-contact-option-undefined')).toBeNull();
  });

  it('NewConversationDialog_ShouldNameTheContactsChannelThroughTheKeyedSet_WhenTheConsoleIsInSpanish', async () => {
    server.use(
      http.get('/api/v1/contacts', () =>
        HttpResponse.json({
          items: [
            { ...platformContact, addresses: [{ channel: 'WebChat', address: 'visitor-3f9a' }] },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 20,
        }),
      ),
    );
    await renderReopenable({ lng: 'es-419' });
    await searchContact();

    const option = await screen.findByTestId(`new-conv-contact-option-${CONTACT_ID}`);
    expect(option).toHaveTextContent(`${esCommon.channels.webchat} · visitor-3f9a`);
  });

  it('NewConversationDialog_ShouldSendThePlatformContactIdAndTheMessage_WhenConversationCreated', async () => {
    await renderDialog();
    await pickContactAndType('  Hola Ana  ');

    fireEvent.click(screen.getByTestId('new-conv-submit-btn'));

    await waitFor(() => expect(createBodies).toHaveLength(1));
    expect(createBodies[0]).toEqual({
      contactId: CONTACT_ID,
      channel: 'WhatsApp',
      initialMessage: 'Hola Ana',
    });
  });
});

describe('NewConversationDialog start (Platform 2.28.0)', () => {
  it('NewConversationDialog_ShouldKeepSubmitDisabled_WhenTheInitialMessageIsBlank', async () => {
    await renderDialog();
    await pickContactAndType('   ');

    expect(screen.getByTestId('new-conv-submit-btn')).toBeDisabled();
    fireEvent.submit(screen.getByTestId('new-conversation-form'));
    await new Promise((r) => setTimeout(r, 20));
    expect(createBodies).toHaveLength(0);
  });

  it('NewConversationDialog_ShouldSendTheTemplateWithTheDefaultLanguage_WhenAWhatsAppTemplateIsNamed', async () => {
    await renderDialog();
    await pickContactAndType();

    fireEvent.click(screen.getByTestId('new-conv-template-toggle'));
    expect(screen.getByTestId('new-conv-template-language')).toHaveValue('en_US');
    fireEvent.change(screen.getByTestId('new-conv-template-name'), {
      target: { value: ' hello_world ' },
    });
    fireEvent.click(screen.getByTestId('new-conv-submit-btn'));

    await waitFor(() => expect(createBodies).toHaveLength(1));
    expect(createBodies[0]).toEqual({
      contactId: CONTACT_ID,
      channel: 'WhatsApp',
      initialMessage: 'Hola Ana',
      templateName: 'hello_world',
      templateLanguage: 'en_US',
    });
  });

  it('NewConversationDialog_ShouldSendTheChosenTemplateLanguage_WhenTheAgentChangesIt', async () => {
    await renderDialog();
    await pickContactAndType();

    fireEvent.click(screen.getByTestId('new-conv-template-toggle'));
    fireEvent.change(screen.getByTestId('new-conv-template-name'), {
      target: { value: 'bienvenida' },
    });
    fireEvent.change(screen.getByTestId('new-conv-template-language'), {
      target: { value: 'es_MX' },
    });
    fireEvent.click(screen.getByTestId('new-conv-submit-btn'));

    await waitFor(() => expect(createBodies).toHaveLength(1));
    expect(createBodies[0]).toMatchObject({
      templateName: 'bienvenida',
      templateLanguage: 'es_MX',
    });
  });

  it('NewConversationDialog_ShouldSendNoTemplateFields_WhenTheTemplateNameIsBlank', async () => {
    await renderDialog();
    await pickContactAndType();

    fireEvent.click(screen.getByTestId('new-conv-template-toggle'));
    fireEvent.click(screen.getByTestId('new-conv-submit-btn'));

    await waitFor(() => expect(createBodies).toHaveLength(1));
    expect(createBodies[0]).not.toHaveProperty('templateName');
    expect(createBodies[0]).not.toHaveProperty('templateLanguage');
  });

  it('NewConversationDialog_ShouldOpenTheConversationAndClose_WhenPlatformAnswers201', async () => {
    const onOpenChange = vi.fn();
    await renderDialog(onOpenChange);
    await pickContactAndType();

    fireEvent.click(screen.getByTestId('new-conv-submit-btn'));

    const opened = await screen.findByTestId('opened-conversation');
    expect(opened).toHaveAttribute('data-id', CONVERSATION_ID);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each([
    [400, 'unknown-channel'],
    [400, 'contact-has-no-address'],
    [409, 'channel-not-available'],
    [409, 'agent-at-capacity'],
    [502, 'channel-send-failed'],
    [500, 'start-persist-failed'],
  ] as const)(
    'NewConversationDialog_ShouldShowTheRefusalInlineAndStayOpen_WhenPlatformAnswers%s %s',
    async (status, code) => {
      const onOpenChange = vi.fn();
      startAnswer = { status, body: { error: code } };
      await renderDialog(onOpenChange);
      await pickContactAndType();

      const el = await submitAndAwaitRefusal(code);

      expect(el.textContent).not.toContain(code);
      expect(el.textContent?.length).toBeGreaterThan(0);
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.queryByTestId('new-conv-open-conversation')).toBeNull();
    },
  );

  it('NewConversationDialog_ShouldShowContactNotFound_WhenPlatformAnswers404WithProse', async () => {
    startAnswer = { status: 404, body: { error: 'Contact not found' } };
    await renderDialog();
    await pickContactAndType();

    const el = await submitAndAwaitRefusal('contact-not-found');
    expect(el.textContent).not.toContain('Contact not found');
  });

  it('NewConversationDialog_ShouldRevealAndFocusTheTemplateName_WhenPlatformAnswersWhatsAppTemplateRequired', async () => {
    startAnswer = { status: 409, body: { error: 'whatsapp-template-required' } };
    await renderDialog();
    await pickContactAndType();
    expect(screen.queryByTestId('new-conv-template-name')).toBeNull();

    await submitAndAwaitRefusal('whatsapp-template-required');

    const name = await screen.findByTestId('new-conv-template-name');
    await waitFor(() => expect(name).toHaveFocus());
  });

  it('NewConversationDialog_ShouldClearTheRefusal_WhenTheAgentRetriesSuccessfully', async () => {
    startAnswer = { status: 409, body: { error: 'whatsapp-template-required' } };
    await renderDialog();
    await pickContactAndType();
    await submitAndAwaitRefusal('whatsapp-template-required');

    startAnswer = { status: 201, body: createdConversation() };
    fireEvent.change(screen.getByTestId('new-conv-template-name'), {
      target: { value: 'hello_world' },
    });
    fireEvent.click(screen.getByTestId('new-conv-submit-btn'));

    expect(await screen.findByTestId('opened-conversation')).toBeInTheDocument();
    expect(createBodies[1]).toMatchObject({
      templateName: 'hello_world',
      templateLanguage: 'en_US',
    });
  });

  it('NewConversationDialog_ShouldOfferToOpenTheOwnConversation_WhenPlatformAnswersConversationNotSendable', async () => {
    const onOpenChange = vi.fn();
    startAnswer = {
      status: 409,
      body: { error: 'conversation-not-sendable', conversationId: 'own-conv', ownerKind: 'Agent' },
    };
    await renderDialog(onOpenChange);
    await pickContactAndType();
    await submitAndAwaitRefusal('conversation-not-sendable');

    fireEvent.click(screen.getByTestId('new-conv-open-conversation'));

    expect(await screen.findByTestId('opened-conversation')).toHaveAttribute('data-id', 'own-conv');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('NewConversationDialog_ShouldClearTheRefusal_WhenTheAgentPicksAnotherContact', async () => {
    startAnswer = {
      status: 409,
      body: { error: 'conversation-not-sendable', conversationId: 'own-conv', ownerKind: 'Agent' },
    };
    await renderDialog();
    await pickContactAndType();
    await submitAndAwaitRefusal('conversation-not-sendable');

    // Same channel: only the contact changes, so the refusal (and its link to the previous
    // contact's conversation) must not survive the switch.
    fireEvent.click(screen.getByTestId('new-conv-change-contact-btn'));
    expect(screen.queryByTestId('new-conv-error')).toBeNull();
    expect(screen.queryByTestId('new-conv-open-conversation')).toBeNull();

    fireEvent.change(screen.getByTestId('new-conv-contact-search'), { target: { value: 'Ana' } });
    fireEvent.click(await screen.findByTestId(`new-conv-contact-option-${CONTACT_ID}`));
    expect(screen.queryByTestId('new-conv-error')).toBeNull();
    expect(screen.queryByTestId('new-conv-open-conversation')).toBeNull();
    expect(createBodies).toHaveLength(1);
  });

  it('NewConversationDialog_ShouldLinkToTheMonitorAndNeverTakeOver_WhenTheConversationIsOpenElsewhereAndTheCallerMayMonitor', async () => {
    useAuthStore.setState({ permissions: ['contacts:conversation:monitor'] });
    startAnswer = {
      status: 409,
      body: {
        error: 'conversation-open-elsewhere',
        conversationId: 'other-conv',
        ownerKind: 'Agent',
      },
    };
    await renderDialog();
    await pickContactAndType();
    await submitAndAwaitRefusal('conversation-open-elsewhere');

    expect(screen.queryByTestId('new-conv-open-conversation')).toBeNull();
    fireEvent.click(screen.getByTestId('new-conv-view-open-conversation'));

    const monitor = await screen.findByTestId('monitor-stub');
    const search = new URLSearchParams(monitor.getAttribute('data-search') ?? '');
    expect(search.get('tab')).toBe('digital');
    expect(search.get('conversation')).toBe('other-conv');
    // Only the one start request reached Platform: no takeover (msw errors on any other request).
    expect(createBodies).toHaveLength(1);
  });

  it('NewConversationDialog_ShouldOfferNoLink_WhenTheConversationIsOpenElsewhereAndTheCallerMayNotMonitor', async () => {
    startAnswer = {
      status: 409,
      body: {
        error: 'conversation-open-elsewhere',
        conversationId: 'other-conv',
        ownerKind: 'Queue',
      },
    };
    await renderDialog();
    await pickContactAndType();
    await submitAndAwaitRefusal('conversation-open-elsewhere');

    expect(screen.queryByTestId('new-conv-view-open-conversation')).toBeNull();
    expect(screen.queryByTestId('new-conv-open-conversation')).toBeNull();
  });
});

describe('NewConversationDialog channels (agent-console-contract-debt)', () => {
  it('Channels_ShouldOfferAndSelectTheOnlyListedChannel_WhenTheListHoldsWebChatAlone', async () => {
    channelsAnswer = { status: 200, body: webChatOnlyChannels };
    await renderReopenable();

    await waitFor(() => expect(selectedChannelText()).toBe(enCommon.channels.webchat));
    expect(await offeredChannels()).toEqual([
      { testId: 'new-conv-channel-option-WebChat', label: enCommon.channels.webchat },
    ]);
  });

  it('Channels_ShouldOfferAChannelUnderItsLabel_WhenTheServerStartsListingIt', async () => {
    channelsAnswer = { status: 200, body: messengerChannels };
    await renderReopenable();

    await waitFor(() => expect(selectedChannelText()).toBe(enCommon.channels.messenger));
    expect(screen.queryByTestId('new-conv-no-channels')).toBeNull();
  });

  it('Channels_ShouldNotReadTheList_UntilTheDialogOpens', async () => {
    await renderReopenable({ startOpen: false });

    await new Promise((r) => setTimeout(r, 20));
    expect(channelReads).toBe(0);

    reopenDialog();
    await waitFor(() => expect(channelReads).toBe(1));
  });

  it('Channels_ShouldKeepTheServerOrderAndSendTheWireValue_WhenTheAgentStartsOnTheSecond', async () => {
    await renderReopenable();
    await searchContact();
    await pickContactAndType();

    expect((await offeredChannels()).map((o) => o.testId)).toEqual([
      'new-conv-channel-option-WhatsApp',
      'new-conv-channel-option-WebChat',
    ]);
    await chooseOpenOption('WebChat');
    fireEvent.click(screen.getByTestId('new-conv-submit-btn'));

    await waitFor(() => expect(createBodies).toHaveLength(1));
    expect(createBodies[0]).toEqual({
      contactId: CONTACT_ID,
      channel: 'WebChat',
      initialMessage: 'Hola Ana',
    });
  });

  it('Channels_ShouldLabelEveryChannelValue_WhenTheConsoleIsInSpanish', async () => {
    channelsAnswer = { status: 200, body: everyChannelListed };
    await renderReopenable({ lng: 'es-419' });
    await waitFor(() => expect(channelTrigger()).toBeEnabled());

    expect(await offeredChannels()).toEqual(
      channelTypeValues.map((value) => ({
        testId: `new-conv-channel-option-${value}`,
        label: esCommon.channels[value.toLowerCase() as keyof typeof esCommon.channels],
      })),
    );
  });

  it('Channels_ShouldSelectTheFirstListedAndHideTheTemplate_WhenWhatsAppIsNotFirst', async () => {
    channelsAnswer = { status: 200, body: smsThenWebChatChannels };
    await renderReopenable();

    await waitFor(() => expect(selectedChannelText()).toBe(enCommon.channels.sms));
    expect(screen.queryByTestId('new-conv-template-toggle')).toBeNull();
  });

  it('Channels_ShouldShowTheTemplateOnlyWhileWhatsAppIsSelected_WhenTheAgentSwitches', async () => {
    await renderReopenable();
    await screen.findByTestId('new-conv-template-toggle');

    await pickChannel('WebChat');
    expect(screen.queryByTestId('new-conv-template-toggle')).toBeNull();

    await pickChannel('WhatsApp');
    expect(screen.getByTestId('new-conv-template-toggle')).toBeInTheDocument();
  });

  it('Channels_ShouldDropThePick_WhenTheDialogClosesAndReopens', async () => {
    await renderReopenable();
    await waitFor(() => expect(channelTrigger()).toBeEnabled());
    await pickChannel('WebChat');
    expect(selectedChannelText()).toBe(enCommon.channels.webchat);

    closeDialog();
    await waitFor(() => expect(screen.queryByTestId('new-conversation-form')).toBeNull());
    reopenDialog();

    await waitFor(() => expect(selectedChannelText()).toBe(enCommon.channels.whatsapp));
  });

  it('Channels_ShouldShowTheNoticeInTheAgentsLanguageAndDisableTheStart_WhenTheListIsEmpty', async () => {
    channelsAnswer = { status: 200, body: noAvailableChannels };
    await renderReopenable({ lng: 'es-419' });
    await searchContact();
    await fillContactAndMessage();

    const notice = await screen.findByTestId('new-conv-no-channels');
    expect(notice.textContent).toBe(esAgent.new_conversation.no_channels);
    expect(screen.getByTestId('new-conv-submit-btn')).toBeDisabled();
    expect(channelTrigger()).toBeDisabled();
    fireEvent.submit(screen.getByTestId('new-conversation-form'));
    await new Promise((r) => setTimeout(r, 20));
    expect(createBodies).toHaveLength(0);
  });

  it('Channels_ShouldKeepTheStartDisabledWithNoNotice_WhileTheListLoads', async () => {
    const { hold, release } = deferred();
    channelsAnswer = { status: 200, body: availableChannels, hold };
    await renderReopenable();
    await searchContact();
    await fillContactAndMessage();
    await waitFor(() => expect(channelReads).toBe(1));

    expect(screen.getByTestId('new-conv-submit-btn')).toBeDisabled();
    expect(screen.queryByTestId('new-conv-no-channels')).toBeNull();

    release();
    await waitFor(() => expect(screen.getByTestId('new-conv-submit-btn')).toBeEnabled());
    expect(screen.queryByTestId('new-conv-no-channels')).toBeNull();
  });

  it.each([
    [401, null],
    [409, { title: 'TenantTypeMismatchProblem' }],
    [500, null],
  ] as const)(
    'Channels_ShouldShowTheNoticeAndOfferNoFixedChannel_WhenTheReadAnswers%s',
    async (status, body) => {
      channelsAnswer = { status, body };
      server.use(http.post('/api/v1/auth/refresh', () => new HttpResponse(null, { status: 401 })));
      await renderReopenable();
      await searchContact();
      await fillContactAndMessage();

      expect(await screen.findByTestId('new-conv-no-channels')).toBeInTheDocument();
      expect(screen.getByTestId('new-conv-submit-btn')).toBeDisabled();
      expect(channelTrigger()).toBeDisabled();
      expect(selectedChannelText()).toBe('');
      expect(screen.queryByTestId('new-conv-template-toggle')).toBeNull();
    },
  );

  it('Channels_ShouldReadAgain_WhenTheDialogReopensAfterAFailedFirstRead', async () => {
    channelsAnswer = { status: 500, body: null };
    await renderReopenable();
    await screen.findByTestId('new-conv-no-channels');

    closeDialog();
    await waitFor(() => expect(screen.queryByTestId('new-conversation-form')).toBeNull());
    channelsAnswer = { status: 200, body: webChatOnlyChannels };
    reopenDialog();

    await waitFor(() => expect(selectedChannelText()).toBe(enCommon.channels.webchat));
    expect(screen.queryByTestId('new-conv-no-channels')).toBeNull();
  });
});

/**
 * Audit-carry F1. TanStack keeps the last good `data` through a failed refetch, with `status` at
 * `error`, so a list read from `data` alone would go on offering what the server stopped answering
 * for. The rule the dialog follows:
 *  - a refresh in flight changes nothing: the cached list stays offered and the pick stands;
 *  - a refresh that fails is a failed read: nothing is offered, the notice shows and the start is
 *    disabled, even over a cached list, until a later read succeeds;
 *  - the pick survives both, and applies again if a later read still lists it;
 *  - a read that stops listing the pick moves the selection to the first listed channel.
 */
describe('NewConversationDialog channels through a refresh (audit-carry F1)', () => {
  it('Refresh_ShouldShowTheNoticeAndDisableTheStart_WhenItFailsOverACachedList', async () => {
    const queryClient = await renderReopenable();
    await searchContact();
    await pickContactAndType();
    expect(screen.getByTestId('new-conv-submit-btn')).toBeEnabled();
    expect(queryClient.getQueryData(['available-channels'])).toEqual(availableChannels);

    channelsAnswer = { status: 500, body: null };
    await refreshChannels(queryClient);

    expect(await screen.findByTestId('new-conv-no-channels')).toBeInTheDocument();
    expect(screen.getByTestId('new-conv-submit-btn')).toBeDisabled();
    expect(channelTrigger()).toBeDisabled();
    expect(queryClient.getQueryData(['available-channels'])).toEqual(availableChannels);
  });

  it('Refresh_ShouldShowTheNotice_WhenItFailsAsTheDialogReopensOverACachedList', async () => {
    await renderReopenable();
    await waitFor(() => expect(channelTrigger()).toBeEnabled());
    closeDialog();
    await waitFor(() => expect(screen.queryByTestId('new-conversation-form')).toBeNull());

    channelsAnswer = { status: 500, body: null };
    reopenDialog();

    expect(await screen.findByTestId('new-conv-no-channels')).toBeInTheDocument();
    expect(screen.getByTestId('new-conv-submit-btn')).toBeDisabled();
  });

  it('Refresh_ShouldRestoreThePick_WhenALaterReadStillListsIt', async () => {
    const queryClient = await renderReopenable();
    await waitFor(() => expect(channelTrigger()).toBeEnabled());
    await pickChannel('WebChat');

    channelsAnswer = { status: 500, body: null };
    await refreshChannels(queryClient);
    await screen.findByTestId('new-conv-no-channels');

    channelsAnswer = { status: 200, body: availableChannels };
    await refreshChannels(queryClient);

    await waitFor(() => expect(selectedChannelText()).toBe(enCommon.channels.webchat));
    expect(screen.queryByTestId('new-conv-no-channels')).toBeNull();
  });

  it('Refresh_ShouldKeepTheListAndThePick_WhileItIsInFlight', async () => {
    const queryClient = await renderReopenable();
    await searchContact();
    await pickContactAndType();
    await pickChannel('WebChat');

    const { hold, release } = deferred();
    channelsAnswer = { status: 200, body: availableChannels, hold };
    const refreshed = refreshChannels(queryClient);
    await waitFor(() => expect(channelReads).toBe(2));

    expect(selectedChannelText()).toBe(enCommon.channels.webchat);
    expect(screen.getByTestId('new-conv-submit-btn')).toBeEnabled();
    expect(screen.queryByTestId('new-conv-no-channels')).toBeNull();

    release();
    await refreshed;
  });

  it('Refresh_ShouldMoveToTheFirstListedAndDropTheRefusal_WhenItStopsListingThePick', async () => {
    startAnswer = { status: 409, body: { error: 'channel-not-available' } };
    const queryClient = await renderReopenable();
    await searchContact();
    await pickContactAndType();
    await pickChannel('WebChat');
    await submitAndAwaitRefusal('channel-not-available');

    channelsAnswer = { status: 200, body: whatsAppOnlyChannels };
    await refreshChannels(queryClient);

    await waitFor(() => expect(selectedChannelText()).toBe(enCommon.channels.whatsapp));
    expect(screen.queryByTestId('new-conv-error')).toBeNull();
    expect(screen.getByTestId('new-conv-submit-btn')).toBeEnabled();
  });
});
