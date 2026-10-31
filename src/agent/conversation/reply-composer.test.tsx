/**
 * The composer through its real data path: the real `useSendMessage`, the real `customFetch` and the
 * real conversation store, with msw answering the send. The upload route answers too, and counts:
 * a sent message carries text only, so nothing here may reach it.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/test/msw-server';
import { createLocaleI18n, TEST_LOCALES, type TestLocale } from '@/test/locale-i18n';
import { useAuthStore } from '@/core/auth/auth-store';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useDraftStore } from '@/agent/stores/draft-store';
import { ReplyComposer } from './reply-composer';
import enAgent from '../../../public/locales/en-US/agent.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import ptAgent from '../../../public/locales/pt-BR/agent.json';

const AGENT_LOCALES = { 'en-US': enAgent, 'es-419': esAgent, 'pt-BR': ptAgent };
const CONVERSATION_ID = '9c2e7a14b3d64f08a1e5d7c6b4f30a21';

/** The labels the control had, from before it went: the locale files no longer hold them. */
const FORMER_ATTACH_LABELS = [/attach file/i, /adjuntar archivo/i, /anexar arquivo/i];

let sentBodies: unknown[];
let uploads: number;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  useConversationStore.setState({ conversations: {}, messages: {}, selectedId: CONVERSATION_ID });
  useDraftStore.setState({ drafts: {} });
  sentBodies = [];
  uploads = 0;
  server.use(
    http.post(`/api/v1/conversations/${CONVERSATION_ID}/messages`, async ({ request }) => {
      sentBodies.push(await request.json());
      return HttpResponse.json({});
    }),
    http.post('/api/v1/media/upload', () => {
      uploads += 1;
      return HttpResponse.json({ id: 'm1', fileName: 'a.txt', contentType: 'text/plain', size: 1 });
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

async function renderComposer(lng: TestLocale = 'en-US') {
  const i18n = await createLocaleI18n(lng);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ReplyComposer conversationId={CONVERSATION_ID} contactName="Ana" />
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

function type(text: string) {
  fireEvent.change(screen.getByTestId('reply-composer-input'), { target: { value: text } });
}

describe('ReplyComposer attachments', () => {
  it.each(TEST_LOCALES)('Render_ShouldOfferNoAttachmentControl (%s)', async (lng) => {
    const { container } = await renderComposer(lng);

    expect(container.querySelector('input[type="file"]')).toBeNull();
    for (const label of FORMER_ATTACH_LABELS) {
      expect(screen.queryByRole('button', { name: label })).toBeNull();
    }
    expect(screen.getAllByRole('button')).toEqual([screen.getByTestId('reply-composer-send')]);
  });

  // Audit-carry F3: parity passes a key kept in all three files, and a grep for the dotted key never
  // matches nested JSON. Only reading the JSON can fail here.
  it.each(TEST_LOCALES)('Locale_ShouldHoldNoAttachmentKey (%s)', (lng) => {
    const composer = AGENT_LOCALES[lng].composer;
    for (const key of ['attach_file', 'remove_attachment']) {
      expect(composer).not.toHaveProperty(key);
    }
  });
});

describe('ReplyComposer send', () => {
  it('Send_ShouldPostTheTrimmedTextAndStartNoUpload', async () => {
    await renderComposer();
    type('  Hello Ana  ');
    fireEvent.click(screen.getByTestId('reply-composer-send'));

    await waitFor(() => expect(sentBodies).toEqual([{ text: 'Hello Ana' }]));
    expect(uploads).toBe(0);
  });

  it('Send_ShouldAddATextMessageWithNoMetadataAndClearTheInput', async () => {
    await renderComposer();
    useDraftStore.getState().setDraft(CONVERSATION_ID, 'Hello Ana');
    type('Hello Ana');
    fireEvent.click(screen.getByTestId('reply-composer-send'));

    const [message] = useConversationStore.getState().messages[CONVERSATION_ID] ?? [];
    expect(message).toMatchObject({ sender: 'agent', text: 'Hello Ana', type: 'text' });
    expect(message?.metadata).toBeUndefined();
    expect(screen.getByTestId('reply-composer-input')).toHaveValue('');
    expect(useDraftStore.getState().drafts[CONVERSATION_ID]).toBeUndefined();
    await waitFor(() => expect(sentBodies).toHaveLength(1));
  });

  it('Send_ShouldLabelTheAgentsOwnMessageFromTheLocaleFile_InPtBr', async () => {
    await renderComposer('pt-BR');
    type('Olá Ana');
    fireEvent.click(screen.getByTestId('reply-composer-send'));

    const [message] = useConversationStore.getState().messages[CONVERSATION_ID] ?? [];
    expect(message?.senderName).toBe('Você');
  });

  it('Shortcut_ShouldSend_WhenThereIsText', async () => {
    await renderComposer();
    type('Hello Ana');
    fireEvent.keyDown(screen.getByTestId('reply-composer-input'), { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(sentBodies).toEqual([{ text: 'Hello Ana' }]));
    expect(uploads).toBe(0);
  });
});

describe('ReplyComposer empty', () => {
  it('Render_ShouldDisableTheSend_WhenNothingWasTyped', async () => {
    await renderComposer();

    expect(screen.getByTestId('reply-composer-send')).toBeDisabled();
  });

  it('Render_ShouldDisableTheSend_WhenTheTextIsBlank', async () => {
    await renderComposer();
    type('  \n ');

    expect(screen.getByTestId('reply-composer-send')).toBeDisabled();
  });

  it('Render_ShouldEnableTheSend_WhenThereIsText', async () => {
    await renderComposer();
    type('Hello');

    expect(screen.getByTestId('reply-composer-send')).toBeEnabled();
  });

  it('Shortcut_ShouldSendNothing_WhenTheComposerIsEmpty', async () => {
    await renderComposer();
    fireEvent.keyDown(screen.getByTestId('reply-composer-input'), { key: 'Enter', ctrlKey: true });

    expect(useConversationStore.getState().messages[CONVERSATION_ID]).toBeUndefined();
  });
});
