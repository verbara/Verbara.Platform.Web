import type { jsPDF } from 'jspdf';
import type { PdfHelpers } from '@/core/pdf';
import type { QaDetail } from '@/core/api/hooks/use-analytics';

interface RenderQaPdfArgs {
  doc: jsPDF;
  helpers: PdfHelpers;
  qa: QaDetail;
  t: (key: string) => string;
}

const dash = '—';

export function renderQaPdf({ helpers, qa, t }: RenderQaPdfArgs) {
  helpers.section(t('analytics.qa.pdf.summaryTitle'), () => {
    const passed = qa.maxPossibleScore > 0 ? qa.qaScore / qa.maxPossibleScore >= 0.7 : false;
    helpers.table({
      body: [
        [t('analytics.qa.pdf.field.sessionId'), qa.sessionId],
        [t('analytics.qa.pdf.field.analyzedAt'), qa.analyzedAt],
        [t('analytics.qa.pdf.field.agent'), qa.agentName ?? dash],
        [t('analytics.qa.pdf.field.queue'), qa.queueName ?? dash],
        [
          t('analytics.qa.pdf.field.score'),
          `${qa.qaScore}${qa.maxPossibleScore > 0 ? ` / ${qa.maxPossibleScore}` : ''}`,
        ],
        [
          t('analytics.qa.pdf.field.result'),
          passed ? t('analytics.qa.pdf.passed') : t('analytics.qa.pdf.failed'),
        ],
        ...(qa.sentimentLabel ? [[t('analytics.qa.pdf.field.sentiment'), qa.sentimentLabel]] : []),
        ...(qa.primaryTopic ? [[t('analytics.qa.pdf.field.primaryTopic'), qa.primaryTopic]] : []),
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    });
  });

  if (qa.reason || qa.outcome || qa.narrative) {
    helpers.section(t('analytics.qa.pdf.contextTitle'), () => {
      const rows: string[][] = [];
      if (qa.reason) rows.push([t('analytics.qa.pdf.context.reason'), qa.reason]);
      if (qa.outcome) rows.push([t('analytics.qa.pdf.context.outcome'), qa.outcome]);
      if (qa.narrative) rows.push([t('analytics.qa.pdf.context.narrative'), qa.narrative]);
      helpers.table({
        body: rows,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 1.5, cellWidth: 'wrap', overflow: 'linebreak' },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
      });
    });
  }

  if (qa.criteria.length > 0) {
    helpers.section(t('analytics.qa.pdf.criteriaTitle'), () => {
      helpers.table({
        head: [
          [
            t('analytics.qa.pdf.criteria.category'),
            t('analytics.qa.pdf.criteria.weight'),
            t('analytics.qa.pdf.criteria.score'),
            t('analytics.qa.pdf.criteria.passed'),
            t('analytics.qa.pdf.criteria.feedback'),
          ],
        ],
        body: qa.criteria.map((c) => [
          c.category,
          `${c.weight}`,
          `${c.score}`,
          c.passed ? t('analytics.qa.pdf.yes') : t('analytics.qa.pdf.no'),
          c.feedback ?? dash,
        ]),
        styles: { fontSize: 9, cellWidth: 'wrap', overflow: 'linebreak' },
      });
    });
  }

  if (qa.violations.length > 0) {
    helpers.section(t('analytics.qa.pdf.violationsTitle'), () => {
      helpers.table({
        head: [
          [
            t('analytics.qa.pdf.violations.rule'),
            t('analytics.qa.pdf.violations.severity'),
            t('analytics.qa.pdf.violations.description'),
            t('analytics.qa.pdf.violations.evidence'),
          ],
        ],
        body: qa.violations.map((v) => [v.ruleName, v.severity, v.description, v.evidence ?? dash]),
        styles: { fontSize: 9, cellWidth: 'wrap', overflow: 'linebreak' },
      });
    });
  }

  if (qa.actionItems.length > 0) {
    helpers.section(t('analytics.qa.pdf.actionItemsTitle'), () => {
      helpers.table({
        body: qa.actionItems.map((item, i) => [`${i + 1}.`, item]),
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 1.5, cellWidth: 'wrap', overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 10 } },
      });
    });
  }
}
