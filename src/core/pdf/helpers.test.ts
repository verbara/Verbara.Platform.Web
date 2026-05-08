import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { createPdfHelpers, type PdfHelperOptions } from './helpers';

const baseI18n = {
  exportedBy: 'Exported by',
  exportedAt: 'Exported at',
  page: 'Page {{current}} of {{total}}',
};

function baseOpts(): PdfHelperOptions {
  return {
    tenantName: 'Acme',
    title: 'CDR Detail',
    exportedBy: 'agent@acme.com',
    exportedAt: new Date('2026-05-08T14:30:00Z'),
    i18n: baseI18n,
  };
}

describe('createPdfHelpers', () => {
  it('Header_DrawsTenantTitleAndExporter', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const textSpy = vi.spyOn(doc, 'text');
    const helpers = createPdfHelpers(doc, baseOpts());
    helpers.header();
    const calls = textSpy.mock.calls.map((c) => String(c[0]));
    expect(calls).toContain('Acme');
    expect(calls).toContain('CDR Detail');
    expect(calls.some((c) => c.includes('agent@acme.com'))).toBe(true);
    expect(calls.some((c) => c.includes('2026-05-08T14:30:00'))).toBe(true);
  });

  it('Footer_DrawsPageOfTotal_OnEveryPage', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    doc.addPage();
    doc.addPage();
    const textSpy = vi.spyOn(doc, 'text');
    const helpers = createPdfHelpers(doc, baseOpts());
    helpers.footer();
    const calls = textSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.filter((c) => /Page \d+ of 3/.test(c))).toHaveLength(3);
    expect(calls).toContain('Page 1 of 3');
    expect(calls).toContain('Page 3 of 3');
  });

  it('Section_AdvancesYCursor_AndCallsBody', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const helpers = createPdfHelpers(doc, baseOpts());
    const body = vi.fn();
    helpers.section('Summary', body);
    expect(body).toHaveBeenCalledOnce();
  });

  it('Table_InvokesAutoTable_WithStartYFromCursor', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const autoTableMock = vi.fn();
    const helpers = createPdfHelpers(doc, baseOpts(), undefined, autoTableMock);
    helpers.table({ body: [['a', 'b']] });
    expect(autoTableMock).toHaveBeenCalledOnce();
    const callArg = autoTableMock.mock.calls[0]?.[1] as { startY?: number };
    expect(callArg.startY).toBeGreaterThan(0);
  });

  it('RasterizeChart_ReturnsBase64Png_FromHtml2Canvas', async () => {
    const fakeCanvas = { toDataURL: () => 'data:image/png;base64,FAKE' } as HTMLCanvasElement;
    const html2canvasMock = vi
      .fn()
      .mockResolvedValue(fakeCanvas) as unknown as typeof import('html2canvas').default;
    const target = document.createElement('div');
    document.body.appendChild(target);
    const helpers = createPdfHelpers(new jsPDF(), baseOpts(), html2canvasMock);
    const dataUrl = await helpers.rasterizeChart(target);
    expect(dataUrl).toBe('data:image/png;base64,FAKE');
    expect(html2canvasMock).toHaveBeenCalledWith(
      target,
      expect.objectContaining({ scale: 2, backgroundColor: '#ffffff' }),
    );
  });
});
