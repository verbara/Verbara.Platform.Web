import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
  optOutDoNotContactRequest,
  optOutResponse,
  tokenPermissionsAdminExample,
  tokenPermissionsSupervisorExcerpt,
} from '@/tests/utils/contract-doubles';
import type { components } from '@/core/api/generated/openapi';

type Schemas = components['schemas'];

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
const OPT_OUT_URL = `/api/v1/contacts/${CONTACT_ID}/opt-out`;

/** The verbatim copy of the host's `contact-opt-out.v1.json` (design W11). */
const optOutFixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts/contact-opt-out.v1.json'), 'utf-8'),
) as {
  refusals: {
    request: { method: string; path: string; body?: unknown };
    status: number;
    body?: Record<string, unknown>;
  }[];
};

/** The verbatim copy of the host's `token-permissions.v1.json` (design W7). */
const tokenPermissionsFixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/token-permissions.v1.json'),
    'utf-8',
  ),
) as {
  excerptsByTemplate: Record<string, string[]>;
  example: { body: { permissions: string[] } };
};

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

  it('ContactInfo_ShouldEnableEditAndDelete_WhenTheTokenCarriesTheAdminExamplePermissions', async () => {
    expect(tokenPermissionsAdminExample).toEqual(tokenPermissionsFixture.example.body.permissions);
    await renderCard(contactLevelOne, tokenPermissionsAdminExample);

    expect(screen.getByTestId('contact-delete-btn')).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'false');
  });

  it('ContactInfo_ShouldEnableEditAndDisableDelete_WhenTheTokenCarriesTheSupervisorExcerpt', async () => {
    expect(tokenPermissionsSupervisorExcerpt).toEqual(
      tokenPermissionsFixture.excerptsByTemplate.supervisor,
    );
    await renderCard(contactLevelOne, tokenPermissionsSupervisorExcerpt);

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('aria-disabled', 'false');
    const button = screen.getByTestId('contact-delete-btn');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(callsOf('DELETE')).toEqual([]);
  });

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

  describe('"Do not contact"', () => {
    /** The contact as `GET` reads it before the opt-out: the fixture's `response.body` not yet marked. */
    const beforeOptOut: Schemas['Contact'] = { ...optOutResponse, doNotContact: false };
    /** A contact with no voice or SMS address, before and after the opt-out. */
    const noPhoneBefore: Schemas['Contact'] = contactLevelOne;
    const noPhoneAfter: Schemas['Contact'] = { ...contactLevelOne, doNotContact: true };

    /**
     * `GET` answers `before` until the opt-out answers, then `after`; the opt-out answers `answer` (an `ApiError` is
     * thrown). Waits for the card to render the first read.
     */
    async function renderOptOutCard(options: {
      before: Schemas['Contact'];
      after: Schemas['Contact'];
      answer: Schemas['Contact'] | ApiError;
      permissions: string[];
    }) {
      let marked = false;
      useAuthStore.setState({ permissions: options.permissions });
      vi.mocked(customFetch).mockImplementation(async (config) => {
        if (config.method === 'GET') return marked ? options.after : options.before;
        if (config.method === 'POST' && config.url === OPT_OUT_URL) {
          if (options.answer instanceof ApiError) throw options.answer;
          marked = true;
          return options.answer;
        }
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

    async function confirmDoNotContact() {
      fireEvent.click(screen.getByTestId('contact-do-not-contact-btn'));
      const dialog = await screen.findByTestId('contact-do-not-contact-confirm');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Mark as do not contact' }));
    }

    beforeEach(() => {
      vi.mocked(toast.success).mockClear();
      vi.mocked(toast.error).mockClear();
    });

    it('ContactInfo_ShouldPostTheFixtureBodyAndShowTheStatusWithCallDisabled_WhenAnAgentConfirms', async () => {
      await renderOptOutCard({
        before: beforeOptOut,
        after: optOutResponse,
        answer: optOutResponse,
        permissions: AGENT_PERMISSIONS,
      });
      expect(screen.queryByTestId('contact-call-do-not-contact')).not.toBeInTheDocument();

      await confirmDoNotContact();

      await waitFor(() => expect(callsOf('POST')).toHaveLength(1));
      expect(callsOf('POST')[0]).toEqual({
        url: optOutFixture.refusals[0]?.request.path,
        method: 'POST',
        data: optOutDoNotContactRequest,
      });
      expect(optOutDoNotContactRequest).toEqual(optOutFixture.refusals[0]?.request.body);
      expect(await screen.findByTestId('contact-call-do-not-contact')).toBeInTheDocument();
      // Call is rendered here (a voice address and a registered softphone), so it must be disabled.
      expect(screen.getByTestId('contact-call-btn')).toBeDisabled();
      expect(screen.queryByTestId('contact-do-not-contact-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('contact-do-not-contact-confirm')).not.toBeInTheDocument();
      expect(toast.success).toHaveBeenCalledWith('Marked as do not contact');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('ContactInfo_ShouldShowTheDoNotContactStatus_WhenTheOptOutAnswersWithAnUnregisteredSoftphone', async () => {
      useVoiceCallStore.setState({ registration: 'unregistered', phase: 'idle' });
      await renderOptOutCard({
        before: beforeOptOut,
        after: optOutResponse,
        answer: optOutResponse,
        permissions: AGENT_PERMISSIONS,
      });
      expect(screen.queryByTestId('contact-call-btn')).not.toBeInTheDocument();

      await confirmDoNotContact();

      expect(await screen.findByTestId('contact-call-do-not-contact')).toHaveTextContent(
        'This contact is marked do not contact.',
      );
      expect(screen.queryByTestId('contact-do-not-contact-btn')).not.toBeInTheDocument();
      // Call is not rendered without a registered softphone; when it is not rendered there is nothing to disable.
      expect(screen.queryByTestId('contact-call-btn')).not.toBeInTheDocument();
      expect(callsOf('POST')).toHaveLength(1);
    });

    it('ContactInfo_ShouldShowTheDoNotContactStatus_WhenTheOptOutAnswersForAContactWithNoVoiceOrSmsAddress', async () => {
      await renderOptOutCard({
        before: noPhoneBefore,
        after: noPhoneAfter,
        answer: noPhoneAfter,
        permissions: AGENT_PERMISSIONS,
      });
      expect(screen.queryByTestId('contact-call-btn')).not.toBeInTheDocument();

      await confirmDoNotContact();

      expect(await screen.findByTestId('contact-call-do-not-contact')).toHaveTextContent(
        'This contact is marked do not contact.',
      );
      expect(screen.queryByTestId('contact-do-not-contact-btn')).not.toBeInTheDocument();
      expect(screen.queryByTestId('contact-call-btn')).not.toBeInTheDocument();
      expect(callsOf('POST')).toEqual([
        { url: OPT_OUT_URL, method: 'POST', data: optOutDoNotContactRequest },
      ]);
    });

    it('ContactInfo_ShouldHaveNoWorkingDoNotContact_WhenThePermissionsLackConversationHandle', async () => {
      await renderOptOutCard({
        before: beforeOptOut,
        after: optOutResponse,
        answer: optOutResponse,
        permissions: ['contacts:contact:view'],
      });

      const button = screen.getByTestId('contact-do-not-contact-btn');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(button);

      expect(screen.queryByTestId('contact-do-not-contact-confirm')).not.toBeInTheDocument();
      expect(callsOf('POST')).toEqual([]);
    });

    it('ContactInfo_ShouldToastNotPermittedAndKeepTheConfirmationOpen_WhenPlatformRefusesTheOptOut', async () => {
      const refusal = optOutFixture.refusals[0];
      await renderOptOutCard({
        before: beforeOptOut,
        after: optOutResponse,
        answer: new ApiError(refusal?.status ?? 0, refusal?.body ?? null),
        permissions: AGENT_PERMISSIONS,
      });

      await confirmDoNotContact();

      await waitFor(() => expect(shownErrorCodes()).toEqual(['not-permitted']));
      expect(refusal?.status).toBe(403);
      expect(callsOf('POST')).toHaveLength(1);
      expect(screen.getByTestId('contact-do-not-contact-confirm')).toBeInTheDocument();
      expect(screen.queryByTestId('contact-call-do-not-contact')).not.toBeInTheDocument();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('ContactInfo_ShouldOfferNoDoNotContactAndShowTheStatus_WhenTheContactIsMarked', async () => {
      useVoiceCallStore.setState({ registration: 'unregistered', phase: 'idle' });
      await renderOptOutCard({
        before: noPhoneAfter,
        after: noPhoneAfter,
        answer: noPhoneAfter,
        permissions: AGENT_PERMISSIONS,
      });

      expect(screen.queryByTestId('contact-do-not-contact-btn')).not.toBeInTheDocument();
      expect(screen.getByTestId('contact-call-do-not-contact')).toBeInTheDocument();
    });
  });

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
