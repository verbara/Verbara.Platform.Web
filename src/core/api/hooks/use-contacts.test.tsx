import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import {
  useContact,
  useContactConversations,
  useSearchContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  type Contact,
} from './use-contacts';

import { ApiError } from '@/core/api/api-error';
import {
  contactLevelOne,
  contactSummaryFirstOfTwoPages,
  contactSummaryPage,
  contactSummaryShiftedSecondPage,
  contactWithoutWebChat,
  notReadableRefusal,
} from '@/tests/utils/contract-doubles';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

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
