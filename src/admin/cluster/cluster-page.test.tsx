import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// ─── Mocks ───────────────────────────────────────────────────────────────────
// i18n returns raw keys (with interpolation options appended) so assertions
// match key literals and the counts passed to them.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: unknown) =>
      opts && typeof opts === 'object' ? `${k}:${JSON.stringify(opts)}` : k,
    i18n: { language: 'en-US', changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/core/i18n/use-format', () => ({
  useFormatDate: () => ({ formatDateTime: () => 'date', formatDate: () => 'date' }),
}));

vi.mock('@/core/api/hooks/use-audit-events', () => ({
  useAuditEvents: () => ({ data: [], isLoading: false }),
}));

// Only the hooks are doubled; the state rules (`clusterNodeActions`) stay real.
vi.mock('@/core/api/hooks/use-cluster', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/hooks/use-cluster')>()),
  useClusterStatus: vi.fn(),
  useClusterNodes: vi.fn(),
  useClusterInstances: vi.fn(),
  useCreateNode: vi.fn(),
  useUpdateNode: vi.fn(),
  useDeleteNode: vi.fn(),
  useDrainNode: vi.fn(),
  useCancelDrain: vi.fn(),
  useForceDrain: vi.fn(),
}));

import { asMock } from '@/tests/utils/as-mock';
import {
  useClusterStatus,
  useClusterNodes,
  useClusterInstances,
  useCreateNode,
  useUpdateNode,
  useDeleteNode,
  useDrainNode,
  useCancelDrain,
  useForceDrain,
  type ClusterNode,
  type ClusterStatus,
} from '@/core/api/hooks/use-cluster';
import ClusterPage from './cluster-page';

// The wire shape: Platform's ManagementClusterEndpoints maps NodeState and
// DrainState with ToString().ToLowerInvariant(), so every state is lower case.
function makeNode(nodeId: string, state: ClusterNode['state']): ClusterNode {
  return {
    nodeId,
    state,
    weight: 100,
    priorityTier: 1,
    maxCapacity: 50,
    asteriskVersion: '22.3.0',
  };
}

const nodes: ClusterNode[] = [
  makeNode('node-healthy', 'healthy'),
  makeNode('node-degraded', 'degraded'),
  makeNode('node-draining', 'draining'),
  makeNode('node-offline', 'offline'),
  makeNode('node-unhealthy', 'unhealthy'),
  makeNode('node-unknown', 'unknown'),
];

const status: ClusterStatus = {
  instanceId: 'api-1',
  nodes,
  totalChannels: 3,
  totalAgents: 2,
  activeDrains: [
    {
      nodeId: 'node-draining',
      state: 'draining',
      startedAt: '2026-11-21T09:00:00Z',
      deadline: '2026-11-21T10:00:00Z',
      initialCallCount: 10,
      remainingCallCount: 4,
      naturallyCompleted: 5,
      forceDisconnected: 1,
    },
  ],
  instances: [],
};

const mutation = () => ({ mutate: vi.fn(), isPending: false });

beforeEach(() => {
  asMock(useClusterStatus).mockReturnValue({ data: status });
  asMock(useClusterNodes).mockReturnValue({ data: nodes });
  asMock(useClusterInstances).mockReturnValue({ data: [] });
  for (const hook of [
    useCreateNode,
    useUpdateNode,
    useDeleteNode,
    useDrainNode,
    useCancelDrain,
    useForceDrain,
  ]) {
    asMock(hook).mockReturnValue(mutation());
  }
});

// Base UI's menu trigger opens on press, so the full pointer sequence is fired
// (a bare click does not open it under jsdom).
async function menuItems(nodeId: string): Promise<string[]> {
  const trigger = screen.getByTestId(`cluster-node-${nodeId}-actions`);
  fireEvent.pointerDown(trigger);
  fireEvent.mouseDown(trigger);
  fireEvent.pointerUp(trigger);
  fireEvent.mouseUp(trigger);
  fireEvent.click(trigger);
  const menu = await screen.findByRole('menu');
  return within(menu)
    .queryAllByRole('menuitem')
    .map((item) => item.textContent ?? '');
}

describe('ClusterPage with the lower-case node states the API sends', () => {
  it('SummaryCard_ShouldCountHealthyNodes_WhenStatesAreLowerCase', () => {
    render(<ClusterPage />);
    expect(screen.getByTestId('cluster-summary-nodes').textContent).toContain(
      'cluster.summary.healthy:{"count":1}',
    );
  });

  it.each([
    ['node-healthy', ['cluster.actions.edit', 'cluster.actions.drain']],
    ['node-degraded', ['cluster.actions.edit', 'cluster.actions.drain']],
    ['node-draining', ['cluster.actions.cancel_drain', 'cluster.actions.force_drain']],
    ['node-offline', ['cluster.actions.edit', 'cluster.actions.remove']],
    ['node-unhealthy', ['cluster.actions.edit', 'cluster.actions.remove']],
    ['node-unknown', []],
  ])('RowMenu_ShouldOfferTheStateActions_WhenNodeIs %s', async (nodeId, expected) => {
    render(<ClusterPage />);
    expect(await menuItems(nodeId)).toEqual(expected);
  });

  it('DrainTab_ShouldShowProgress_WhenADrainingRowIsOpened', () => {
    render(<ClusterPage />);
    fireEvent.click(within(screen.getByTestId('cluster-nodes-table')).getByText('node-draining'));
    fireEvent.click(screen.getByRole('tab', { name: /drain/i }));
    expect(screen.getByTestId('cluster-node-detail-drain-bar').getAttribute('style')).toMatch(
      /width:\s*60%/,
    );
  });

  it('DrainBadge_ShouldNotFallBackToGray_WhenTheDrainIsCompleted', () => {
    asMock(useClusterStatus).mockReturnValue({
      data: { ...status, activeDrains: [{ ...status.activeDrains[0], state: 'completed' }] },
    });
    render(<ClusterPage />);
    const badge = within(screen.getByTestId('cluster-active-drains')).getByText(
      'status.cluster-node.completed',
    );
    expect(badge.className).toMatch(/bg-green-500\/20/);
  });
});
