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
  type ContactConversation,
} from './use-contacts';

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

const sampleConversation: ContactConversation = {
  id: 'conv-1',
  channel: 'voice',
  queueName: 'Sales',
  disposition: 'Sale',
  durationSeconds: 120,
  closedAt: '2026-01-01T01:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('use-contacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useContact', () => {
    it('should fetch contact when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue(sampleContact);
      const { result } = renderHook(() => useContact('contact-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(sampleContact);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/contacts/contact-1',
        method: 'GET',
      });
    });

    it('should not fetch when id is undefined', () => {
      const { result } = renderHook(() => useContact(undefined), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useContactConversations', () => {
    it('should fetch conversations when called', async () => {
      vi.mocked(client.customFetch).mockResolvedValue({
        items: [sampleConversation],
        totalCount: 1,
        page: 1,
        pageSize: 20,
      });
      const { result } = renderHook(() => useContactConversations('contact-1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([sampleConversation]);
      expect(client.customFetch).toHaveBeenCalledWith({
        url: '/api/v1/contacts/contact-1/conversations',
        method: 'GET',
        params: { page: '1', pageSize: '20' },
      });
    });

    it('should not fetch when contactId is undefined', () => {
      const { result } = renderHook(() => useContactConversations(undefined), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useSearchContacts', () => {
    it('should fetch contacts when search has 2+ chars', async () => {
      vi.mocked(client.customFetch).mockResolvedValue({
        items: [sampleContact],
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
