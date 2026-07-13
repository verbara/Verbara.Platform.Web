import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CsatKpiCard } from './csat-kpi-card';
import type { CsatAggregateSummary } from '@/core/api/hooks/use-analytics';

// ── i18n stub: return the key with a tiny table for the copy under test. ──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const table: Record<string, string> = {
        'csat.title': 'CSAT',
        'csat.scope': 'All queues in your scope',
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

// ── Drive the card purely from the aggregate analytics hook's return. ──
const useCsatAggregateAnalytics = vi.fn();
vi.mock('@/core/api/hooks/use-analytics', () => ({
  useCsatAggregateAnalytics: () => useCsatAggregateAnalytics(),
}));

function summary(overrides: Partial<CsatAggregateSummary> = {}): CsatAggregateSummary {
  return {
    totalResponses: 128,
    averageRating: 4.4,
    rangeStart: '2026-07-06T00:00:00Z',
    rangeEnd: '2026-07-13T00:00:00Z',
    queues: [
      {
        queueName: 'support-tier1',
        channel: 'all',
        totalResponses: 97,
        averageRating: 4.5,
        rangeStart: '2026-07-06T00:00:00Z',
        rangeEnd: '2026-07-13T00:00:00Z',
      },
    ],
    ...overrides,
  };
}

describe('CsatKpiCard', () => {
  beforeEach(() => useCsatAggregateAnalytics.mockReset());

  it('should_RenderScopeWideScoreAndResponseCount_WhenScopeHasResponses', () => {
    // The Platform contract envelope fields are `averageRating` + `totalResponses`
    // (camelCase over the wire), aggregated across the whole scope — NOT a single
    // queue. The card must read the envelope roll-up or it silently degrades to
    // the empty state.
    useCsatAggregateAnalytics.mockReturnValue({ data: summary(), isLoading: false });

    render(<CsatKpiCard />);

    expect(screen.getByTestId('csat-kpi-score')).toHaveTextContent('4.4');
    expect(screen.getByTestId('csat-kpi-responses')).toHaveTextContent('128');
    // The score is scope-wide, so the card must label it as such (drops the
    // single-queue implication — csat-completion D4).
    expect(screen.getByTestId('csat-kpi-scope')).toHaveTextContent('All queues in your scope');
    expect(screen.queryByTestId('csat-kpi-empty')).not.toBeInTheDocument();
  });

  it('should_RenderEmptyState_WhenTotalResponsesIsZero', () => {
    // Platform returns `averageRating: 0` (NOT null) for a period with zero
    // responses, so the empty-state gate must key off `totalResponses`, not a
    // null score — otherwise an empty scope shows a misleading "0".
    useCsatAggregateAnalytics.mockReturnValue({
      data: summary({ totalResponses: 0, averageRating: 0, queues: [] }),
      isLoading: false,
    });

    render(<CsatKpiCard />);

    expect(screen.getByTestId('csat-kpi-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('csat-kpi-score')).not.toBeInTheDocument();
    expect(screen.queryByTestId('csat-kpi-responses')).not.toBeInTheDocument();
  });

  it('should_RenderLoadingSkeleton_WhenQueryIsLoading', () => {
    useCsatAggregateAnalytics.mockReturnValue({ data: undefined, isLoading: true });

    render(<CsatKpiCard />);

    expect(screen.getByTestId('csat-kpi-card-loading')).toBeInTheDocument();
  });
});
