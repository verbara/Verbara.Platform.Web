/**
 * The agent's new-conversation dialog searches `GET /api/v1/contacts`, which answers Platform's
 * `PagedResult<Contact>` (ContactEndpoints): each item is the raw `Contact` record — `contactId`,
 * `firstName`, `lastName`, `addresses[{ channel: 'WhatsApp', address }]` — with no `id`. Before
 * 3.21.0-web the options read `id`, so every option was `new-conv-contact-option-undefined` and the
 * create request carried no `contactId`; Platform answered 400 "Value cannot be null" (LAB-W1 N16).
 * Real hooks, real `customFetch`, msw answering as Platform v2.25.0+.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
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

let createBodies: unknown[] = [];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  useAuthStore.getState().logout();
  createBodies = [];
  server.use(
    http.get('/api/v1/contacts', () =>
      HttpResponse.json({ items: [platformContact], totalCount: 1, page: 1, pageSize: 20 }),
    ),
    http.post('/api/v1/conversations', async ({ request }) => {
      createBodies.push(await request.json());
      return HttpResponse.json({}, { status: 201 });
    }),
  );
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

async function renderDialog() {
  const i18n = await createAgentI18n();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <NewConversationDialog open onOpenChange={() => undefined} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  fireEvent.change(await screen.findByTestId('new-conv-contact-search'), {
    target: { value: 'Ana' },
  });
}

describe('NewConversationDialog with Platform contacts', () => {
  it('NewConversationDialog_ShouldKeyEachContactOptionByPlatformContactId_WhenSearchAnswers', async () => {
    await renderDialog();

    expect(await screen.findByTestId(`new-conv-contact-option-${CONTACT_ID}`)).toBeInTheDocument();
    expect(screen.queryByTestId('new-conv-contact-option-undefined')).toBeNull();
  });

  it('NewConversationDialog_ShouldSendThePlatformContactId_WhenConversationCreated', async () => {
    await renderDialog();

    // The first option, whatever its test id: the request body is what this test pins.
    const form = screen.getByTestId('new-conversation-form');
    fireEvent.click(await within(form).findByText('Ana Pérez'));
    fireEvent.click(screen.getByTestId('new-conv-submit-btn'));

    await waitFor(() => expect(createBodies).toHaveLength(1));
    expect(createBodies[0]).toEqual({ contactId: CONTACT_ID, channel: 'WhatsApp' });
  });
});
