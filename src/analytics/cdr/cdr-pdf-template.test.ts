import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import { createPdfHelpers } from '@/core/pdf/helpers';
import { renderCdrPdf } from './cdr-pdf-template';
import type { CdrDetailDto, TranscriptSegment } from '@/core/api/hooks/use-analytics';

const mockI18n = (k: string) => k;

function makeDetail(overrides: Partial<CdrDetailDto> = {}): CdrDetailDto {
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

  it('RendersDash_AndNoQaScoreRow_WhenNullableMembersAreNull', () => {
    const { doc, helpers } = makeHelpers();
    const tableSpy = vi.spyOn(helpers, 'table');
    renderCdrPdf({
      doc,
      helpers,
      detail: makeDetail({
        cdr: { ...makeDetail().cdr, talkTimeMs: null, waitTimeMs: null, qaScore: null },
      }),
      t: mockI18n,
    });
    const summary = tableSpy.mock.calls[0]?.[0].body as string[][];
    const cell = (key: string) => summary.find((r) => r[0] === key)?.[1];
    expect(cell('analytics.cdr.pdf.field.talkTime')).toBe('—');
    expect(cell('analytics.cdr.pdf.field.waitTime')).toBe('—');
    expect(cell('analytics.cdr.pdf.field.qaScore')).toBeUndefined();
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
      show: { qa: true, sentiment: true },
      t: mockI18n,
    });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).toContain('analytics.cdr.pdf.qaSummaryTitle');
  });

  // The PDF prints what the console shows. With
  // post-call analysis unavailable, no QA score, sentiment or QA summary is printed even when the
  // record carries them.
  it('PrintsNoQaScoreSentimentOrQaSummary_WhenTheConsoleHidesThem', () => {
    const { doc, helpers } = makeHelpers();
    const tableSpy = vi.spyOn(helpers, 'table');
    const sectionSpy = vi.spyOn(helpers, 'section');
    renderCdrPdf({
      doc,
      helpers,
      detail: makeDetail({
        cdr: { ...makeDetail().cdr, qaScore: 80, sentimentLabel: 'Positive' },
        qaSummary: { reason: 'inquiry', outcome: 'resolved', narrative: 'Smooth call' },
      }),
      t: mockI18n,
    });
    const summary = tableSpy.mock.calls[0]?.[0].body as string[][];
    const cell = (key: string) => summary.find((r) => r[0] === key)?.[1];
    expect(cell('analytics.cdr.pdf.field.qaScore')).toBeUndefined();
    expect(cell('analytics.cdr.pdf.field.sentiment')).toBeUndefined();
    expect(sectionSpy.mock.calls.map((c) => c[0])).not.toContain(
      'analytics.cdr.pdf.qaSummaryTitle',
    );
  });

  it('PrintsTheQaScoreButNoSentiment_WhenSentimentIsNotSupported', () => {
    const { doc, helpers } = makeHelpers();
    const tableSpy = vi.spyOn(helpers, 'table');
    renderCdrPdf({
      doc,
      helpers,
      detail: makeDetail({
        cdr: { ...makeDetail().cdr, qaScore: 80, sentimentLabel: 'Positive' },
      }),
      show: { qa: true, sentiment: false },
      t: mockI18n,
    });
    const summary = tableSpy.mock.calls[0]?.[0].body as string[][];
    const cell = (key: string) => summary.find((r) => r[0] === key)?.[1];
    expect(cell('analytics.cdr.pdf.field.qaScore')).toBe('80');
    expect(cell('analytics.cdr.pdf.field.sentiment')).toBeUndefined();
  });

  it('PrintsTheQaScoreAndSentiment_WhenTheConsoleShowsBoth', () => {
    const { doc, helpers } = makeHelpers();
    const tableSpy = vi.spyOn(helpers, 'table');
    renderCdrPdf({
      doc,
      helpers,
      detail: makeDetail({
        cdr: { ...makeDetail().cdr, qaScore: 80, sentimentLabel: 'Positive' },
      }),
      show: { qa: true, sentiment: true },
      t: mockI18n,
    });
    const summary = tableSpy.mock.calls[0]?.[0].body as string[][];
    const cell = (key: string) => summary.find((r) => r[0] === key)?.[1];
    expect(cell('analytics.cdr.pdf.field.qaScore')).toBe('80');
    expect(cell('analytics.cdr.pdf.field.sentiment')).toBe('Positive');
  });
});
