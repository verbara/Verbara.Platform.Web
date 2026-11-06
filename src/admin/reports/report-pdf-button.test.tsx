import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWrapper } from '@/test/hook-test-utils';
import type { CdrListPage } from '@/core/api/hooks/use-analytics';
import type { ScheduledReport } from '@/core/api/hooks/use-reports';

// cdr-list-reads-its-envelope B.1: the conversation_summary report reads page 1 of the same
// data/hasMore envelope as the CDR grid. The real `useCdrList` runs; its transport answers the
// envelope below, the two rows of `cdr-list-response.v1.json` reduced to the members the report
// reads (admin may not import the analytics domain's fixtures, ADR-0012 gate #4; the full fixture
// is asserted by the analytics tests).
const listEnvelope: CdrListPage = {
  data: [
    {
      sessionId: 'c7a1f0e25b6d4c3e9a8f1e2d3c4b5a69',
      startTime: '2026-11-04T15:02:11.482+00:00',
      endTime: '2026-11-04T15:03:33.904+00:00',
      channel: 'voice',
      durationMs: 82422,
      disposition: 'ANSWERED',
      slaMet: true,
      hasQaScore: true,
      hasRecording: true,
      holdCount: 0,
    },
    {
      sessionId: '0b9e4d217c3a4f58b6e192d4a7c0f3e8',
      startTime: '2026-11-04T15:05:40.017+00:00',
      endTime: '2026-11-04T15:06:10.022+00:00',
      channel: 'voice',
      durationMs: 30005,
      disposition: 'NO ANSWER',
      slaMet: false,
      hasQaScore: false,
      hasRecording: false,
      holdCount: 0,
    },
  ],
  hasMore: true,
  page: 1,
  pageSize: 50,
};
const mockCustomFetch = vi.fn();
vi.mock('@/core/api/client', () => ({
  customFetch: (...args: unknown[]) => mockCustomFetch(...args),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));

const mockRenderCdrSummary = vi.fn();
vi.mock('./templates/cdr-summary-template', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./templates/cdr-summary-template')>();
  return { ...actual, renderCdrSummary: (args: unknown) => mockRenderCdrSummary(args) };
});

// The PDF machinery is not under test: the latest `onGenerate` is captured and invoked directly
// with an inert context.
let latestOnGenerate: ((ctx: unknown) => Promise<void>) | undefined;
vi.mock('@/core/ui/pdf-download-button', () => ({
  PdfDownloadButton: ({
    onGenerate,
    children,
  }: {
    onGenerate: (ctx: unknown) => Promise<void>;
    children: React.ReactNode;
  }) => {
    latestOnGenerate = onGenerate;
    return <span data-testid="pdf-generate">{children}</span>;
  },
}));

import { ReportPdfButton } from './report-pdf-button';

const report = {
  id: 'r1',
  name: 'Monthly',
  type: 'conversation_summary',
  format: 'PDF',
} as unknown as ScheduledReport;

describe('ReportPdfButton', () => {
  beforeEach(() => {
    mockCustomFetch.mockReset();
    mockRenderCdrSummary.mockReset();
    latestOnGenerate = undefined;
  });

  it('SummarizesTheDataRows_WhenTheListAnswersItsEnvelope', async () => {
    mockCustomFetch.mockResolvedValue(listEnvelope);
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <ReportPdfButton report={report} />
      </Wrapper>,
    );

    await waitFor(() => expect(mockCustomFetch).toHaveBeenCalled());
    expect(screen.getByTestId('pdf-generate')).toBeInTheDocument();
    // Generate once the query has settled: the rows handed to the template are `data`.
    await waitFor(async () => {
      mockRenderCdrSummary.mockReset();
      await latestOnGenerate?.({ doc: {}, helpers: {} });
      const last = mockRenderCdrSummary.mock.calls.at(-1)?.[0] as
        { data: { rows: { sessionId: string }[]; kpis: { totalCalls: number } } } | undefined;
      expect(last?.data.rows.map((r) => r.sessionId)).toEqual([
        'c7a1f0e25b6d4c3e9a8f1e2d3c4b5a69',
        '0b9e4d217c3a4f58b6e192d4a7c0f3e8',
      ]);
      expect(last?.data.kpis.totalCalls).toBe(2);
    });
  });
});
