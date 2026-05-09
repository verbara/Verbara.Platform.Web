import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { createPdfHelpers } from '@/core/pdf/helpers';
import { renderCdrPdf } from './cdr-pdf-template';
import type { CdrDetail, TranscriptSegment } from '@/core/api/hooks/use-analytics';

const mockI18n = (k: string) => k;

function makeDetail(overrides: Partial<CdrDetail> = {}): CdrDetail {
  return {
    cdr: {
      sessionId: 's1',
      startTime: '2026-05-08T10:00:00Z',
      endTime: '2026-05-08T10:04:00Z',
      contact: 'John Doe (+1 555 100)',
      channel: 'voice',
      queueName: 'sales',
      agentName: 'Alice',
      durationMs: 240_000,
      disposition: 'resolved',
      slaMet: true,
      hasQaScore: true,
      qaScore: 92,
      hasRecording: false,
      holdCount: 0,
    },
    timeline: [
      { timestamp: '10:00:01', event: 'queued' },
      { timestamp: '10:00:05', event: 'answered', detail: 'Alice' },
    ],
    transferCount: 0,
    hasTranscript: true,
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

describe('renderCdrPdf', () => {
  it('Renders_SummarySection_AndTimelineTable', () => {
    const { doc, helpers } = makeHelpers();
    const sectionSpy = vi.spyOn(helpers, 'section');
    const tableSpy = vi.spyOn(helpers, 'table');
    renderCdrPdf({ doc, helpers, detail: makeDetail(), t: mockI18n });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).toContain('analytics.cdr.pdf.summaryTitle');
    expect(titles).toContain('analytics.cdr.pdf.timelineTitle');
    expect(tableSpy).toHaveBeenCalled();
  });

  it('OmitsTranscriptSection_WhenTranscriptUndefined', () => {
    const { doc, helpers } = makeHelpers();
    const sectionSpy = vi.spyOn(helpers, 'section');
    renderCdrPdf({ doc, helpers, detail: makeDetail({ timeline: [] }), t: mockI18n });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).not.toContain('analytics.cdr.pdf.transcriptTitle');
    expect(titles).not.toContain('analytics.cdr.pdf.timelineTitle');
  });

  it('IncludesTranscriptSection_WhenSegmentsProvided', () => {
    const { doc, helpers } = makeHelpers();
    const sectionSpy = vi.spyOn(helpers, 'section');
    const segments: TranscriptSegment[] = [
      { startTime: 5, endTime: 8, speaker: 'agent', text: 'Hello' },
      { startTime: 8, endTime: 10, speaker: 'caller', text: 'Hi' },
    ];
    renderCdrPdf({ doc, helpers, detail: makeDetail(), transcript: segments, t: mockI18n });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).toContain('analytics.cdr.pdf.transcriptTitle');
  });

  it('IncludesQaSummarySection_WhenQaSummaryHasContent', () => {
    const { doc, helpers } = makeHelpers();
    const sectionSpy = vi.spyOn(helpers, 'section');
    renderCdrPdf({
      doc,
      helpers,
      detail: makeDetail({
        qaSummary: { reason: 'inquiry', outcome: 'resolved', narrative: 'Smooth call' },
      }),
      t: mockI18n,
    });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).toContain('analytics.cdr.pdf.qaSummaryTitle');
  });
});
