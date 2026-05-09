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
});
