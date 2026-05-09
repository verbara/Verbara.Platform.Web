import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { createPdfHelpers } from '@/core/pdf/helpers';
import { renderCdrSummary, summarizeCdrRows, type CdrSummaryData } from './cdr-summary-template';
import { renderQaSummary, summarizeQaRows, type QaSummaryData } from './qa-summary-template';
import type { CdrRow, QaRow } from '@/core/api/hooks/use-analytics';

const mockI18n = (k: string) => k;

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

function cdrRow(overrides: Partial<CdrRow> = {}): CdrRow {
  return {
    sessionId: 's1',
    startTime: '2026-05-08T10:00:00Z',
    endTime: '2026-05-08T10:04:00Z',
    channel: 'voice',
    durationMs: 240_000,
    disposition: 'resolved',
    slaMet: true,
    hasQaScore: false,
    hasRecording: false,
    holdCount: 0,
    ...overrides,
  };
}

function qaRow(overrides: Partial<QaRow> = {}): QaRow {
  return {
    sessionId: 's1',
    analyzedAt: '2026-05-08T10:00:00Z',
    agentName: 'Alice',
    qaScore: 85,
    hasComplianceViolations: false,
    violationCount: 0,
    topics: [],
    ...overrides,
  };
}

describe('renderCdrSummary', () => {
  it('Renders_KpiSection_AndRowsTable', () => {
    const { doc, helpers } = makeHelpers();
    const tableSpy = vi.spyOn(helpers, 'table');
    const data: CdrSummaryData = {
      period: { from: '2026-05-01', to: '2026-05-08' },
      kpis: {
        totalCalls: 2,
        totalDurationMs: 480_000,
        avgDurationMs: 240_000,
        slaMetCount: 2,
        slaPercent: 100,
      },
      rows: [cdrRow({ sessionId: 'a' }), cdrRow({ sessionId: 'b' })],
    };
    renderCdrSummary({ doc, helpers, data, t: mockI18n });
    expect(tableSpy).toHaveBeenCalledTimes(2);
  });
});

describe('summarizeCdrRows', () => {
  it('AggregatesTotals_AndSlaPercent', () => {
    const rows = [
      cdrRow({ durationMs: 100_000, slaMet: true }),
      cdrRow({ durationMs: 200_000, slaMet: false }),
      cdrRow({ durationMs: 300_000, slaMet: true }),
    ];
    const k = summarizeCdrRows(rows);
    expect(k.totalCalls).toBe(3);
    expect(k.totalDurationMs).toBe(600_000);
    expect(k.avgDurationMs).toBe(200_000);
    expect(k.slaMetCount).toBe(2);
    expect(k.slaPercent).toBeCloseTo(66.67, 1);
  });

  it('HandlesEmpty_AsZero', () => {
    const k = summarizeCdrRows([]);
    expect(k.totalCalls).toBe(0);
    expect(k.avgDurationMs).toBe(0);
    expect(k.slaPercent).toBe(0);
  });
});

describe('renderQaSummary', () => {
  it('Renders_DistributionTable_AndPerAgentTable', () => {
    const { doc, helpers } = makeHelpers();
    const tableSpy = vi.spyOn(helpers, 'table');
    const data: QaSummaryData = {
      period: { from: '2026-05-01', to: '2026-05-08' },
      totalEvaluations: 10,
      avgScore: 85.4,
      distribution: { excellent: 3, good: 5, fair: 2, poor: 0 },
      perAgent: [{ agent: 'Alice', evaluations: 5, avgScore: 88 }],
      violationCount: 1,
    };
    renderQaSummary({ doc, helpers, data, t: mockI18n });
    expect(tableSpy).toHaveBeenCalledTimes(2);
  });
});

describe('summarizeQaRows', () => {
  it('Buckets_BySCoreRange_AndComputesPerAgent', () => {
    const rows = [
      qaRow({ agentName: 'Alice', qaScore: 92 }),
      qaRow({ agentName: 'Alice', qaScore: 85 }),
      qaRow({ agentName: 'Bob', qaScore: 75 }),
      qaRow({ agentName: 'Bob', qaScore: 65 }),
    ];
    const s = summarizeQaRows(rows);
    expect(s.totalEvaluations).toBe(4);
    expect(s.distribution.excellent).toBe(1);
    expect(s.distribution.good).toBe(1);
    expect(s.distribution.fair).toBe(1);
    expect(s.distribution.poor).toBe(1);
    expect(s.perAgent).toHaveLength(2);
    expect(s.perAgent[0]?.agent).toBe('Alice');
    expect(s.perAgent[0]?.avgScore).toBeCloseTo(88.5, 1);
  });
});
