import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// ─── Mock i18n ───────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => {
      if (typeof defaultValue === 'string') return defaultValue;
      return key;
    },
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Stub Recharts ResponsiveContainer (jsdom has no layout) ────────────────
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 200 }}>
        {children}
      </div>
    ),
  };
});

// ─── Mock the QA detail hook ────────────────────────────────────────────────
import type { QaDetail } from '@/core/api/hooks/use-analytics';

const detailMock: { value: QaDetail | undefined } = { value: undefined };
vi.mock('@/core/api/hooks/use-analytics', () => ({
  useQaDetail: () => ({ data: detailMock.value, isLoading: false }),
}));

// ─── Component under test (must import after mocks) ─────────────────────────
import { QaDetailDrawer } from '@/analytics/qa/qa-detail-drawer';

function makeDetail(overrides: Partial<QaDetail> = {}): QaDetail {
  return {
    sessionId: 'sess-1',
    analyzedAt: '2026-04-26T10:00:00Z',
    agentName: 'Agent Smith',
    queueName: 'support',
    narrative:
      '# Call Summary\n\nThe customer **disputed a charge**. Resolved with `refund` policy.\n\nFollow up next week.',
    actionItems: [],
    qaScore: 85,
    maxPossibleScore: 100,
    criteria: [
      { category: 'Greeting', score: 90, weight: 1, passed: true, feedback: 'Clear opening' },
    ],
    violations: [
      {
        ruleName: 'PCI Disclosure',
        severity: 'Critical',
        description: 'Card number spoken in clear',
        evidence: '4111-...',
      },
      {
        ruleName: 'Hold Notice',
        severity: 'Warning',
        description: 'Customer placed on hold without notice',
      },
      {
        ruleName: 'Greeting Format',
        severity: 'Info',
        description: 'Greeting did not include company name',
      },
    ],
    sentimentLabel: 'Positive',
    sentimentTrend: 'Improving',
    sentimentScore: 0.42,
    primaryTopic: 'Billing',
    allTopics: [
      { name: 'Billing', confidence: 0.95 },
      { name: 'Refund', confidence: 0.78 },
    ],
    sentimentTimeline: [
      { turnIndex: 0, speaker: 'Caller', score: -0.4, label: 'Negative' },
      { turnIndex: 1, speaker: 'Agent', score: 0.1, label: 'Neutral' },
      { turnIndex: 2, speaker: 'Caller', score: 0.5, label: 'Positive' },
    ],
    agentTalkRatio: 0.55,
    silenceCount: 2,
    interruptionCount: 1,
    ...overrides,
  };
}

describe('QaDetailDrawer enrichment (S4.6)', () => {
  it('Summary_ShouldRenderMarkdownNarrative_WhenNarrativePresent', () => {
    detailMock.value = makeDetail();
    render(<QaDetailDrawer sessionId="sess-1" open onOpenChange={vi.fn()} />);

    const summary = screen.getByTestId('qa-summary');
    expect(summary).toBeInTheDocument();
    const md = within(summary).getByTestId('qa-summary-markdown');
    // Heading rendered
    expect(md.querySelector('h1')).not.toBeNull();
    // Bold rendered
    expect(md.querySelector('strong')?.textContent).toBe('disputed a charge');
    // Code rendered
    expect(md.querySelector('code')?.textContent).toBe('refund');
  });

  it('Violations_ShouldRenderListWithSeverityBadges_WhenPresent', () => {
    detailMock.value = makeDetail();
    render(<QaDetailDrawer sessionId="sess-1" open onOpenChange={vi.fn()} />);

    const section = screen.getByTestId('qa-violations');
    const items = within(section).getAllByTestId('qa-violation-item');
    expect(items).toHaveLength(3);

    const severities = within(section).getAllByTestId('qa-violation-severity');
    // Critical → red
    expect(severities[0]).toHaveAttribute('data-severity', 'critical');
    expect(severities[0].className).toMatch(/red/);
    // Warning → amber
    expect(severities[1]).toHaveAttribute('data-severity', 'warning');
    expect(severities[1].className).toMatch(/amber/);
    // Info → gray/slate
    expect(severities[2]).toHaveAttribute('data-severity', 'info');
    expect(severities[2].className).toMatch(/slate/);
  });

  it('SentimentTimeline_ShouldRenderRechartsAreaChart_WhenTimelinePresent', () => {
    detailMock.value = makeDetail();
    render(<QaDetailDrawer sessionId="sess-1" open onOpenChange={vi.fn()} />);

    const section = screen.getByTestId('qa-sentiment-chart');
    expect(section).toBeInTheDocument();
    const container = within(section).getByTestId('qa-sentiment-chart-container');
    expect(container).toHaveAttribute('data-points', '3');
    // ResponsiveContainer stub mounted
    expect(within(section).getByTestId('responsive-container')).toBeInTheDocument();
    // Recharts AreaChart emits a wrapper div with class .recharts-wrapper
    // (component-class names may vary by version; assert the chart mounted)
    expect(
      section.querySelector('.recharts-wrapper, .recharts-area, .recharts-surface, svg'),
    ).not.toBeNull();
  });

  it('Topics_ShouldRenderChipsWithPrimaryHighlighted_WhenTopicsPresent', () => {
    detailMock.value = makeDetail();
    render(<QaDetailDrawer sessionId="sess-1" open onOpenChange={vi.fn()} />);

    const section = screen.getByTestId('qa-topics');
    const chips = within(section).getAllByTestId('qa-topic-chip');
    expect(chips).toHaveLength(2);
    // Primary topic flagged
    const billing = chips.find((c) => c.textContent?.startsWith('Billing'));
    const refund = chips.find((c) => c.textContent?.startsWith('Refund'));
    expect(billing).toHaveAttribute('data-primary', 'true');
    expect(refund).toHaveAttribute('data-primary', 'false');
  });
});
