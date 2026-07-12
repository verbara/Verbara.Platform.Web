import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

import {
  useDashboard,
  useCdrList,
  useCdrDetail,
  useQaList,
  useQaDetail,
  useTranscript,
  useIntervals,
  useAllLiveStates,
  useLiveState,
  useCurrentInterval,
  useAgentIntervals,
  useTopicTrends,
  useSentimentTrends,
  useComplianceSummary,
  useBotAnalytics,
  useCsatQueueAnalytics,
} from './use-analytics';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDashboard', () => {
  it('should fetch dashboard data successfully', async () => {
    const mockData = {
      kpis: {
        conversationsHandled: 100,
        avgWaitMs: 5000,
        avgHandleTimeMs: 60000,
        slaPercent: 85,
        abandonRatePercent: 5,
      },
      volumeTrend: [{ label: '10:00', value: 50 }],
      slaTrend: [{ label: '10:00', value: 90 }],
      channelDistribution: [{ channel: 'voice', count: 80 }],
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboard('2026-01-01', '2026-01-31', 'support'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/dashboard',
      method: 'GET',
      params: { from: '2026-01-01', to: '2026-01-31', queue: 'support' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Network error');
  });
});

describe('useCdrList', () => {
  it('should fetch CDR list with filters', async () => {
    const mockData = {
      items: [
        {
          sessionId: 's1',
          startTime: '2026-01-01',
          endTime: '2026-01-01',
          channel: 'voice',
          durationMs: 120000,
          disposition: 'answered',
          slaMet: true,
          hasQaScore: false,
          hasRecording: true,
          holdCount: 0,
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 50,
      hasNextPage: false,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useCdrList('2026-01-01', '2026-01-31', { queue: 'sales' }, 2),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockData);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/cdr',
      method: 'GET',
      params: { from: '2026-01-01', to: '2026-01-31', queue: 'sales', page: '2', pageSize: '50' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useCdrList(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCdrDetail', () => {
  it('should fetch CDR detail when sessionId is provided', async () => {
    const mockData = {
      cdr: { sessionId: 's1' },
      timeline: [],
      transferCount: 0,
      hasTranscript: false,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCdrDetail('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/cdr/s1',
      method: 'GET',
    });
  });

  it('should be disabled when sessionId is empty', () => {
    const { result } = renderHook(() => useCdrDetail(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useQaList', () => {
  it('should fetch QA list', async () => {
    const mockData = {
      items: [
        {
          sessionId: 's1',
          analyzedAt: '2026-01-01',
          qaScore: 85,
          hasComplianceViolations: false,
          violationCount: 0,
          topics: [],
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 50,
      hasNextPage: false,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useQaList('2026-01-01', '2026-01-31', { minScore: 70 }, 1),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/qa',
      method: 'GET',
      params: { from: '2026-01-01', to: '2026-01-31', minScore: '70', page: '1', pageSize: '50' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));

    const { result } = renderHook(() => useQaList(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useQaDetail', () => {
  it('should fetch QA detail when sessionId is provided', async () => {
    const mockData = {
      sessionId: 's1',
      analyzedAt: '2026-01-01',
      qaScore: 90,
      maxPossibleScore: 100,
      criteria: [],
      violations: [],
      allTopics: [],
      sentimentTimeline: [],
      actionItems: [],
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useQaDetail('s1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/qa/s1',
      method: 'GET',
    });
  });

  it('should be disabled when sessionId is empty', () => {
    const { result } = renderHook(() => useQaDetail(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useTranscript', () => {
  it('should fetch transcript when enabled', async () => {
    const mockData = [{ startTime: 0, endTime: 5, speaker: 'agent', text: 'Hello' }];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useTranscript('s1', true), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/cdr/s1/transcript',
      method: 'GET',
    });
  });

  it('should be disabled when enabled is false', () => {
    const { result } = renderHook(() => useTranscript('s1', false), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should be disabled when sessionId is empty', () => {
    const { result } = renderHook(() => useTranscript('', true), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useIntervals', () => {
  it('should fetch interval data', async () => {
    const mockData = [
      {
        queueName: 'support',
        intervalStart: '2026-01-01T10:00:00Z',
        intervalSeconds: 1800,
        callsOffered: 50,
        callsAnswered: 45,
        callsAbandoned: 5,
        slaPercent: 90,
        asaMs: 3000,
        ahtMs: 180000,
        abandonRatePercent: 10,
        slaMetCount: 45,
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useIntervals('2026-01-01', '2026-01-31', 'support'), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/intervals',
      method: 'GET',
      params: { from: '2026-01-01', to: '2026-01-31', queue: 'support' },
    });
  });
});

describe('useAllLiveStates', () => {
  it('should fetch all live states', async () => {
    const mockData = [
      {
        queueName: 'support',
        callsWaiting: 3,
        longestWaitMs: 15000,
        agentsAvailable: 5,
        agentsOnCall: 3,
        agentsPaused: 1,
        agentsInWrapUp: 0,
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useAllLiveStates(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/live',
      method: 'GET',
    });
  });
});

describe('useLiveState', () => {
  it('should fetch live state for a queue', async () => {
    const mockData = {
      queueName: 'support',
      callsWaiting: 2,
      longestWaitMs: 10000,
      agentsAvailable: 4,
      agentsOnCall: 2,
      agentsPaused: 0,
      agentsInWrapUp: 1,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useLiveState('support'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/live/support',
      method: 'GET',
    });
  });

  it('should be disabled when queueName is empty', () => {
    const { result } = renderHook(() => useLiveState(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCurrentInterval', () => {
  it('should fetch current interval with queue', async () => {
    const mockData = {
      intervalStart: '2026-01-01T10:00:00Z',
      intervalEnd: '2026-01-01T10:30:00Z',
      callsOffered: 20,
      callsAnswered: 18,
      callsAbandoned: 2,
      ahtMs: 180000,
      asaMs: 5000,
      slaPercent: 90,
      abandonRatePercent: 10,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCurrentInterval('support'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/current-interval?queueName=support',
      method: 'GET',
    });
  });

  it('should use default queue when none provided', async () => {
    vi.mocked(client.customFetch).mockResolvedValue({});

    const { result } = renderHook(() => useCurrentInterval(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/current-interval?queueName=default',
      method: 'GET',
    });
  });
});

describe('useAgentIntervals', () => {
  it('should fetch agent intervals', async () => {
    const mockData = [
      {
        agentId: 'a1',
        intervalStart: '2026-01-01T10:00:00Z',
        intervalSeconds: 1800,
        callsHandled: 10,
        ahtMs: 180000,
        occupancyPercent: 75,
        rnaCount: 1,
        transfers: 0,
        totalPauseMs: 5000,
        loginDurationMs: 28800000,
      },
    ];
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useAgentIntervals({ from: '2026-01-01', to: '2026-01-31', agentId: 'a1' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/intervals/agents?from=2026-01-01&to=2026-01-31&agentId=a1',
      method: 'GET',
    });
  });
});

describe('useTopicTrends', () => {
  it('should fetch topic trends', async () => {
    const mockData = {
      topics: [{ topic: 'billing', occurrences: 50, avgConfidence: 0.85 }],
      totalAnalyzed: 100,
      from: '2026-01-01',
      to: '2026-01-31',
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useTopicTrends('2026-01-01', '2026-01-31', 5), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/call-analytics/topics/trends',
      method: 'GET',
      params: { from: '2026-01-01', to: '2026-01-31', topN: '5' },
    });
  });
});

describe('useSentimentTrends', () => {
  it('should fetch sentiment trends', async () => {
    const mockData = {
      points: [
        {
          bucketStart: '2026-01-01',
          avgSentimentScore: 0.6,
          positiveCount: 30,
          neutralCount: 50,
          negativeCount: 20,
          totalCount: 100,
        },
      ],
      bucket: 'day',
      from: '2026-01-01',
      to: '2026-01-31',
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useSentimentTrends('2026-01-01', '2026-01-31', 'week', 'support'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/call-analytics/sentiment/trends',
      method: 'GET',
      params: { from: '2026-01-01', to: '2026-01-31', bucket: 'week', queueName: 'support' },
    });
  });
});

describe('useComplianceSummary', () => {
  it('should fetch compliance summary', async () => {
    const mockData = {
      rules: [
        {
          ruleId: 'r1',
          ruleName: 'Greeting',
          severity: 'Warning',
          occurrences: 5,
          sessionsAffected: 3,
          firstSeen: '2026-01-01',
          lastSeen: '2026-01-15',
        },
      ],
      totalViolations: 5,
      totalSessionsWithViolations: 3,
      severityBreakdown: { info: 0, warning: 5, critical: 0 },
      from: '2026-01-01',
      to: '2026-01-31',
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useComplianceSummary('2026-01-01', '2026-01-31', 'support', 'Warning'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/call-analytics/compliance/summary',
      method: 'GET',
      params: { from: '2026-01-01', to: '2026-01-31', queueName: 'support', severity: 'Warning' },
    });
  });
});

describe('useBotAnalytics', () => {
  it('should fetch bot analytics', async () => {
    const mockData = {
      totalConversations: 200,
      handedOff: 40,
      resolved: 150,
      failed: 10,
      handoffRate: 0.2,
      resolutionRate: 0.75,
      avgTurns: 4.5,
      failureRate: 0.05,
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useBotAnalytics('2026-01-01', '2026-01-31'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/bot',
      method: 'GET',
      params: { from: '2026-01-01', to: '2026-01-31' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useBotAnalytics(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCsatQueueAnalytics', () => {
  // Verbatim-fixture-citation guard (openapi-typed-client): the resolved type
  // must expose exactly these 6 fields — matching the golden fixture's
  // `CsatResponseDto` schema field-for-field, no extra or renamed keys. Mirrors
  // the csat-runner precedent's contract test (the exact drift PR#159 shipped).
  const FIXTURE_FIELDS = [
    'queueName',
    'channel',
    'totalResponses',
    'averageRating',
    'rangeStart',
    'rangeEnd',
  ] as const;

  it('should fetch csat queue analytics with exactly the fixture fields', async () => {
    const mockData = {
      queueName: 'support',
      channel: 'webchat',
      totalResponses: 8,
      averageRating: 4.5,
      rangeStart: '2026-07-01T00:00:00Z',
      rangeEnd: '2026-07-12T00:00:00Z',
    };
    vi.mocked(client.customFetch).mockResolvedValue(mockData);

    const { result } = renderHook(() => useCsatQueueAnalytics('queue-001'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/analytics/csat/queues/queue-001',
      method: 'GET',
    });

    const data = result.current.data;
    expect(data).toBeDefined();
    expect(Object.keys(data ?? {}).sort()).toEqual([...FIXTURE_FIELDS].sort());
    expect(data).toEqual(mockData);
  });

  it('should coerce numeric-or-string wire fields to number', async () => {
    // Native AOT number handling: the generated type allows `totalResponses` /
    // `averageRating` to arrive as `number | string`. The hook must normalize
    // both to `number` so existing consumers (e.g. CsatKpiCard) can keep doing
    // plain numeric comparisons/formatting.
    vi.mocked(client.customFetch).mockResolvedValue({
      queueName: 'support',
      channel: 'webchat',
      totalResponses: '8',
      averageRating: '4.5',
      rangeStart: '2026-07-01T00:00:00Z',
      rangeEnd: '2026-07-12T00:00:00Z',
    });

    const { result } = renderHook(() => useCsatQueueAnalytics('queue-001'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalResponses).toBe(8);
    expect(result.current.data?.averageRating).toBe(4.5);
    expect(typeof result.current.data?.totalResponses).toBe('number');
    expect(typeof result.current.data?.averageRating).toBe('number');
  });

  it('should not fetch when queueId is undefined', () => {
    const { result } = renderHook(() => useCsatQueueAnalytics(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useCsatQueueAnalytics('queue-001'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
