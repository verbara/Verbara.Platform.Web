import type { jsPDF } from 'jspdf';
import type { PdfHelpers } from '@/core/pdf';
import type { CdrRow } from '@/core/api/hooks/use-analytics';

export interface CdrSummaryKpis {
  totalCalls: number;
  totalDurationMs: number;
  avgDurationMs: number;
  slaMetCount: number;
  slaPercent: number;
}

export interface CdrSummaryData {
  period: { from: string; to: string };
  kpis: CdrSummaryKpis;
  rows: CdrRow[];
}

interface Args {
  doc: jsPDF;
  helpers: PdfHelpers;
  data: CdrSummaryData;
  t: (key: string) => string;
}

const dash = '—';

function formatMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function renderCdrSummary({ helpers, data, t }: Args) {
  helpers.section(t('admin.reports.pdf.cdr.kpiTitle'), () => {
    helpers.table({
      body: [
        [t('admin.reports.pdf.cdr.period'), `${data.period.from} → ${data.period.to}`],
        [t('admin.reports.pdf.cdr.totalCalls'), `${data.kpis.totalCalls}`],
        [t('admin.reports.pdf.cdr.totalDuration'), formatMs(data.kpis.totalDurationMs)],
        [t('admin.reports.pdf.cdr.avgDuration'), formatMs(data.kpis.avgDurationMs)],
        [
          t('admin.reports.pdf.cdr.slaPercent'),
          `${data.kpis.slaPercent.toFixed(1)}% (${data.kpis.slaMetCount}/${data.kpis.totalCalls})`,
        ],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    });
  });

  if (data.rows.length > 0) {
    helpers.section(t('admin.reports.pdf.cdr.rowsTitle'), () => {
      helpers.table({
        head: [
          [
            t('admin.reports.pdf.cdr.col.startTime'),
            t('admin.reports.pdf.cdr.col.contact'),
            t('admin.reports.pdf.cdr.col.queue'),
            t('admin.reports.pdf.cdr.col.agent'),
            t('admin.reports.pdf.cdr.col.duration'),
            t('admin.reports.pdf.cdr.col.disposition'),
            t('admin.reports.pdf.cdr.col.slaMet'),
          ],
        ],
        body: data.rows.map((r) => [
          r.startTime,
          r.contact ?? dash,
          r.queueName ?? dash,
          r.agentName ?? dash,
          formatMs(r.durationMs),
          r.dispositionName ?? r.disposition,
          r.slaMet ? '✓' : '✗',
        ]),
        styles: { fontSize: 9, cellWidth: 'wrap', overflow: 'linebreak' },
      });
    });
  }
}

export function summarizeCdrRows(rows: CdrRow[]): CdrSummaryKpis {
  const totalCalls = rows.length;
  const totalDurationMs = rows.reduce((acc, r) => acc + r.durationMs, 0);
  const avgDurationMs = totalCalls > 0 ? Math.round(totalDurationMs / totalCalls) : 0;
  const slaMetCount = rows.filter((r) => r.slaMet).length;
  const slaPercent = totalCalls > 0 ? (slaMetCount / totalCalls) * 100 : 0;
  return { totalCalls, totalDurationMs, avgDurationMs, slaMetCount, slaPercent };
}
