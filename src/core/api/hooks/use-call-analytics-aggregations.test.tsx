import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/core/api/client', () => ({
  customFetch: vi.fn(),
}));

import * as client from '@/core/api/client';
import {
  useTopicTrends,
  useSentimentTrends,
  useComplianceSummary,
  type TopicTrendsResponse,
  type SentimentTrendsResponse,
  type ComplianceSummaryResponse,
} from './use-analytics';

const mockCustomFetch = client.customFetch as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe('useTopicTrends', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches_topic_trends_with_correct_url_and_params', async () => {
    const response: TopicTrendsResponse = {
      trends: [{ topic: 'Billing', occurrences: 42, avgConfidence: 0.91 }],
      totalAnalyzed: 100,
    };
    mockCustomFetch.mockResolvedValue(response);

    const { result } = renderHook(() => useTopicTrends('2026-04-01', '2026-04-30', 25), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCustomFetch).toHaveBeenCalledWith({
      url: '/api/v1/call-analytics/topics/trends',
      method: 'GET',
      params: { from: '2026-04-01', to: '2026-04-30', topN: '25' },
    });
    expect(result.current.data).toEqual(response);
  });
});

describe('useSentimentTrends', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches_sentiment_trends_with_correct_url_and_params', async () => {
    const response: SentimentTrendsResponse = {
      points: [
        {
          bucketStart: '2026-04-01T00:00:00Z',
          avgSentimentScore: 0.6,
          positiveCount: 50,
          neutralCount: 30,
          negativeCount: 10,
          totalCount: 90,
        },
      ],
      bucket: 'week',
      from: '2026-04-01',
      to: '2026-04-30',
    };
    mockCustomFetch.mockResolvedValue(response);

    const { result } = renderHook(
      () => useSentimentTrends('2026-04-01', '2026-04-30', 'week', 'support'),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCustomFetch).toHaveBeenCalledWith({
      url: '/api/v1/call-analytics/sentiment/trends',
      method: 'GET',
      params: { from: '2026-04-01', to: '2026-04-30', bucket: 'week', queueName: 'support' },
    });
    expect(result.current.data).toEqual(response);
  });
});

describe('useComplianceSummary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetches_compliance_summary_with_correct_url_and_params', async () => {
    const response: ComplianceSummaryResponse = {
      rules: [
        {
          ruleId: 'r1',
          ruleName: 'PCI Disclaimer',
          severity: 'Critical',
          occurrences: 7,
          sessionsAffected: 5,
          firstSeen: '2026-04-01T00:00:00Z',
          lastSeen: '2026-04-20T00:00:00Z',
        },
      ],
      totalViolations: 7,
      totalSessionsWithViolations: 5,
      severityBreakdown: { critical: 7, warning: 0, info: 0 },
      from: '2026-04-01',
      to: '2026-04-30',
    };
    mockCustomFetch.mockResolvedValue(response);

    const { result } = renderHook(
      () => useComplianceSummary('2026-04-01', '2026-04-30', 'support', 'Critical'),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockCustomFetch).toHaveBeenCalledWith({
      url: '/api/v1/call-analytics/compliance/summary',
      method: 'GET',
      params: {
        from: '2026-04-01',
        to: '2026-04-30',
        queueName: 'support',
        severity: 'Critical',
      },
    });
    expect(result.current.data).toEqual(response);
  });
});
