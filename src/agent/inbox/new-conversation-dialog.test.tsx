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
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18next from 'i18next';
import type { components } from '@/core/api/generated/openapi';
import { server } from '@/test/msw-server';
import { useAuthStore } from '@/core/auth/auth-store';
import { NewConversationDialog } from './new-conversation-dialog';
import enAgent from '../../../public/locales/en-US/agent.json';
import enCommon from '../../../public/locales/en-US/common.json';

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

let createBodies: unknown[] = [];
let startAnswer: StartAnswer;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  createBodies = [];
  startAnswer = { status: 201, body: createdConversation() };
  server.use(
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
  const form = screen.getByTestId('new-conversation-form');
  fireEvent.click(await within(form).findByText('Ana Pérez'));
  fireEvent.change(screen.getByTestId('new-conv-message-input'), { target: { value: message } });
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
