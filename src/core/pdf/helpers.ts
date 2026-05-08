import type { jsPDF } from 'jspdf';
import { autoTable, type UserOptions as AutoTableOptions } from 'jspdf-autotable';
import _html2canvas from 'html2canvas';

export interface PdfI18n {
  exportedBy: string;
  exportedAt: string;
  page: string; // pattern with {{current}} / {{total}}
}

export interface PdfHelperOptions {
  tenantName: string;
  title: string;
  exportedBy: string;
  exportedAt: Date;
  i18n: PdfI18n;
}

export interface PdfHelpers {
  header(): void;
  footer(): void;
  section(title: string, body: () => void): void;
  table(opts: AutoTableOptions): void;
  rasterizeChart(target: HTMLElement): Promise<string>;
}

const HEADER_HEIGHT_MM = 18;
const FOOTER_HEIGHT_MM = 12;
const LINE_GAP_MM = 6;

type Html2CanvasFn = typeof _html2canvas;
type AutoTableFn = typeof autoTable;

interface AutoTableHandle {
  lastAutoTable?: { finalY: number };
}

export function createPdfHelpers(
  doc: jsPDF,
  opts: PdfHelperOptions,
  html2canvasFn: Html2CanvasFn = _html2canvas,
  autoTableFn: AutoTableFn = autoTable,
): PdfHelpers {
  const pageWidth = doc.internal.pageSize.getWidth();
  let yCursor = HEADER_HEIGHT_MM + 4;

  function header() {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(opts.tenantName, 12, 10);
    doc.setFont('helvetica', 'normal');
    doc.text(opts.title, pageWidth / 2, 10, { align: 'center' });
    const meta = `${opts.i18n.exportedBy}: ${opts.exportedBy}`;
    const date = `${opts.i18n.exportedAt}: ${opts.exportedAt.toISOString()}`;
    doc.setFontSize(8);
    doc.text(meta, pageWidth - 12, 8, { align: 'right' });
    doc.text(date, pageWidth - 12, 12, { align: 'right' });
    doc.setLineWidth(0.2);
    doc.line(12, 14, pageWidth - 12, 14);
  }

  function footer() {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      const label = opts.i18n.page
        .replace('{{current}}', String(i))
        .replace('{{total}}', String(total));
      doc.setFontSize(8);
      doc.text(label, pageWidth / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
    }
  }

  function section(title: string, body: () => void) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 12, yCursor);
    yCursor += LINE_GAP_MM;
    doc.setFont('helvetica', 'normal');
    body();
    yCursor += LINE_GAP_MM;
  }

  function table(at: AutoTableOptions) {
    autoTableFn(doc, {
      startY: yCursor,
      margin: { top: HEADER_HEIGHT_MM + 4, bottom: FOOTER_HEIGHT_MM },
      ...at,
    });
    const handle = doc as unknown as AutoTableHandle;
    const lastY = handle.lastAutoTable?.finalY ?? yCursor;
    yCursor = lastY + LINE_GAP_MM;
  }

  async function rasterizeChart(target: HTMLElement): Promise<string> {
    const canvas = await html2canvasFn(target, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
    return canvas.toDataURL('image/png');
  }

  return { header, footer, section, table, rasterizeChart };
}
