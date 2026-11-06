import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { contactWriteRefusals } from '@/core/api/contact-write-refusals';
import { toastApiError } from '@/core/api/toast-api-error';
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

type PlatformContactBody = components['schemas']['Contact'];
type UpdateContactRequest = components['schemas']['UpdateContactRequest'];
type ContactOptOutRequest = components['schemas']['ContactOptOutRequest'];

/**
 * How a contact write reports its outcome. By default the hook shows its own success toast and, on a
 * refusal, the localized message of {@link contactWriteRefusals}. `'caller'` turns both off, for a
 * caller that reports many writes at once (the consent page's "Bulk set DNC", design W5).
 */
export interface ContactWriteOptions {
  report?: 'caller';
}

/**
 * Invalidates what a contact write changes: the contact itself and every cached contact search, so
 * a list that shows the contact reads it again (design W10). The search key starts with
 * `['contacts', 'search']`, which `['contacts', id]` never prefix-matches.
 */
function invalidateContact(qc: QueryClient, id: string) {
  void qc.invalidateQueries({ queryKey: ['contacts', id] });
  void qc.invalidateQueries({ queryKey: ['contacts', 'search'] });
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
    onError: (err: Error) => toastApiError(err, contactWriteRefusals, t),
  });
}

/** `PUT /api/v1/contacts/{id}` with the generated `UpdateContactRequest` body (design W3). */
export function useUpdateContact(options: ContactWriteOptions = {}) {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  const reportsItself = options.report !== 'caller';
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateContactRequest & { id: string }) =>
      customFetch<PlatformContactBody>({
        url: `/api/v1/contacts/${id}`,
        method: 'PUT',
        data,
      }),
    onSuccess: (_data, variables) => {
      invalidateContact(qc, variables.id);
      if (reportsItself) toast.success(t('toasts.contacts.updated'));
    },
    onError: (err: Error) => {
      if (reportsItself) toastApiError(err, contactWriteRefusals, t);
    },
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
    onError: (err: Error) => toastApiError(err, contactWriteRefusals, t),
  });
}

/**
 * `POST /api/v1/contacts/{id}/opt-out` (design W11): records that the contact asked not to be
 * contacted, answered with the contact as `GET` reads it. The route only restricts; it never clears
 * do-not-contact.
 */
export function useOptOutContact() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, ...data }: ContactOptOutRequest & { id: string }) =>
      customFetch<PlatformContactBody>({
        url: `/api/v1/contacts/${id}/opt-out`,
        method: 'POST',
        data,
      }),
    onSuccess: (_data, variables) => {
      invalidateContact(qc, variables.id);
      toast.success(t('toasts.contacts.opted_out'));
    },
    onError: (err: Error) => toastApiError(err, contactWriteRefusals, t),
  });
}
