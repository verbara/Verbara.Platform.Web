import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useAuthStore } from '@/core/auth/auth-store';
import { customFetch } from '@/core/api/client';
import { ApiError } from '@/core/api/api-error';
import type { components } from '@/core/api/generated/openapi';
import { consentContactVoiceYes, contactNotPermittedRefusal } from '@/tests/utils/contract-doubles';
import enAdmin from '../../../public/locales/en-US/admin.json';

/**
 * "Bulk set DNC" on the real `useSearchContacts` and `useUpdateContact` (design W5, W10), with only
 * `customFetch` replaced: the page waits for every answer, then reports once per distinct refusal code
 * and once for the successes, keeps the refused contacts selected and closes the confirm.
 */

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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
// The dialog's 3-second countdown is its own concern (confirm-delete-dialog tests); here it confirms at once.
vi.mock('@/core/ui/confirm-delete-dialog', () => ({
  ConfirmDeleteDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <div data-testid="bulk-confirm">
        <button data-testid="bulk-confirm-btn" onClick={onConfirm}>
          confirm
        </button>
      </div>
    ) : null,
}));

import ConsentManagementPage from './consent-management-page';

type PlatformContact = components['schemas']['Contact'];

/** `count` contacts shaped as the fixture double, each with its own id and first name. */
function contactsOf(count: number): PlatformContact[] {
  return Array.from({ length: count }, (_, i) => ({
    ...consentContactVoiceYes,
    contactId: `0000000000000000000000000000000${i + 1}`,
    firstName: `Contact${i + 1}`,
  }));
}

function pageOf(items: PlatformContact[]): components['schemas']['PagedResultOfContact'] {
  return {
    items,
    totalCount: items.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

interface FetchCall {
  url: string;
  method: string;
  data?: unknown;
}

type Answer = { ok: true } | { ok: false; error: ApiError };

interface Held {
  id: string;
  release: () => void;
}

/**
 * Platform as the test scripts it: the search answers the contacts, each `PUT` answers per `answers`
 * (by contact id), and once a `PUT` succeeds the search reports that contact as do-not-contact. With
 * `hold`, every `PUT` waits until the test releases it.
 */
function answerLikePlatform(
  contacts: PlatformContact[],
  answers: Record<string, Answer>,
  hold = false,
): Held[] {
  const marked = new Set<string>();
  const held: Held[] = [];
  vi.mocked(customFetch).mockImplementation((config) => {
    const { url, method } = config as FetchCall;
    if (method === 'GET' && url === '/api/v1/contacts') {
      return Promise.resolve(
        pageOf(contacts.map((c) => ({ ...c, doNotContact: marked.has(String(c.contactId)) }))),
      );
    }
    const id = url.replace('/api/v1/contacts/', '');
    if (method === 'PUT' && answers[id]) {
      const answer = answers[id];
      return new Promise((resolve, reject) => {
        const settle = () => {
          if (answer.ok) {
            marked.add(id);
            resolve(contacts.find((c) => c.contactId === id));
          } else {
            reject(answer.error);
          }
        };
        if (hold) held.push({ id, release: settle });
        else settle();
      });
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  return held;
}

const notPermitted = (): Answer => ({
  ok: false,
  error: new ApiError(403, contactNotPermittedRefusal),
});
const notFound = (): Answer => ({ ok: false, error: new ApiError(404, null) });
const ok = (): Answer => ({ ok: true });

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <ConsentManagementPage />
    </QueryClientProvider>,
  );
}

function rowOf(firstName: string): HTMLElement {
  return screen.getByText(`${firstName} Ruiz`).closest('tr')!;
}

function checkboxOf(firstName: string): HTMLElement {
  return within(rowOf(firstName)).getByRole('checkbox');
}

function selectedNames(contacts: PlatformContact[]): string[] {
  return contacts
    .map((c) => c.firstName!)
    .filter((name) => checkboxOf(name).getAttribute('aria-checked') === 'true');
}

/** Searches, selects every contact and confirms "Bulk set DNC". */
async function confirmBulkOn(contacts: PlatformContact[]) {
  renderPage();
  fireEvent.change(screen.getByTestId('consent-search'), { target: { value: 'Contact' } });
  await screen.findByText(`${contacts[0]!.firstName!} Ruiz`, {}, { timeout: 2000 });
  for (const c of contacts) fireEvent.click(checkboxOf(c.firstName!));
  await waitFor(() => expect(selectedNames(contacts)).toHaveLength(contacts.length));
  fireEvent.click(screen.getByTestId('bulk-dnc-btn'));
  fireEvent.click(screen.getByTestId('bulk-confirm-btn'));
}

/** The `data-error-code` of every error toast shown. */
function errorCodes(): string[] {
  return vi.mocked(toast.error).mock.calls.map(([message]) => {
    const { container } = render(message as ReactElement);
    const code = container.querySelector('[data-error-code]')?.getAttribute('data-error-code');
    return code ?? '(none)';
  });
}

function putCount(): number {
  return vi
    .mocked(customFetch)
    .mock.calls.filter(([config]) => (config as FetchCall).method === 'PUT').length;
}

const updatedTwo = enAdmin.consent.bulk.updated_other.replace('{{count}}', '2');

describe('ConsentManagementPage, Bulk set DNC on the real contact hooks', () => {
  beforeEach(() => {
    vi.mocked(customFetch).mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    useAuthStore.setState({ permissions: ['contacts:contact:edit'] });
  });

  afterEach(() => {
    cleanup();
  });

  it('bulkDnc_ShouldReportOneRefusalAndOneSuccessAndKeepTheRefusedSelected_WhenOneOfThreeIsRefused', async () => {
    const contacts = contactsOf(3);
    const [c1, c2, c3] = contacts.map((c) => String(c.contactId));
    answerLikePlatform(contacts, { [c1!]: ok(), [c2!]: notPermitted(), [c3!]: ok() });

    await confirmBulkOn(contacts);

    await waitFor(() => expect(screen.queryByTestId('bulk-confirm')).toBeNull());
    expect(putCount()).toBe(3);
    for (const [config] of vi.mocked(customFetch).mock.calls) {
      if ((config as FetchCall).method === 'PUT') {
        expect((config as FetchCall).data).toEqual({ doNotContact: true });
      }
    }
    expect(errorCodes()).toEqual(['not-permitted']);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(updatedTwo);
    expect(selectedNames(contacts)).toEqual(['Contact2']);
  });

  it('bulkDnc_ShouldReportEachDistinctCodeOnce_WhenRefusalsRepeatAndDiffer', async () => {
    const contacts = contactsOf(5);
    const [c1, c2, c3, c4, c5] = contacts.map((c) => String(c.contactId));
    answerLikePlatform(contacts, {
      [c1!]: notPermitted(),
      [c2!]: ok(),
      [c3!]: notPermitted(),
      [c4!]: notFound(),
      [c5!]: ok(),
    });

    await confirmBulkOn(contacts);

    await waitFor(() => expect(screen.queryByTestId('bulk-confirm')).toBeNull());
    expect(putCount()).toBe(5);
    expect(errorCodes().sort()).toEqual(['404', 'not-permitted']);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(updatedTwo);
    expect(selectedNames(contacts)).toEqual(['Contact1', 'Contact3', 'Contact4']);
  });

  it('bulkDnc_ShouldReportNothingUntilTheLastAnswerSettles_WhenAnswersSettleOutOfOrder', async () => {
    const contacts = contactsOf(3);
    const [c1, c2, c3] = contacts.map((c) => String(c.contactId));
    const held = answerLikePlatform(
      contacts,
      { [c1!]: notPermitted(), [c2!]: ok(), [c3!]: ok() },
      true,
    );

    await confirmBulkOn(contacts);
    await waitFor(() => expect(held).toHaveLength(3));

    // Last-first: the third, then the second, each a success; the first, refused, settles last.
    const byId = (id: string) => held.find((h) => h.id === id)!;
    for (const id of [c3!, c2!]) {
      byId(id).release();
      // Let the settled answer run through the mutation and every render it causes.
      await new Promise((r) => setTimeout(r, 50));
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(selectedNames(contacts)).toEqual(['Contact1', 'Contact2', 'Contact3']);
      expect(screen.getByTestId('bulk-confirm')).toBeInTheDocument();
    }

    byId(c1!).release();

    await waitFor(() => expect(screen.queryByTestId('bulk-confirm')).toBeNull());
    expect(errorCodes()).toEqual(['not-permitted']);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(updatedTwo);
    expect(selectedNames(contacts)).toEqual(['Contact1']);
  });
  it('bulkDnc_ShouldShowTheDoNotContactBadgeOnBothRowsWithoutReload_WhenBothAnswer200', async () => {
    const contacts = contactsOf(2);
    const [c1, c2] = contacts.map((c) => String(c.contactId));
    answerLikePlatform(contacts, { [c1!]: ok(), [c2!]: ok() });

    renderPage();
    fireEvent.change(screen.getByTestId('consent-search'), { target: { value: 'Contact' } });
    await screen.findByText('Contact1 Ruiz', {}, { timeout: 2000 });
    expect(screen.queryAllByTestId('dnc-badge')).toHaveLength(0);
    for (const c of contacts) fireEvent.click(checkboxOf(c.firstName!));
    fireEvent.click(screen.getByTestId('bulk-dnc-btn'));
    fireEvent.click(screen.getByTestId('bulk-confirm-btn'));

    await waitFor(() => expect(screen.queryByTestId('bulk-confirm')).toBeNull());
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith(updatedTwo);
    expect(toast.error).not.toHaveBeenCalled();
    // The search is read again on the same page, with no reload, and both rows carry the badge.
    await waitFor(() => {
      expect(within(rowOf('Contact1')).getByTestId('dnc-badge')).toBeInTheDocument();
      expect(within(rowOf('Contact2')).getByTestId('dnc-badge')).toBeInTheDocument();
    });
    const searches = vi
      .mocked(customFetch)
      .mock.calls.filter(([config]) => (config as FetchCall).method === 'GET');
    expect(searches.length).toBeGreaterThanOrEqual(2);
    expect(selectedNames(contacts)).toEqual([]);
  });
});
