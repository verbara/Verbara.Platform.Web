import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { PdfDownloadButton } from './pdf-download-button';

const saveSpy = vi.fn();

vi.mock('@/core/pdf/engine', () => {
  class FakePdf {
    save = saveSpy;
    setProperties = vi.fn();
    text = vi.fn();
    setFontSize = vi.fn();
    setFont = vi.fn();
    setLineWidth = vi.fn();
    line = vi.fn();
    getNumberOfPages = () => 1;
    setPage = vi.fn();
    addPage = vi.fn();
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
  }
  return {
    jsPDF: FakePdf,
    autoTable: vi.fn(),
    html2canvas: vi.fn(),
    createPdfHelpers: () => ({
      header: vi.fn(),
      footer: vi.fn(),
      section: vi.fn((_t: string, body: () => void) => body()),
      table: vi.fn(),
      rasterizeChart: vi.fn().mockResolvedValue('data:image/png;base64,X'),
    }),
  };
});

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: (selector: (s: { user: { email: string } }) => unknown) =>
    selector({ user: { email: 'u@x' } }),
}));
vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: (selector: (s: { activeTenantId: string }) => unknown) =>
    selector({ activeTenantId: 't1' }),
}));
vi.mock('@/core/api/hooks/use-tenants', () => ({
  useTenant: () => ({ data: { tenantId: 't1', name: 'Acme' } }),
}));
vi.mock('@/core/observability/sentry', () => ({ addSentryBreadcrumb: vi.fn() }));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      fallbackLng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      resources: {
        'en-US': {
          common: {
            export: {
              pdf: {
                button: 'Download PDF',
                buttonAriaLabel: 'Download as PDF',
                preparing: 'Preparing PDF…',
                ready: 'PDF ready',
                failed: 'Could not generate PDF',
                header: {
                  exportedBy: 'Exported by',
                  exportedAt: 'Exported at',
                  page: 'Page {{current}} of {{total}}',
                },
              },
            },
          },
        },
      },
    });
  }
});

function wrap(ui: ReactNode) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

describe('PdfDownloadButton', () => {
  it('Renders_WithI18nLabel_AndAriaLabel', () => {
    render(
      wrap(<PdfDownloadButton filename="x.pdf" documentTitle="X" onGenerate={async () => {}} />),
    );
    const btn = screen.getByRole('button', { name: /download as pdf/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Download PDF');
  });

  it('CallsOnGenerate_WithDocAndHelpers_OnClick', async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(wrap(<PdfDownloadButton filename="x.pdf" documentTitle="X" onGenerate={onGenerate} />));
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(onGenerate).toHaveBeenCalled());
    const ctx = onGenerate.mock.calls[0]?.[0];
    expect(ctx).toHaveProperty('doc');
    expect(ctx).toHaveProperty('helpers');
  });

  it('SetsAriaBusyTrue_DuringGeneration', async () => {
    let resolveGen: () => void = () => {};
    const onGenerate = vi.fn(() => new Promise<void>((r) => (resolveGen = r)));
    render(wrap(<PdfDownloadButton filename="x.pdf" documentTitle="X" onGenerate={onGenerate} />));
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-busy', 'true'));
    resolveGen();
    await waitFor(() => expect(btn).toHaveAttribute('aria-busy', 'false'));
  });

  it('SurfacesErrorToast_OnGeneratorThrow', async () => {
    const { toast } = await import('sonner');
    const onGenerate = vi.fn().mockRejectedValue(new Error('boom'));
    render(wrap(<PdfDownloadButton filename="x.pdf" documentTitle="X" onGenerate={onGenerate} />));
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not generate PDF'));
  });

  it('CallsDocSave_WithFilename_AfterGenerate', async () => {
    saveSpy.mockClear();
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(
      wrap(
        <PdfDownloadButton filename="my-export.pdf" documentTitle="X" onGenerate={onGenerate} />,
      ),
    );
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(saveSpy).toHaveBeenCalledWith('my-export.pdf'));
  });
});
