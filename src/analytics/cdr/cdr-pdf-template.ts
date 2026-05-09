import type { jsPDF } from 'jspdf';
import type { PdfHelpers } from '@/core/pdf';
import type { CdrDetail, TranscriptSegment } from '@/core/api/hooks/use-analytics';

interface RenderCdrPdfArgs {
  doc: jsPDF;
  helpers: PdfHelpers;
  detail: CdrDetail;
  transcript?: TranscriptSegment[];
  t: (key: string) => string;
}

const dash = '—';

function formatMs(ms?: number): string {
  if (ms === undefined || ms < 0) return dash;
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTime(secondsOrMs: number, asSeconds = true): string {
  const total = asSeconds ? Math.floor(secondsOrMs) : Math.floor(secondsOrMs / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function renderCdrPdf({ helpers, detail, transcript, t }: RenderCdrPdfArgs) {
  const { cdr, timeline, qaSummary } = detail;

  helpers.section(t('analytics.cdr.pdf.summaryTitle'), () => {
    helpers.table({
      body: [
        [t('analytics.cdr.pdf.field.sessionId'), cdr.sessionId],
        [t('analytics.cdr.pdf.field.startTime'), cdr.startTime],
        [t('analytics.cdr.pdf.field.endTime'), cdr.endTime],
        [t('analytics.cdr.pdf.field.contact'), cdr.contact ?? dash],
        [t('analytics.cdr.pdf.field.channel'), cdr.channel],
        [t('analytics.cdr.pdf.field.queue'), cdr.queueName ?? dash],
        [t('analytics.cdr.pdf.field.agent'), cdr.agentName ?? dash],
        [t('analytics.cdr.pdf.field.duration'), formatMs(cdr.durationMs)],
        [t('analytics.cdr.pdf.field.talkTime'), formatMs(cdr.talkTimeMs)],
        [t('analytics.cdr.pdf.field.waitTime'), formatMs(cdr.waitTimeMs)],
        [t('analytics.cdr.pdf.field.disposition'), cdr.dispositionName ?? cdr.disposition],
        [
          t('analytics.cdr.pdf.field.slaMet'),
          cdr.slaMet ? t('analytics.cdr.pdf.yes') : t('analytics.cdr.pdf.no'),
        ],
        ...(cdr.qaScore !== undefined
          ? [[t('analytics.cdr.pdf.field.qaScore'), `${cdr.qaScore}`]]
          : []),
        ...(cdr.sentimentLabel
          ? [[t('analytics.cdr.pdf.field.sentiment'), cdr.sentimentLabel]]
          : []),
        ...(cdr.campaignName ? [[t('analytics.cdr.pdf.field.campaign'), cdr.campaignName]] : []),
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    });
  });

  if (qaSummary && (qaSummary.reason || qaSummary.outcome || qaSummary.narrative)) {
    helpers.section(t('analytics.cdr.pdf.qaSummaryTitle'), () => {
      const rows: string[][] = [];
      if (qaSummary.reason) rows.push([t('analytics.cdr.pdf.qa.reason'), qaSummary.reason]);
      if (qaSummary.outcome) rows.push([t('analytics.cdr.pdf.qa.outcome'), qaSummary.outcome]);
      if (qaSummary.narrative)
        rows.push([t('analytics.cdr.pdf.qa.narrative'), qaSummary.narrative]);
      helpers.table({
        body: rows,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 1.5, cellWidth: 'wrap', overflow: 'linebreak' },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
      });
    });
  }

  if (timeline.length > 0) {
    helpers.section(t('analytics.cdr.pdf.timelineTitle'), () => {
      helpers.table({
        head: [
          [
            t('analytics.cdr.pdf.timeline.timestamp'),
            t('analytics.cdr.pdf.timeline.event'),
            t('analytics.cdr.pdf.timeline.detail'),
          ],
        ],
        body: timeline.map((e) => [e.timestamp, e.event, e.detail ?? dash]),
        styles: { fontSize: 9, cellWidth: 'wrap', overflow: 'linebreak' },
      });
    });
  }

  if (transcript && transcript.length > 0) {
    helpers.section(t('analytics.cdr.pdf.transcriptTitle'), () => {
      helpers.table({
        head: [
          [
            t('analytics.cdr.pdf.transcript.at'),
            t('analytics.cdr.pdf.transcript.speaker'),
            t('analytics.cdr.pdf.transcript.text'),
          ],
        ],
        body: transcript.map((row) => [
          formatTime(row.startTime),
          row.speaker === 'agent'
            ? t('analytics.cdr.pdf.transcript.agent')
            : t('analytics.cdr.pdf.transcript.caller'),
          row.text,
        ]),
        styles: { fontSize: 9, cellWidth: 'wrap', overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 22 } },
      });
    });
  }
}
