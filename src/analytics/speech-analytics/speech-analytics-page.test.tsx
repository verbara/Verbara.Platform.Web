import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ─── mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/core/realtime', () => ({
  onHubEvent: vi.fn(() => vi.fn()),
}));

vi.mock('@/core/stores/realtime-store', () => ({
  useRealtimeStore: vi.fn(() => 'connected'),
}));

vi.mock('@/core/stores/analytics-filter-store', () => ({
  useAnalyticsFilterStore: vi.fn(() => ({
    from: '2026-04-01',
    to: '2026-04-30',
    queue: '',
    channel: '',
    setFilters: vi.fn(),
    reset: vi.fn(),
  })),
}));

vi.mock('@/analytics/shared/filter-bar', () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/core/api/hooks/use-analytics', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-analytics')>();
  return {
    qaSurfaces: actual.qaSurfaces,
    useTopicTrends: vi.fn(),
    useSentimentTrends: vi.fn(),
    useComplianceSummary: vi.fn(),
    useQaSurfaces: vi.fn(),
  };
});

import {
  useTopicTrends,
  useSentimentTrends,
  useComplianceSummary,
  useQaSurfaces,
  qaSurfaces,
  type QaAvailability,
} from '@/core/api/hooks/use-analytics';
import noSource from '@/core/api/hooks/__fixtures__/qa-availability.v1.json';
import available from '@/core/api/hooks/__fixtures__/qa-availability.available.v1.json';
import notLicensed from '@/core/api/hooks/__fixtures__/qa-availability.not-licensed.v1.json';
import SpeechAnalyticsPage from './speech-analytics-page';

const mockUseTopicTrends = useTopicTrends as ReturnType<typeof vi.fn>;
const mockUseSentimentTrends = useSentimentTrends as ReturnType<typeof vi.fn>;
const mockUseComplianceSummary = useComplianceSummary as ReturnType<typeof vi.fn>;
const mockUseQaSurfaces = useQaSurfaces as ReturnType<typeof vi.fn>;

// The page follows the availability read (qa-scores-are-produced-or-not-shown, design D2).
function availability(body: unknown) {
  mockUseQaSurfaces.mockReturnValue({
    ...qaSurfaces(body as QaAvailability),
    isLoading: false,
  });
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

const sampleTopics = {
  trends: [
    { topic: 'Billing', occurrences: 42, avgConfidence: 0.91 },
    { topic: 'Support', occurrences: 31, avgConfidence: 0.78 },
  ],
  totalAnalyzed: 200,
};

const sampleSentiment = {
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
  bucket: 'day',
  from: '2026-04-01',
  to: '2026-04-30',
};

const sampleCompliance = {
  rules: [
    {
      ruleId: 'r1',
      ruleName: 'PCI Disclaimer',
      severity: 'Critical' as const,
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

describe('SpeechAnalyticsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockUseTopicTrends.mockReturnValue({ data: sampleTopics, isLoading: false });
    mockUseSentimentTrends.mockReturnValue({ data: sampleSentiment, isLoading: false });
    mockUseComplianceSummary.mockReturnValue({ data: sampleCompliance, isLoading: false });
    availability(available);
  });

  it('renders_with_loading_state_when_queries_pending', () => {
    mockUseTopicTrends.mockReturnValue({ data: undefined, isLoading: true });
    mockUseSentimentTrends.mockReturnValue({ data: undefined, isLoading: true });
    mockUseComplianceSummary.mockReturnValue({ data: undefined, isLoading: true });

    render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });

    // The filter bar renders; the skeleton shows in the active tab
    expect(screen.getByTestId('filter-bar')).toBeDefined();
    expect(screen.getByTestId('page-skeleton')).toBeDefined();
  });

  it('renders_topic_trends_tab_by_default_with_table_and_bar_chart', () => {
    render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('topics-tab')).toBeDefined();
    expect(screen.getByTestId('topics-table')).toBeDefined();
    // Topic names visible in table
    expect(screen.getByText('Billing')).toBeDefined();
    expect(screen.getByText('Support')).toBeDefined();
    // Confidence badge rendered as %
    expect(screen.getByText('91%')).toBeDefined();
  });

  it('switches_to_sentiment_trends_tab_on_click', () => {
    render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });

    // Initially not visible
    expect(screen.queryByTestId('sentiment-tab')).toBeNull();

    // Click the Sentiment tab
    const sentimentTab = screen.getByRole('tab', { name: /sentiment/i });
    fireEvent.click(sentimentTab);

    expect(screen.getByTestId('sentiment-tab')).toBeDefined();
  });

  it('switches_to_compliance_tab_and_renders_severity_filter', () => {
    render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });

    const complianceTab = screen.getByRole('tab', { name: /compliance/i });
    fireEvent.click(complianceTab);

    expect(screen.getByTestId('compliance-tab')).toBeDefined();
    expect(screen.getByTestId('severity-filter')).toBeDefined();
    expect(screen.getByTestId('compliance-table')).toBeDefined();
    expect(screen.getByText('PCI Disclaimer')).toBeDefined();
  });

  it('shows_empty_state_when_no_data', () => {
    mockUseTopicTrends.mockReturnValue({
      data: { trends: [], totalAnalyzed: 0 },
      isLoading: false,
    });

    render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('empty-state')).toBeDefined();
  });

  it.each([
    ['no transcript source', noSource, 'not_configured'],
    ['no call analytics licence', notLicensed, 'not_licensed'],
  ])(
    'NamesTheReason_AndRendersNoTab_AndIssuesNoTabQuery_WhenAnalysisDoesNotRun (%s)',
    (_name, body, reason) => {
      availability(body);

      render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });

      const state = screen.getByTestId('speech-unavailable');
      expect(state.getAttribute('data-reason')).toBe(reason);
      expect(state.textContent).toBe(`availability.${reason}`);
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByTestId('topics-tab')).toBeNull();
      expect(mockUseTopicTrends).not.toHaveBeenCalled();
      expect(mockUseSentimentTrends).not.toHaveBeenCalled();
      expect(mockUseComplianceSummary).not.toHaveBeenCalled();
    },
  );

  it('RendersNoTab_AndNoReason_WhileTheAvailabilityIsPending', () => {
    mockUseQaSurfaces.mockReturnValue({ ...qaSurfaces(undefined), isLoading: true });

    render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });

    expect(screen.queryByTestId('speech-unavailable')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(mockUseTopicTrends).not.toHaveBeenCalled();
  });

  it('KeepsTheTabs_WhenAnalysisRunsWithoutAScorecard', () => {
    availability({ ...available, available: false, reason: 'no_scorecard' });

    render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('topics-tab')).toBeDefined();
    expect(screen.queryByTestId('speech-unavailable')).toBeNull();
  });

  // Audit round 10, F2: a tenant whose calls are in a language the sentiment analysis does not
  // support sees why there is no sentiment, and no sentiment is requested.
  it('ExplainsTheMissingSentiment_AndIssuesNoSentimentQuery_WhenTheLanguageIsNotSupported', () => {
    availability({ ...available, sentimentSupported: false });

    render(<SpeechAnalyticsPage />, { wrapper: makeWrapper() });
    fireEvent.click(screen.getByRole('tab', { name: /sentiment/i }));

    expect(screen.getByTestId('sentiment-unsupported').textContent).toBe(
      'availability.sentiment_unsupported',
    );
    expect(screen.queryByTestId('sentiment-tab')).toBeNull();
    expect(mockUseSentimentTrends).not.toHaveBeenCalled();
  });
});
