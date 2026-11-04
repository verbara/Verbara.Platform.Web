import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationStore, type Conversation } from '@/agent/stores/conversation-store';
import * as client from '@/core/api/client';
import { closedContactSummary, contactSummaryPage } from '@/tests/utils/contract-doubles';
import { ConversationHistory } from './conversation-history';

/** The viewer's chunk no longer exists on the server: a deploy happened while the tab was open. */
vi.mock('./past-conversation-viewer', () => {
  throw new Error('Failed to fetch dynamically imported module');
});
vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

/** What the area boundary would replace if the failure got out of the `Sheet`. */
function Workspace() {
  return <div data-testid="live-workspace" />;
}

describe('ConversationHistory when the viewer cannot load', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(client.customFetch).mockResolvedValue(contactSummaryPage);
    useConversationStore.setState({
      selectedId: 'conv-1',
      conversations: { 'conv-1': { id: 'conv-1', contactId: 'contact-1' } as Conversation },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('ViewerLoad_ShouldShowTheGenericErrorInsideTheSheet_WhenTheChunkFailsToLoad', async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Workspace />
        <ConversationHistory />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.queryAllByTestId('history-row').length).toBeGreaterThan(0));
    const row = screen
      .getAllByTestId('history-row')
      .find((r) => r.getAttribute('data-conversation-id') === closedContactSummary.id)!;

    fireEvent.click(row);

    const refusal = await screen.findByTestId('read-refusal');
    expect(refusal).toHaveAttribute('data-refusal', 'read-failed');
    expect(refusal).toHaveTextContent('common:errors.route_error_fallback');
    expect(screen.getByTestId('history-viewer-close')).toBeInTheDocument();
    expect(screen.getByTestId('live-workspace')).toBeInTheDocument();
    expect(screen.getByTestId('history-list')).toBeInTheDocument();
  });
});
