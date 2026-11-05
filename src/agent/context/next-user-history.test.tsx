import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { useConversationStore, type Conversation } from '@/agent/stores/conversation-store';
import * as client from '@/core/api/client';
import { queryClient } from '@/core/api/query-client';
import { useAuthStore } from '@/core/auth/auth-store';
import { closedContactSummary, contactSummaryPage } from '@/tests/utils/contract-doubles';
import { ConversationHistory } from './conversation-history';

/**
 * Two people on one tab, with no reload between them (the user menu signs out with a route change):
 * the real tab, the app's one query client and the real sign-out. Only `customFetch` is answered.
 */

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

const CONTACT_ID = 'contact-1';
const LIST_URL = `/api/v1/contacts/${CONTACT_ID}/conversations`;
const PREVIOUS_ROW = closedContactSummary.id;
const NEXT_ROW = 'conversation-of-the-next-person';

function signIn(id: string) {
  useAuthStore
    .getState()
    .setAuth(
      `token-${id}`,
      Date.now() + 3600_000,
      { id, email: `${id}@x.io`, displayName: id, role: 'agent' },
      'tenant-1',
      [],
      {},
    );
}

function select() {
  useConversationStore.setState({
    selectedId: 'conv-1',
    conversations: { 'conv-1': { id: 'conv-1', contactId: CONTACT_ID } as Conversation },
  });
}

function renderTab() {
  return render(
    <QueryClientProvider client={queryClient}>
      <ConversationHistory />
    </QueryClientProvider>,
  );
}

const shownIds = () =>
  screen.queryAllByTestId('history-row').map((r) => r.getAttribute('data-conversation-id'));

describe('the next person on the same tab', () => {
  beforeEach(() => {
    vi.mocked(client.customFetch).mockReset();
    queryClient.clear();
  });

  afterEach(() => {
    cleanup();
    useAuthStore.getState().logout();
  });

  it('ConversationHistory_ShouldShowNoRowOfThePreviousPerson_WhenTheNextPersonOpensTheSameContact', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(contactSummaryPage);
    signIn('previous');
    select();
    const tab = renderTab();
    await waitFor(() => expect(shownIds()).toContain(PREVIOUS_ROW));
    tab.unmount();

    act(() => useAuthStore.getState().logout());

    // Still inside the app's `staleTime`, so a kept entry would be drawn with no request at all.
    let answer: (page: unknown) => void = () => undefined;
    vi.mocked(client.customFetch).mockImplementation(
      (config) =>
        new Promise((resolve) => {
          if (config.url === LIST_URL) answer = resolve;
        }),
    );
    signIn('next');
    select();
    renderTab();

    expect(shownIds()).toEqual([]);
    expect(screen.getByTestId('history-loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        vi.mocked(client.customFetch).mock.calls.filter(([c]) => c.url === LIST_URL),
      ).toHaveLength(2),
    );

    await act(async () =>
      answer({ ...contactSummaryPage, items: [{ ...closedContactSummary, id: NEXT_ROW }] }),
    );

    await waitFor(() => expect(shownIds()).toEqual([NEXT_ROW]));
  });
});
