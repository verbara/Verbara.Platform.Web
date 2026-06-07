import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StuckConversation } from '@/core/api/hooks/use-supervisor';

const mutate = vi.fn();

let stuckData: StuckConversation[] = [];

vi.mock('@/core/api/hooks/use-supervisor', () => ({
  useStuckConversations: () => ({ data: stuckData }),
  useReassignConversation: () => ({ mutate, isPending: false }),
}));

vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: () => ({ data: [{ id: 'q-1', name: 'Support' }] }),
}));

vi.mock('@/core/api/hooks/use-agents', () => ({
  useAgents: () => ({
    data: [
      { id: 'a-1', displayName: 'Alice', state: 'available' },
      { id: 'a-off', displayName: 'Bob', state: 'offline' },
    ],
  }),
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatDate: () => ({ formatRelative: () => '5 minutes ago' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const table: Record<string, string> = {
        'stuck_work.empty': 'No stuck conversations',
        'stuck_work.escalated': 'Escalated',
        'stuck_work.reassign': 'Reassign',
        'stuck_work.reassign_to_queue': 'Reassign to queue',
        'stuck_work.reassign_to_agent': 'Reassign to agent',
      };
      if (key === 'stuck_work.owned_by_offline') return `Owned by ${String(opts?.name)} (offline)`;
      if (key === 'stuck_work.stuck_for') return `Stuck for ${String(opts?.duration)}`;
      if (key === 'stuck_work.attempts') return `${String(opts?.count)} re-queue attempt(s)`;
      return table[key] ?? (opts?.defaultValue as string) ?? key;
    },
  }),
}));

import { StuckWorkTab } from './stuck-work-tab';

function makeStuck(overrides: Partial<StuckConversation> = {}): StuckConversation {
  return {
    conversationId: 'conv-1',
    channel: 'WhatsApp',
    state: 'Active',
    ownerAgentId: 'a-off',
    ownerAgentName: 'Bob',
    ownerOfflineSince: '2026-06-06T10:00:00Z',
    failoverAttempts: 0,
    escalated: false,
    ...overrides,
  };
}

describe('StuckWorkTab', () => {
  beforeEach(() => {
    mutate.mockReset();
    stuckData = [];
  });

  it('StuckWorkTab_ShouldListStuckConversations_WhenPresent', () => {
    stuckData = [
      makeStuck({ conversationId: 'conv-1', ownerAgentName: 'Bob' }),
      makeStuck({ conversationId: 'conv-2', ownerAgentName: 'Carol' }),
    ];
    render(<StuckWorkTab />);
    expect(screen.getAllByTestId('stuck-row')).toHaveLength(2);
    expect(screen.getByText('Owned by Bob (offline)')).toBeInTheDocument();
    expect(screen.getByText('Owned by Carol (offline)')).toBeInTheDocument();
  });

  it('StuckWorkTab_ShouldShowEscalatedBadge_WhenEscalated', () => {
    stuckData = [makeStuck({ escalated: true })];
    render(<StuckWorkTab />);
    expect(screen.getByTestId('stuck-escalated-badge')).toHaveTextContent('Escalated');
  });

  it('StuckWorkTab_ShouldShowEmptyState_WhenNone', () => {
    stuckData = [];
    render(<StuckWorkTab />);
    expect(screen.getByTestId('stuck-empty')).toHaveTextContent('No stuck conversations');
    expect(screen.queryByTestId('stuck-row')).not.toBeInTheDocument();
  });

  it('StuckWorkTab_ShouldCallReassign_WhenReassignToQueueChosen', async () => {
    stuckData = [makeStuck({ conversationId: 'conv-1' })];
    render(<StuckWorkTab />);
    fireEvent.click(screen.getByTestId('reassign-trigger-conv-1'));
    const queueItem = await screen.findByTestId('reassign-queue-q-1');
    fireEvent.click(queueItem);
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({ id: 'conv-1', targetQueueId: 'q-1' }),
    );
  });

  it('StuckWorkTab_ShouldCallReassign_WhenReassignToAgentChosen', async () => {
    stuckData = [makeStuck({ conversationId: 'conv-1' })];
    render(<StuckWorkTab />);
    fireEvent.click(screen.getByTestId('reassign-trigger-conv-1'));
    const agentItem = await screen.findByTestId('reassign-agent-a-1');
    fireEvent.click(agentItem);
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({ id: 'conv-1', targetAgentId: 'a-1' }),
    );
  });

  it('StuckWorkTab_ShouldFilterOfflineAgents_FromReassignTargets', async () => {
    stuckData = [makeStuck({ conversationId: 'conv-1' })];
    render(<StuckWorkTab />);
    fireEvent.click(screen.getByTestId('reassign-trigger-conv-1'));
    await screen.findByTestId('reassign-agent-a-1');
    expect(screen.queryByTestId('reassign-agent-a-off')).not.toBeInTheDocument();
  });
});
