import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { toast } from 'sonner';

export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  segment?: string;
  preferredChannel?: string;
  preferredLanguage?: string;
  timezone?: string;
  addresses: { channel: string; address: string }[];
  customFields?: Record<string, string>;
  createdAt: string;
}

interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: () =>
      customFetch<Contact>({
        url: `/api/v1/contacts/${id}`,
        method: 'GET',
      }),
    enabled: !!id,
  });
}

export interface ContactConversation {
  id: string;
  channel: string;
  queueName: string;
  disposition?: string;
  durationSeconds?: number;
  closedAt?: string;
  createdAt: string;
}

export function useContactConversations(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contacts', contactId, 'conversations'],
    queryFn: async () => {
      const result = await customFetch<PagedResult<ContactConversation>>({
        url: `/api/v1/contacts/${contactId}/conversations`,
        method: 'GET',
        params: { page: '1', pageSize: '20' },
      });
      return result.items;
    },
    enabled: !!contactId,
  });
}

export function useSearchContacts(search: string) {
  return useQuery({
    queryKey: ['contacts', 'search', search],
    queryFn: async () => {
      const result = await customFetch<PagedResult<Contact>>({
        url: '/api/v1/contacts',
        method: 'GET',
        params: { search, page: '1', pageSize: '20' },
      });
      return result.items;
    },
    enabled: search.length >= 2,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Contact, 'id' | 'createdAt'>) =>
      customFetch<Contact>({
        url: '/api/v1/contacts',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Contact> & { id: string }) =>
      customFetch<Contact>({
        url: `/api/v1/contacts/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['contacts', variables.id] });
      toast.success('Contact updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
