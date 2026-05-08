import { useState, type ReactNode } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/core/ui/button';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useTenant } from '@/core/api/hooks/use-tenants';
import { addSentryBreadcrumb } from '@/core/observability/sentry';
import type { PdfHelpers } from '@/core/pdf';
import type { jsPDF as JsPdfType } from 'jspdf';

type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
type ButtonSize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

export interface PdfGenerationContext {
  doc: JsPdfType;
  helpers: PdfHelpers;
}

interface PdfDownloadButtonProps {
  readonly filename: string;
  readonly documentTitle: string;
  readonly onGenerate: (ctx: PdfGenerationContext) => Promise<void>;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
}

export function PdfDownloadButton({
  filename,
  documentTitle,
  onGenerate,
  variant = 'outline',
  size,
  children,
  disabled,
}: PdfDownloadButtonProps) {
  const { t } = useTranslation('common');
  const user = useAuthStore((s) => s.user);
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const { data: tenant } = useTenant(activeTenantId ?? '');
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    const start = performance.now();
    try {
      const engine = await import('@/core/pdf/engine');
      const { jsPDF, createPdfHelpers } = engine;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      doc.setProperties({ title: documentTitle });
      const helpers = createPdfHelpers(doc, {
        tenantName: tenant?.name ?? activeTenantId ?? '—',
        title: documentTitle,
        exportedBy: user?.email ?? '—',
        exportedAt: new Date(),
        i18n: {
          exportedBy: t('export.pdf.header.exportedBy'),
          exportedAt: t('export.pdf.header.exportedAt'),
          page: t('export.pdf.header.page'),
        },
      });
      helpers.header();
      await onGenerate({ doc, helpers });
      helpers.footer();
      doc.save(filename);
      const durationMs = Math.round(performance.now() - start);
      addSentryBreadcrumb('pdf.export', `${documentTitle} (${filename}, ${durationMs}ms)`, 'info');
    } catch (err) {
      toast.error(t('export.pdf.failed'));
      // eslint-disable-next-line no-console -- surface generation errors for diagnostics
      console.error('[pdf-download]', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      aria-label={t('export.pdf.buttonAriaLabel')}
      aria-busy={busy}
      disabled={disabled ?? busy}
      data-print="hide"
    >
      {busy ? (
        <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
      )}
      {children ?? (busy ? t('export.pdf.preparing') : t('export.pdf.button'))}
    </Button>
  );
}
