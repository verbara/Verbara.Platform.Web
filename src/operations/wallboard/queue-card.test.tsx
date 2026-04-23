import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueueCard } from './queue-card';
import type { QueueMetrics } from '@/operations/stores/queue-metrics-store';

// Stub react-i18next so the component renders without the HTTP backend.
// Returns the requested key with a small translation table for the values
// under test. Every other key is returned as-is (which is fine for labels
// we don't assert against).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const table: Record<string, string> = {
        'notAvailable.value': '—',
        'notAvailable.tooltip': 'Metrics unavailable',
        'wallboard.waiting': 'Waiting',
        'wallboard.avg_wait': 'Avg. wait',
        'wallboard.longest_wait': 'Longest wait',
        'wallboard.available': 'Available',
        'wallboard.busy': 'Busy',
        'wallboard.away': 'Away',
        'wallboard.sla': 'SLA',
        'wallboard.wrap_up': 'Wrap-up',
      };
      return table[key] ?? key;
    },
  }),
}));

// No live SignalR state in unit tests — always undefined so the queue
// metrics from the API are the sole source of truth.
vi.mock('@/core/api/hooks/use-analytics', () => ({
  useLiveState: () => ({ data: undefined }),
}));

const baseQueue: QueueMetrics = {
  queueId: 'queue-001',
  queueName: 'support',
  waiting: 5,
  avgWaitSeconds: 32,
  slaPercent: 82,
  agentsAvailable: 3,
  agentsBusy: 2,
  agentsAway: 1,
};

describe('QueueCard', () => {
  it('should_RenderRealWaitingValue_WhenQueueMetricsProvided', () => {
    render(<QueueCard queue={baseQueue} />);
    expect(screen.getByTestId('queue-card-waiting-value')).toHaveTextContent('5');
  });

  it('should_RenderEmDashPlaceholder_WhenWaitingIsNull', () => {
    render(<QueueCard queue={{ ...baseQueue, waiting: null, avgWaitSeconds: null }} />);
    const placeholder = screen.getByTestId('queue-card-waiting-unavailable');
    expect(placeholder).toHaveTextContent('—');
    // And the value variant must NOT be present.
    expect(screen.queryByTestId('queue-card-waiting-value')).not.toBeInTheDocument();
  });

  it('should_RenderEmDashForBothWaitingAndWait_WhenBothAreNull', () => {
    render(<QueueCard queue={{ ...baseQueue, waiting: null, avgWaitSeconds: null }} />);
    expect(screen.getByTestId('queue-card-waiting-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('queue-card-wait-unavailable')).toBeInTheDocument();
  });
});
