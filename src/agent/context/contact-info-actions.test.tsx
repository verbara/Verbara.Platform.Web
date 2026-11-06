import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationStore } from '@/agent/stores/conversation-store';
import { useAuthStore } from '@/core/auth/auth-store';
import { customFetch } from '@/core/api/client';
import { useVoiceCallStore } from '@/core/stores/voice-call-store';
import { toast } from 'sonner';
import { ApiError } from '@/core/api/api-error';
import {
  cardDialRequest,
  cardEditRequest,
  cardEditResponse,
  contactLevelOne,
  contactLevelOneWithVoiceAddress,
  contactNotPermittedRefusal,
} from '@/tests/utils/contract-doubles';

/**
 * The card's delete, edit and call against the real `PermissionButton`, auth store and `useContact`, with only
 * `customFetch` replaced. `contact-info.test.tsx` mocks the first and the last, so it sees neither the guards nor
 * the id the read gives (spec `platform-entity-mapping`; host fixture `contact-card-actions.v1.json`).
 */

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/i18n/use-format-phone', () => ({
  useFormatPhone: () => ({ formatPhone: (raw: string) => raw }),
}));
vi.mock('react-i18next', async () => {
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('en-US');
  return {
    useTranslation: (ns?: string | string[]) => ({
      t: i18n.getFixedT('en-US', Array.isArray(ns) ? ns[0] : (ns ?? 'common')),
      i18n,
    }),
  };
});

import { ContactInfo } from './contact-info';

const CONTACT_ID = '7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d';
const CONTACT_URL = `/api/v1/contacts/${CONTACT_ID}`;

/** The permissions of the `Agent` role template (Platform `RoleTemplateSeeder.cs`). */
const AGENT_PERMISSIONS = [
  'contacts:conversation:handle',
  'contacts:conversation:transfer',
  'contacts:contact:view',
  'reporting:realtime:view',
];

interface FetchCall {
  url: string;
  method: string;
  data?: unknown;
}

function callsOf(method: string): FetchCall[] {
  return vi
    .mocked(customFetch)
    .mock.calls.map(([config]) => config as FetchCall)
    .filter((config) => config.method === method);
}

/** Renders the card for `body`, as `GET /api/v1/contacts/{id}` answers it, and waits for the read to land. */
async function renderCard(body: unknown, permissions: string[]) {
  useAuthStore.setState({ permissions });
  vi.mocked(customFetch).mockImplementation(async (config) => {
    if (config.method === 'GET') return body;
    if (config.method === 'PUT') return cardEditResponse;
    if (config.method === 'POST') return { accepted: true, correlationId: 'corr-1' };
    return undefined;
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ContactInfo />
    </QueryClientProvider>,
  );
  await screen.findByTestId('contact-delete-btn');
}

describe('ContactInfo actions', () => {
  beforeEach(() => {
    useConversationStore.setState({
      selectedId: 'conv-1',
      conversations: {
        'conv-1': {
          id: 'conv-1',
          contactId: CONTACT_ID,
          contactName: 'Ana',
          channel: 'webchat',
          queueName: '',
          state: 'active',
          lastMessage: '',
          lastMessageAt: '2026-11-04T14:05:00.000+00:00',
          unread: false,
          assignedAt: '2026-11-04T14:05:00.000+00:00',
        },
      },
    });
    useVoiceCallStore.setState({ registration: 'registered', phase: 'idle' });
  });

  afterEach(() => {
    cleanup();
    vi.mocked(customFetch).mockReset();
    useAuthStore.setState({ permissions: [] });
    useConversationStore.setState({ selectedId: null, conversations: {} });
    useVoiceCallStore.setState({ registration: 'unregistered', phase: 'idle' });
  });

  it('ContactInfo_ShouldHaveNoWorkingDelete_WhenTheRoleLacksThePermission', async () => {
    await renderCard(contactLevelOne, AGENT_PERMISSIONS);

    const button = screen.getByTestId('contact-delete-btn');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsOf('DELETE')).toEqual([]);
  });

  it('ContactInfo_ShouldDeleteByTheMappedId_WhenTheRoleHoldsThePermission', async () => {
    await renderCard(contactLevelOne, [...AGENT_PERMISSIONS, 'contacts:contact:delete']);

    const button = screen.getByTestId('contact-delete-btn');
    expect(button).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(button);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // The confirm unlocks after the dialog's 3-second countdown.
    const confirm = await screen.findByRole('button', { name: 'Delete' }, { timeout: 4_000 });
    fireEvent.click(confirm);

    await waitFor(() => expect(callsOf('DELETE')).toHaveLength(1));
    expect(callsOf('DELETE')[0]).toEqual({ url: CONTACT_URL, method: 'DELETE' });
  }, 10_000);

  it('ContactInfo_ShouldOpenNoEditDialog_WhenTheRoleLacksThePermission', async () => {
    await renderCard(contactLevelOne, AGENT_PERMISSIONS);

    const button = screen.getByRole('button', { name: 'Edit' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsOf('PUT')).toEqual([]);
  });

  it('ContactInfo_ShouldPutTheCardEditMembersWithoutAnId_WhenTheRoleHoldsThePermission', async () => {
    await renderCard(cardEditResponse, [...AGENT_PERMISSIONS, 'contacts:contact:edit']);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));

    await waitFor(() => expect(callsOf('PUT')).toHaveLength(1));
    const call = callsOf('PUT')[0];
    expect(call?.url).toBe(CONTACT_URL);
    expect(JSON.parse(JSON.stringify(call?.data))).toEqual(cardEditRequest);
  });

  it('ContactInfo_ShouldOmitAMemberWhoseFieldIsEmpty_WhenItSavesTheEdit', async () => {
    await renderCard(contactLevelOne, [...AGENT_PERMISSIONS, 'contacts:contact:edit']);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));

    await waitFor(() => expect(callsOf('PUT')).toHaveLength(1));
    const call = callsOf('PUT')[0];
    expect(call?.url).toBe(CONTACT_URL);
    expect(JSON.parse(JSON.stringify(call?.data))).toEqual({ firstName: 'Ana' });
  });

  it('ContactInfo_ShouldShowTheCallButtonAndDialTheCardDialBody_WhenTheReadHoldsAVoiceAddress', async () => {
    await renderCard(contactLevelOneWithVoiceAddress, AGENT_PERMISSIONS);

    fireEvent.click(screen.getByTestId('contact-call-btn'));

    await waitFor(() => expect(callsOf('POST')).toHaveLength(1));
    expect(callsOf('POST')[0]).toEqual({
      url: '/api/v1/voice/dial',
      method: 'POST',
      data: cardDialRequest,
    });
  });

  it('ContactInfo_ShouldDialNothing_WhenTheReadSaysTheContactIsDoNotContact', async () => {
    await renderCard({ ...contactLevelOneWithVoiceAddress, doNotContact: true }, AGENT_PERMISSIONS);

    const button = screen.getByTestId('contact-call-btn');
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(screen.getByTestId('contact-call-do-not-contact')).toBeInTheDocument();
    expect(callsOf('POST')).toEqual([]);
  });

  /** The fixture's 403 `{ "error": "not-permitted" }` on `method`; every other request answers as `renderCard`'s. */
  function refuse(method: 'PUT' | 'DELETE', body: unknown) {
    vi.mocked(customFetch).mockImplementation(async (config) => {
      if (config.method === method) throw new ApiError(403, contactNotPermittedRefusal);
      if (config.method === 'GET') return body;
      return undefined;
    });
  }

  function shownErrorCodes(): string[] {
    return vi
      .mocked(toast.error)
      .mock.calls.map(
        ([shown]) =>
          (shown as React.ReactElement<{ 'data-error-code': string }>).props['data-error-code'],
      );
  }

  it('ContactInfo_ShouldToastNotPermittedAndKeepTheEditDialogOpen_WhenPlatformRefusesTheEdit', async () => {
    vi.mocked(toast.error).mockClear();
    await renderCard(cardEditResponse, [...AGENT_PERMISSIONS, 'contacts:contact:edit']);
    refuse('PUT', cardEditResponse);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Update' }));

    await waitFor(() => expect(shownErrorCodes()).toEqual(['not-permitted']));
    expect(callsOf('PUT')).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update' })).toBeEnabled();
  });

  it('ContactInfo_ShouldToastNotPermittedAndKeepTheCard_WhenPlatformRefusesTheDelete', async () => {
    vi.mocked(toast.error).mockClear();
    await renderCard(contactLevelOne, [...AGENT_PERMISSIONS, 'contacts:contact:delete']);
    refuse('DELETE', contactLevelOne);

    fireEvent.click(screen.getByTestId('contact-delete-btn'));
    const confirm = await screen.findByRole('button', { name: 'Delete' }, { timeout: 4_000 });
    fireEvent.click(confirm);

    await waitFor(() => expect(shownErrorCodes()).toEqual(['not-permitted']));
    expect(callsOf('DELETE')).toEqual([{ url: CONTACT_URL, method: 'DELETE' }]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('contact-delete-btn')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();
  }, 10_000);

  it('ContactInfo_ShouldSendNoPreferredChannel_WhenTheFieldHoldsNoChannelTypeName', async () => {
    await renderCard(cardEditResponse, [...AGENT_PERMISSIONS, 'contacts:contact:edit']);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(await screen.findByLabelText('Preferred Channel'), {
      target: { value: 'whatsapp' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(callsOf('PUT')).toHaveLength(1));
    const sent = JSON.parse(JSON.stringify(callsOf('PUT')[0]?.data)) as Record<string, unknown>;
    expect(sent).not.toHaveProperty('preferredChannel');
    expect(sent.firstName).toBe('Ana');
  });
});
