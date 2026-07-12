import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsatKpiCard } from './csat-kpi-card';
import type { CsatQueueSummary } from '@/core/api/hooks/use-analytics';

// ── i18n stub: return the key with a tiny table for the copy under test. ──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const table: Record<string, string> = {
        'csat.title': 'CSAT',
        'csat.empty': 'No responses yet',
        'csat.responses': 'Responses',
      };
      return table[key] ?? key;
    },
  }),
}));

// ── formatNumber stub: stringify so assertions are locale-agnostic. ──
vi.mock('@/core/i18n/use-format', () => ({
  useFormatNumber: () => ({ formatNumber: (n: number) => String(n) }),
}));

// ── Drive the card purely from the analytics hook's return. ──
const useCsatQueueAnalytics = vi.fn();
vi.mock('@/core/api/hooks/use-analytics', () => ({
  useCsatQueueAnalytics: (queueId: string | undefined) => useCsatQueueAnalytics(queueId),
}));

function summary(overrides: Partial<CsatQueueSummary> = {}): CsatQueueSummary {
  return {
    queueName: 'support',
    channel: 'webchat',
    totalResponses: 8,
    averageRating: 4.5,
    rangeStart: '2026-07-01T00:00:00Z',
    rangeEnd: '2026-07-12T00:00:00Z',
    ...overrides,
  };
}

describe('CsatKpiCard', () => {
  beforeEach(() => useCsatQueueAnalytics.mockReset());

  it('should_RenderScoreAndResponseCount_WhenQueueHasResponses', () => {
    // The Platform contract fields are `averageRating` + `totalResponses`
    // (camelCase over the wire) — NOT `avgScore`/`responseCount`. The card must
    // read the real fields or it silently degrades to the empty state.
    useCsatQueueAnalytics.mockReturnValue({ data: summary(), isLoading: false });

    render(<CsatKpiCard queueId="queue-001" />);

    expect(screen.getByTestId('csat-kpi-score')).toHaveTextContent('4.5');
    expect(screen.getByTestId('csat-kpi-responses')).toHaveTextContent('8');
    expect(screen.queryByTestId('csat-kpi-empty')).not.toBeInTheDocument();
  });

  it('should_RenderEmptyState_WhenTotalResponsesIsZero', () => {
    // Platform returns `averageRating: 0` (NOT null) for a period with zero
    // responses, so the empty-state gate must key off `totalResponses`, not a
    // null score — otherwise an empty queue shows a misleading "0".
    useCsatQueueAnalytics.mockReturnValue({
      data: summary({ totalResponses: 0, averageRating: 0 }),
      isLoading: false,
    });

    render(<CsatKpiCard queueId="queue-001" />);

    expect(screen.getByTestId('csat-kpi-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('csat-kpi-score')).not.toBeInTheDocument();
    expect(screen.queryByTestId('csat-kpi-responses')).not.toBeInTheDocument();
  });

  it('should_RenderLoadingSkeleton_WhenQueryIsLoading', () => {
    useCsatQueueAnalytics.mockReturnValue({ data: undefined, isLoading: true });

    render(<CsatKpiCard queueId="queue-001" />);

    expect(screen.getByTestId('csat-kpi-card-loading')).toBeInTheDocument();
  });
});
