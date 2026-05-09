import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PdfDownloadButton } from '@/core/ui/pdf-download-button';
import { Button } from '@/core/ui/button';
import { FileDown } from 'lucide-react';
import { useCdrList } from '@/core/api/hooks/use-analytics';
import {
  renderCdrSummary,
  summarizeCdrRows,
  type CdrSummaryData,
} from './templates/cdr-summary-template';
import type { ScheduledReport } from '@/core/api/hooks/use-reports';

interface ReportPdfButtonProps {
  readonly report: ScheduledReport;
}

function makeFilename(report: ScheduledReport): string {
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = report.name.toLowerCase().replaceAll(/[^a-z0-9-]+/g, '-');
  return `${safeName}-${stamp}.pdf`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function thirtyDaysAgoIsoDate(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Adds a "Download PDF (preview)" button for scheduled reports with `format=PDF`.
 * For `conversation_summary` type, renders the CDR Summary template with the last
 * 30 days of CDR data — this is a client-side preview, distinct from any
 * backend-generated PDF served from the execution history.
 * For other types, the button is disabled with a tooltip indicating the limitation.
 */
export function ReportPdfButton({ report }: ReportPdfButtonProps) {
  const { t } = useTranslation('admin');
  const isSupported = report.type === 'conversation_summary';
  // Always call the hook so the rules of hooks are respected, but pass `enabled`
  // implicitly via React Query's caching: the same period reuses the same result.
  const from = thirtyDaysAgoIsoDate();
  const to = todayIsoDate();
  const { data: cdrPage } = useCdrList(from, to, undefined, 1);

  if (report.format !== 'PDF') return null;

  if (!isSupported) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        disabled
        title={t('reports.pdfNotYetSupported')}
        onClick={(e) => {
          e.stopPropagation();
          toast.message(t('reports.pdfNotYetSupported'));
        }}
        data-testid={`report-pdf-${report.id}`}
      >
        <FileDown className="h-3.5 w-3.5" />
      </Button>
    );
  }

  const rows = cdrPage?.items ?? [];
  const data: CdrSummaryData = {
    period: { from, to },
    kpis: summarizeCdrRows(rows),
    rows,
  };

  return (
    <span onClickCapture={(e) => e.stopPropagation()} className="inline-flex">
      <PdfDownloadButton
        filename={makeFilename(report)}
        documentTitle={t('reports.pdf.cdr.documentTitle', { name: report.name })}
        size="sm"
        onGenerate={async ({ doc, helpers }) => {
          renderCdrSummary({
            doc,
            helpers,
            data,
            t: (key) => t(key.replace(/^admin\./, '')),
          });
        }}
      >
        <FileDown className="h-3.5 w-3.5" />
      </PdfDownloadButton>
    </span>
  );
}
