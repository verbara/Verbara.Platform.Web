import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { toast } from 'sonner';
import * as client from '@/core/api/client';
import {
  useContact,
  useContactConversations,
  useSearchContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useOptOutContact,
  type Contact,
} from './use-contacts';

import { ApiError } from '@/core/api/api-error';
import {
  contactLevelOne,
  contactSummaryFirstOfTwoPages,
  contactSummaryPage,
  contactSummaryShiftedSecondPage,
  contactWithoutWebChat,
  consentContactVoiceAndEmailYes,
  consentEmailYesRequest,
  contactNotPermittedRefusal,
  notReadableRefusal,
  optOutDoNotContactAndSmsRequest,
  optOutDoNotContactRequest,
  optOutResponse,
} from '@/tests/utils/contract-doubles';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleContact: Contact = {
  id: 'contact-1',
  firstName: 'John',
  lastName: 'Doe',
  company: 'Acme Inc',
  segment: 'Enterprise',
  preferredChannel: 'voice',
  preferredLanguage: 'en',
  timezone: 'America/New_York',
  addresses: [{ channel: 'voice', address: '+15551234567' }],
  createdAt: '2026-01-01T00:00:00Z',
};

describe('use-contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useContact', () => {
    it('useContact_ShouldReadTheRoute_AndTakeTheIdFromContactId_WhenPlatformAnswersTheLevelOneBody', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(contactLevelOne);
      const { result } = renderHook(() => useContact('7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d'), {
        wrapper,
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/contacts/7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d',
        method: 'GET',
      });
      expect(result.current.data?.id).toBe('7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d');
      expect(result.current.data?.identityLevel).toBe('Unverified');
      expect(result.current.data?.addresses[0]?.channel).toBe('webchat');
    });

    it('useContact_ShouldLeaveIdentityLevelAbsent_WhenTheContactHasNoWebChatAddress', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(contactWithoutWebChat);
      const { result } = renderHook(() => useContact('0b1c2d3e4f5a46b7c8d9e0f1a2b3c4d5'), {
        wrapper,
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.id).toBe('0b1c2d3e4f5a46b7c8d9e0f1a2b3c4d5');
      expect(result.current.data).not.toHaveProperty('identityLevel');
    });

    it('should not fetch when id is undefined', () => {
      const { result } = renderHook(() => useContact(undefined), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useContactConversations', () => {
    const CONTACT = '7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d';
    const URL = `/api/v1/contacts/${CONTACT}/conversations`;

    it('useContactConversations_ShouldSendPageAndPageSizeAndKeepServedOrder_WhenItLoads', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(contactSummaryPage);
      const { result } = renderHook(() => useContactConversations(CONTACT), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: URL,
        method: 'GET',
        params: { page: '1', pageSize: '25' },
      });
      expect(result.current.data?.map((c) => c.id)).toEqual([
        'c3b2a1f0e9d84c7b6a5f4e3d2c1b0a99',
        '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
        '0a9b8c7d6e5f40312233445566778899',
      ]);
    });

    it('useContactConversations_ShouldOfferNoNextPage_WhenHasNextPageIsFalse', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(contactSummaryPage);
      const { result } = renderHook(() => useContactConversations(CONTACT), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.hasNextPage).toBe(false);
      await act(() => result.current.fetchNextPage());
      expect(client.customFetch).toHaveBeenCalledTimes(1);
    });

    it('useContactConversations_ShouldAskPageTwoAndShowAShiftedRowOnce_WhenHasNextPageIsTrue', async () => {
      vi.mocked(client.customFetch).mockImplementation(async (config) =>
        config.params?.page === '2'
          ? contactSummaryShiftedSecondPage
          : contactSummaryFirstOfTwoPages,
      );
      const { result } = renderHook(() => useContactConversations(CONTACT), { wrapper });
      await waitFor(() => expect(result.current.hasNextPage).toBe(true));
      await act(() => result.current.fetchNextPage());
      await waitFor(() => expect(result.current.hasNextPage).toBe(false));
      expect(client.customFetch).toHaveBeenLastCalledWith({
        url: URL,
        method: 'GET',
        params: { page: '2', pageSize: '25' },
      });
      expect(result.current.data?.map((c) => c.id)).toEqual([
        'c3b2a1f0e9d84c7b6a5f4e3d2c1b0a99',
        '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
        '0a9b8c7d6e5f40312233445566778899',
      ]);
    });

    it('useContactConversations_ShouldExposeTheRefusal_WhenPlatformAnswersNotReadable', async () => {
      vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, notReadableRefusal));
      const { result } = renderHook(() => useContactConversations(CONTACT), { wrapper });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toMatchObject({ status: 403, code: 'not-readable' });
    });

    it('useContactConversations_ShouldNotFetch_WhenContactIdIsUndefined', () => {
      const { result } = renderHook(() => useContactConversations(undefined), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useSearchContacts', () => {
    it('should fetch contacts when search has 2+ chars', async () => {
      // Platform's `Contact` record: `contactId`, nullable fields, PascalCase address channels.
      vi.mocked(client.customFetch).mockResolvedValue({
        items: [
          {
            contactId: 'contact-1',
            tenantId: 'tenant-1',
            firstName: 'John',
            lastName: 'Doe',
            company: 'Acme Inc',
            segment: 'Enterprise',
            preferredChannel: 'voice',
            preferredLanguage: 'en',
            timezone: 'America/New_York',
            addresses: [{ channel: 'Voice', address: '+15551234567' }],
            customFields: null,
            channelConsent: null,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: null,
          },
        ],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      });
      const { result } = renderHook(() => useSearchContacts('Jo'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleContact]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/contacts',
        method: 'GET',
        params: { search: 'Jo', page: '1', pageSize: '20' },
      });
    });

    it('should not fetch when search is less than 2 chars', () => {
      const { result } = renderHook(() => useSearchContacts('J'), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useCreateContact', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleContact);
      const { result } = renderHook(() => useCreateContact(), { wrapper });
      const payload = {
        firstName: 'John',
        lastName: 'Doe',
        addresses: [{ channel: 'voice', address: '+15551234567' }],
      };
      act(() => {
        result.current.mutate(payload);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/contacts',
        method: 'POST',
        data: payload,
      });
    });
  });

  describe('useUpdateContact', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleContact);
      const { result } = renderHook(() => useUpdateContact(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'contact-1', firstName: 'Jane' });
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/contacts/contact-1',
        method: 'PUT',
        data: { firstName: 'Jane' },
      });
    });
  });

  describe('useDeleteContact', () => {
    it('should call correct endpoint when mutating', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(undefined);
      const { result } = renderHook(() => useDeleteContact(), { wrapper });
      act(() => {
        result.current.mutate('contact-1');
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/contacts/contact-1',
        method: 'DELETE',
      });
    });
  });
});

describe('useContactConversations and the app-wide retry', () => {
  /** The app's `retry: 1`, with no delay: what is under test is whether a second read goes out. */
  function appWideRetryWrapper({ children }: { children: React.ReactNode }) {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, retryDelay: 0 } } });
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['403', 403],
    ['404', 404],
  ])('useContactConversations_ShouldReadOnce_WhenTheAnswerIs %s', async (_name, status) => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(status, notReadableRefusal));
    const { result } = renderHook(() => useContactConversations('contact-1'), {
      wrapper: appWideRetryWrapper,
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(client.customFetch).toHaveBeenCalledTimes(1);
  });

  it('useContactConversations_ShouldKeepTheAppWideRetry_WhenTheAnswerIsAnyOtherError', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(500, null));
    const { result } = renderHook(() => useContactConversations('contact-1'), {
      wrapper: appWideRetryWrapper,
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(client.customFetch).toHaveBeenCalledTimes(2);
  });
});

/**
 * The contact writes' reports and refresh (design W1, W3, W5, W10, W11; spec `console-contact-writes`).
 * Refusal bodies come from the verbatim copies of the host fixtures, so a body the host changes turns
 * these red.
 */
type FixtureRefusal = {
  request: { method: string; path: string; body?: unknown };
  status: number;
  body?: Record<string, unknown>;
};

const fixture = <T,>(name: string): T =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8')) as T;

const writeRefusals = fixture<{ refusals: FixtureRefusal[] }>(
  'contact-write-refusals.v1.json',
).refusals;
const optOut = fixture<{
  request: { method: string; path: string; body: unknown };
  response: { status: number; body: unknown };
  refusals: FixtureRefusal[];
}>('contact-opt-out.v1.json');

const CONTACT_ID = '7a1c0e2b5d3f4a6b8c9d0e1f2a3b4c5d';

function refusalOf(refusal: FixtureRefusal | undefined): ApiError {
  if (!refusal) throw new Error('the fixture has no such refusal');
  return new ApiError(refusal.status, refusal.body ?? null);
}

/** The `data-error-code` of every error toast shown, in order. */
function shownErrorCodes(): string[] {
  return vi
    .mocked(toast.error)
    .mock.calls.map(
      ([shown]) =>
        (shown as React.ReactElement<{ 'data-error-code': string }>).props['data-error-code'],
    );
}

/** A client whose contact read and contact search are cached and fresh, as the consent page leaves them. */
function seededClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } },
  });
  qc.setQueryData(['contacts', CONTACT_ID], { id: CONTACT_ID });
  qc.setQueryData(['contacts', 'search', 'Ana'], [{ id: CONTACT_ID }]);
  qc.setQueryData(['contacts', 'search', 'Ruiz'], [{ id: CONTACT_ID }]);
  function seededWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, seededWrapper };
}

const invalidated = (qc: QueryClient, key: readonly unknown[]) =>
  qc.getQueryState(key)?.isInvalidated;

describe('contact writes report and refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('useCreateContact_ShouldToastNotPermitted_WhenPlatformRefusesTheCreate', async () => {
    const refusal = writeRefusals.find((r) => r.request.method === 'POST');
    vi.mocked(client.customFetch).mockRejectedValue(refusalOf(refusal));
    const { result } = renderHook(() => useCreateContact(), { wrapper });

    act(() => {
      result.current.mutate({ firstName: 'Ana', addresses: [] });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(shownErrorCodes()).toEqual(['not-permitted']);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('useUpdateContact_ShouldToastNotPermitted_WhenPlatformRefusesTheUpdate', async () => {
    const refusal = writeRefusals.find(
      (r) => r.request.method === 'PUT' && r.request.path === `/api/v1/contacts/${CONTACT_ID}`,
    );
    vi.mocked(client.customFetch).mockRejectedValue(refusalOf(refusal));
    const { result } = renderHook(() => useUpdateContact(), { wrapper });

    act(() => {
      result.current.mutate({ id: CONTACT_ID, doNotContact: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(shownErrorCodes()).toEqual(['not-permitted']);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('useDeleteContact_ShouldToastNotPermitted_WhenPlatformRefusesTheDelete', async () => {
    const refusal = writeRefusals.find((r) => r.request.method === 'DELETE');
    vi.mocked(client.customFetch).mockRejectedValue(refusalOf(refusal));
    const { result } = renderHook(() => useDeleteContact(), { wrapper });

    act(() => {
      result.current.mutate(CONTACT_ID);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(shownErrorCodes()).toEqual(['not-permitted']);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('useUpdateContact_ShouldToast404_WhenTheContactNoLongerExists', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(404, null));
    const { result } = renderHook(() => useUpdateContact(), { wrapper });

    act(() => {
      result.current.mutate({ id: CONTACT_ID, firstName: 'Ana' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(shownErrorCodes()).toEqual(['404']);
  });

  it('useUpdateContact_ShouldShowNoToast_WhenTheCallerReportsAndPlatformRefuses', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, contactNotPermittedRefusal));
    const { result } = renderHook(() => useUpdateContact({ report: 'caller' }), { wrapper });

    act(() => {
      result.current.mutate({ id: CONTACT_ID, doNotContact: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403, code: 'not-permitted' });
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('useUpdateContact_ShouldShowNoToast_WhenTheCallerReportsAndPlatformAccepts', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(consentContactVoiceAndEmailYes);
    const { qc, seededWrapper } = seededClient();
    const { result } = renderHook(() => useUpdateContact({ report: 'caller' }), {
      wrapper: seededWrapper,
    });

    act(() => {
      result.current.mutate({ id: CONTACT_ID, doNotContact: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    // The caller reports, but the refresh is the hook's own.
    expect(invalidated(qc, ['contacts', 'search', 'Ana'])).toBe(true);
  });

  it('useUpdateContact_ShouldSendTheGeneratedBodyAndInvalidateTheContactAndEverySearch_WhenPlatformAccepts', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(consentContactVoiceAndEmailYes);
    const { qc, seededWrapper } = seededClient();
    const { result } = renderHook(() => useUpdateContact(), { wrapper: seededWrapper });

    act(() => {
      result.current.mutate({ id: CONTACT_ID, ...consentEmailYesRequest });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: `/api/v1/contacts/${CONTACT_ID}`,
      method: 'PUT',
      data: { doNotContact: false, channelConsent: { Email: true } },
    });
    expect(invalidated(qc, ['contacts', CONTACT_ID])).toBe(true);
    expect(invalidated(qc, ['contacts', 'search', 'Ana'])).toBe(true);
    expect(invalidated(qc, ['contacts', 'search', 'Ruiz'])).toBe(true);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('useUpdateContact_ShouldInvalidateNothing_WhenPlatformRefuses', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new ApiError(403, contactNotPermittedRefusal));
    const { qc, seededWrapper } = seededClient();
    const { result } = renderHook(() => useUpdateContact(), { wrapper: seededWrapper });

    act(() => {
      result.current.mutate({ id: CONTACT_ID, doNotContact: true });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidated(qc, ['contacts', CONTACT_ID])).toBe(false);
    expect(invalidated(qc, ['contacts', 'search', 'Ana'])).toBe(false);
  });

  describe('useOptOutContact', () => {
    it('useOptOutContact_ShouldMatchTheFixture_WhenTheDoublesAreRead', () => {
      expect(optOutDoNotContactRequest).toEqual(optOut.refusals[0]?.request.body);
      expect(optOutDoNotContactAndSmsRequest).toEqual(optOut.request.body);
      expect(optOutResponse).toEqual(optOut.response.body);
    });

    it('useOptOutContact_ShouldPostExactlyDoNotContact_WhenTheCardMarksTheContact', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(optOutResponse);
      const { result } = renderHook(() => useOptOutContact(), { wrapper });

      act(() => {
        result.current.mutate({ id: CONTACT_ID, ...optOutDoNotContactRequest });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledTimes(1);
      const [config] = vi.mocked(client.customFetch).mock.calls[0] ?? [];
      expect(config?.url).toBe(optOut.refusals[0]?.request.path);
      expect(config?.method).toBe('POST');
      expect(JSON.parse(JSON.stringify(config?.data))).toEqual({ doNotContact: true });
      expect(result.current.data).toEqual(optOutResponse);
    });

    it('useOptOutContact_ShouldPostTheFixtureRequest_WhenAChannelIsNamed', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(optOutResponse);
      const { result } = renderHook(() => useOptOutContact(), { wrapper });

      act(() => {
        result.current.mutate({ id: CONTACT_ID, ...optOutDoNotContactAndSmsRequest });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(client.customFetch).toHaveBeenCalledWith({
        url: optOut.request.path,
        method: optOut.request.method,
        data: optOut.request.body,
      });
    });

    it('useOptOutContact_ShouldInvalidateTheContactAndEverySearchAndToastSuccess_WhenPlatformAnswers200', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(optOutResponse);
      const { qc, seededWrapper } = seededClient();
      const { result } = renderHook(() => useOptOutContact(), { wrapper: seededWrapper });

      act(() => {
        result.current.mutate({ id: CONTACT_ID, ...optOutDoNotContactRequest });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidated(qc, ['contacts', CONTACT_ID])).toBe(true);
      expect(invalidated(qc, ['contacts', 'search', 'Ana'])).toBe(true);
      expect(invalidated(qc, ['contacts', 'search', 'Ruiz'])).toBe(true);
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it.each([
      ['403', 403, 'not-permitted'],
      ['404', 404, '404'],
    ])(
      'useOptOutContact_ShouldToastTheMappedCode_WhenPlatformAnswersTheFixtureRefusal %s',
      async (_name, status, code) => {
        const refusal = optOut.refusals.find((r) => r.status === status);
        vi.mocked(client.customFetch).mockRejectedValue(refusalOf(refusal));
        const { qc, seededWrapper } = seededClient();
        const { result } = renderHook(() => useOptOutContact(), { wrapper: seededWrapper });

        act(() => {
          result.current.mutate({ id: CONTACT_ID, ...optOutDoNotContactRequest });
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(shownErrorCodes()).toEqual([code]);
        expect(toast.success).not.toHaveBeenCalled();
        expect(invalidated(qc, ['contacts', CONTACT_ID])).toBe(false);
      },
    );
  });
});
