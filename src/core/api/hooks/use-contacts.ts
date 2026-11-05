import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useReadRetry } from '@/core/api/read-retry';
import type { components } from '@/core/api/generated/openapi';
import { mapPlatformContact } from '@/core/api/platform-conversation';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/**
 * Kept hand-written (openapi-typed-client-agent): the document's `Contact` is a raw entity of a
 * different shape — no `id` (only `contactId`), `addresses` optional+nullable, `preferredChannel`
 * as the `ChannelType` enum. Consumers read `contact.id`, index `addresses` without a null-guard,
 * and bind `preferredChannel` to a plain-string form field, so a swap would not typecheck. A search
 * result and the single-contact read are mapped onto it at the data boundary by `mapPlatformContact`.
 */
export interface Contact {
  id: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  segment?: string;
  preferredChannel?: string;
  preferredLanguage?: string;
  timezone?: string;
  doNotContact?: boolean;
  channelConsent?: Record<string, boolean>;
  addresses: { channel: string; address: string }[];
  customFields?: Record<string, string>;
  createdAt: string;
  /** Computed by Platform and read-only: no contact write names it. Absent without a WebChat address. */
  identityLevel?: 'Verified' | 'Unverified' | 'Anonymous';
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['contacts', id],
    queryFn: async () =>
      mapPlatformContact(
        await customFetch<components['schemas']['Contact']>({
          url: `/api/v1/contacts/${id}`,
          method: 'GET',
        }),
      ),
    enabled: !!id,
  });
}

type ContactConversationPage = components['schemas']['PagedResultOfContactConversationSummaryDto'];
type ContactConversationSummary = components['schemas']['ContactConversationSummaryDto'];

/**
 * The loaded pages in served order, each `id` once. The list is offset-paged, so a conversation that
 * starts between two reads serves page 1's last row again as the first row of page 2.
 */
function summariesOf(
  data: InfiniteData<ContactConversationPage, number>,
): ContactConversationSummary[] {
  const seen = new Set<string>();
  return data.pages
    .flatMap((page) => page.items)
    .filter((summary) => {
      if (seen.has(summary.id)) return false;
      seen.add(summary.id);
      return true;
    });
}

/** A contact's conversations, newest first; `fetchNextPage` appends the next page while there is one. */
export function useContactConversations(contactId: string | undefined) {
  const retry = useReadRetry();
  return useInfiniteQuery({
    queryKey: ['contacts', contactId, 'conversations'],
    queryFn: ({ pageParam }) =>
      customFetch<ContactConversationPage>({
        url: `/api/v1/contacts/${contactId}/conversations`,
        method: 'GET',
        params: { page: String(pageParam), pageSize: '25' },
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasNextPage ? lastPage.page + 1 : undefined),
    select: summariesOf,
    enabled: !!contactId,
    retry,
  });
}

export function useSearchContacts(search: string) {
  return useQuery({
    queryKey: ['contacts', 'search', search],
    queryFn: async () => {
      const result = await customFetch<components['schemas']['PagedResultOfContact']>({
        url: '/api/v1/contacts',
        method: 'GET',
        params: { search, page: '1', pageSize: '20' },
      });
      return result.items.map(mapPlatformContact);
    },
    enabled: search.length >= 2,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: Omit<Contact, 'id' | 'createdAt' | 'identityLevel'>) =>
      customFetch<Contact>({
        url: '/api/v1/contacts',
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(t('toasts.contacts.created'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Omit<Contact, 'identityLevel'>> & { id: string }) =>
      customFetch<Contact>({
        url: `/api/v1/contacts/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['contacts', variables.id] });
      toast.success(t('toasts.contacts.updated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({
        url: `/api/v1/contacts/${id}`,
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(t('toasts.contacts.deleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
