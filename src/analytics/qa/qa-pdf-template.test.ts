import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { createPdfHelpers } from '@/core/pdf/helpers';
import { renderQaPdf } from './qa-pdf-template';
import type { QaDetail } from '@/core/api/hooks/use-analytics';

const mockI18n = (k: string) => k;

function makeQa(overrides: Partial<QaDetail> = {}): QaDetail {
  return {
    sessionId: 's1',
    analyzedAt: '2026-05-08T12:00:00Z',
    agentName: 'Alice',
    queueName: 'sales',
    qaScore: 87,
    maxPossibleScore: 100,
    criteria: [
      { category: 'Greeting', score: 5, weight: 5, passed: true, feedback: 'Friendly' },
      { category: 'Resolution', score: 4, weight: 5, passed: false, feedback: 'Slow' },
    ],
    violations: [],
    sentimentLabel: 'positive',
    sentimentTimeline: [],
    actionItems: ['Improve resolution speed'],
    allTopics: [],
    ...overrides,
  };
}

function makeHelpers() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const helpers = createPdfHelpers(doc, {
    tenantName: 'X',
    title: 'X',
    exportedBy: 'u',
    exportedAt: new Date(),
    i18n: { exportedBy: 'a', exportedAt: 'b', page: 'c' },
  });
  return { doc, helpers };
}

describe('renderQaPdf', () => {
  it('Renders_SummarySection_AndCriteriaTable', () => {
    const { doc, helpers } = makeHelpers();
    const sectionSpy = vi.spyOn(helpers, 'section');
    const tableSpy = vi.spyOn(helpers, 'table');
    renderQaPdf({ doc, helpers, qa: makeQa(), t: mockI18n });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).toContain('analytics.qa.pdf.summaryTitle');
    expect(titles).toContain('analytics.qa.pdf.criteriaTitle');
    expect(tableSpy).toHaveBeenCalled();
  });

  it('IncludesActionItemsSection_WhenItemsExist', () => {
    const { doc, helpers } = makeHelpers();
    const sectionSpy = vi.spyOn(helpers, 'section');
    renderQaPdf({ doc, helpers, qa: makeQa(), t: mockI18n });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).toContain('analytics.qa.pdf.actionItemsTitle');
  });

  it('IncludesViolationsSection_OnlyWhenPresent', () => {
    const { doc, helpers } = makeHelpers();
    const sectionSpy = vi.spyOn(helpers, 'section');
    renderQaPdf({
      doc,
      helpers,
      qa: makeQa({
        violations: [{ ruleName: 'PCI', severity: 'high', description: 'Card read aloud' }],
      }),
      t: mockI18n,
    });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).toContain('analytics.qa.pdf.violationsTitle');
  });

  it('OmitsContextSection_WhenAllContextEmpty', () => {
    const { doc, helpers } = makeHelpers();
    const sectionSpy = vi.spyOn(helpers, 'section');
    renderQaPdf({ doc, helpers, qa: makeQa(), t: mockI18n });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).not.toContain('analytics.qa.pdf.contextTitle');
  });

  // qa-scores-are-produced-or-not-shown (design D16): `qaScore` is already a 0-100 percentage, so
  // the PDF prints it as one and passes at 70 whatever the scorecard's weights total.
  function summaryRow(qa: QaDetail, field: string) {
    const { doc, helpers } = makeHelpers();
    const tableSpy = vi.spyOn(helpers, 'table');
    renderQaPdf({ doc, helpers, qa, t: mockI18n });
    const summary = tableSpy.mock.calls[0]?.[0].body as string[][];
    return summary.find((r) => r[0] === field)?.[1];
  }

  it('PrintsThePercentage_AndMarksNotPassed_WhenTheWeightsTotal10', () => {
    const qa = makeQa({ qaScore: 50, maxPossibleScore: 10 });
    expect(summaryRow(qa, 'analytics.qa.pdf.field.score')).toBe('50%');
    expect(summaryRow(qa, 'analytics.qa.pdf.field.result')).toBe('analytics.qa.pdf.failed');
  });

  it('PrintsThePercentage_AndMarksPassed_WhenTheWeightsTotal100', () => {
    const qa = makeQa({ qaScore: 87, maxPossibleScore: 100 });
    expect(summaryRow(qa, 'analytics.qa.pdf.field.score')).toBe('87%');
    expect(summaryRow(qa, 'analytics.qa.pdf.field.result')).toBe('analytics.qa.pdf.passed');
  });

  it('MarksPassed_WhenTheScoreIsExactlyTheThreshold', () => {
    const qa = makeQa({ qaScore: 70, maxPossibleScore: 10 });
    expect(summaryRow(qa, 'analytics.qa.pdf.field.result')).toBe('analytics.qa.pdf.passed');
    expect(summaryRow(makeQa({ qaScore: 69.9 }), 'analytics.qa.pdf.field.result')).toBe(
      'analytics.qa.pdf.failed',
    );
  });

  // qa-scores-are-produced-or-not-shown (design D2): sentiment is printed only where the console
  // shows it.
  it('PrintsTheSentiment_OnlyWhenTheConsoleShowsIt', () => {
    for (const [showSentiment, expected] of [
      [true, 'positive'],
      [false, undefined],
      [undefined, undefined],
    ] as const) {
      const { doc, helpers } = makeHelpers();
      const tableSpy = vi.spyOn(helpers, 'table');
      renderQaPdf({ doc, helpers, qa: makeQa(), showSentiment, t: mockI18n });
      const summary = tableSpy.mock.calls[0]?.[0].body as string[][];
      expect(summary.find((r) => r[0] === 'analytics.qa.pdf.field.sentiment')?.[1]).toBe(expected);
    }
  });
});
