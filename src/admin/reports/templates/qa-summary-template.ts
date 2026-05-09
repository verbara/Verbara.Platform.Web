import type { jsPDF } from 'jspdf';
import type { PdfHelpers } from '@/core/pdf';
import type { QaRow } from '@/core/api/hooks/use-analytics';

export interface QaSummaryDistribution {
  excellent: number; // >= 90
  good: number; // 80–89
  fair: number; // 70–79
  poor: number; // < 70
}

export interface QaSummaryAgentRow {
  agent: string;
  evaluations: number;
  avgScore: number;
}

export interface QaSummaryData {
  period: { from: string; to: string };
  totalEvaluations: number;
  avgScore: number;
  distribution: QaSummaryDistribution;
  perAgent: QaSummaryAgentRow[];
  violationCount: number;
}

interface Args {
  doc: jsPDF;
  helpers: PdfHelpers;
  data: QaSummaryData;
  t: (key: string) => string;
}

export function renderQaSummary({ helpers, data, t }: Args) {
  helpers.section(t('admin.reports.pdf.qa.distributionTitle'), () => {
    helpers.table({
      body: [
        [t('admin.reports.pdf.qa.period'), `${data.period.from} → ${data.period.to}`],
        [t('admin.reports.pdf.qa.totalEvaluations'), `${data.totalEvaluations}`],
        [t('admin.reports.pdf.qa.avgScore'), data.avgScore.toFixed(1)],
        [t('admin.reports.pdf.qa.violations'), `${data.violationCount}`],
        [t('admin.reports.pdf.qa.excellent'), `${data.distribution.excellent}`],
        [t('admin.reports.pdf.qa.good'), `${data.distribution.good}`],
        [t('admin.reports.pdf.qa.fair'), `${data.distribution.fair}`],
        [t('admin.reports.pdf.qa.poor'), `${data.distribution.poor}`],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    });
  });

  if (data.perAgent.length > 0) {
    helpers.section(t('admin.reports.pdf.qa.perAgentTitle'), () => {
      helpers.table({
        head: [
          [
            t('admin.reports.pdf.qa.col.agent'),
            t('admin.reports.pdf.qa.col.evaluations'),
            t('admin.reports.pdf.qa.col.avgScore'),
          ],
        ],
        body: data.perAgent.map((a) => [a.agent, `${a.evaluations}`, a.avgScore.toFixed(1)]),
        styles: { fontSize: 9 },
      });
    });
  }
}

export function summarizeQaRows(
  rows: QaRow[],
): Pick<
  QaSummaryData,
  'totalEvaluations' | 'avgScore' | 'distribution' | 'perAgent' | 'violationCount'
> {
  const totalEvaluations = rows.length;
  const sum = rows.reduce((acc, r) => acc + r.qaScore, 0);
  const avgScore = totalEvaluations > 0 ? sum / totalEvaluations : 0;
  const distribution: QaSummaryDistribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
  for (const r of rows) {
    if (r.qaScore >= 90) distribution.excellent++;
    else if (r.qaScore >= 80) distribution.good++;
    else if (r.qaScore >= 70) distribution.fair++;
    else distribution.poor++;
  }

  const byAgent = new Map<string, { count: number; total: number }>();
  for (const r of rows) {
    const agent = r.agentName ?? '—';
    const existing = byAgent.get(agent) ?? { count: 0, total: 0 };
    existing.count += 1;
    existing.total += r.qaScore;
    byAgent.set(agent, existing);
  }
  const perAgent: QaSummaryAgentRow[] = Array.from(byAgent.entries())
    .map(([agent, v]) => ({ agent, evaluations: v.count, avgScore: v.total / v.count }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const violationCount = rows.reduce((acc, r) => acc + r.violationCount, 0);

  return { totalEvaluations, avgScore, distribution, perAgent, violationCount };
}
