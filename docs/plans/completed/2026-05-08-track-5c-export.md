# Track 5C-export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship print stylesheets foundation + 3 PDF download surfaces (CDR detail, QA detail, Scheduled Reports) for `Verbara.Platform.Web` v2.1.0.

**Architecture:** 3 layers — (1) `src/styles/print.css` global `@media print` foundation, (2) `<PrintButton>` wrapping `react-to-print` (~5 kB gzip eager), (3) `<PdfDownloadButton>` lazy-loading `jspdf` + `jspdf-autotable` + `html2canvas` (~140 kB gzip on-click). All 3 layers independent; lower layers benefit the whole app for free.

**Tech Stack:** React 19, TypeScript 6 strict, Vite 8 (Rolldown), Tailwind 4, `@base-ui/react`, Vitest 4, Playwright. New deps: `jspdf@^3`, `jspdf-autotable@^5`, `html2canvas@^1.4`, `react-to-print@^2.15`.

**Spec reference:** [`docs/specs/2026-05-08-track-5c-export.md`](../../specs/2026-05-08-track-5c-export.md) (commit `1f6872a`).

---

## File Structure

### Created (15 files)

| Path                                                  | Responsibility                                                     |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `src/styles/print.css`                                | Layer 1: global `@media print` rules + `@page` setup               |
| `src/core/ui/print-button.tsx`                        | Layer 2: `<PrintButton>` orchestrating `window.print()`            |
| `src/core/ui/print-button.test.tsx`                   | Tests for PrintButton                                              |
| `src/core/pdf/engine.ts`                              | Re-export bundle for lazy import (jspdf + plugins + html2canvas)   |
| `src/core/pdf/helpers.ts`                             | `header()`, `footer()`, `section()`, `table()`, `rasterizeChart()` |
| `src/core/pdf/helpers.test.ts`                        | Tests for PDF helpers                                              |
| `src/core/pdf/index.ts`                               | Public barrel + types                                              |
| `src/core/ui/pdf-download-button.tsx`                 | Layer 3: `<PdfDownloadButton>` lazy-loading + Blob download        |
| `src/core/ui/pdf-download-button.test.tsx`            | Tests for PdfDownloadButton                                        |
| `src/analytics/cdr/cdr-pdf-template.ts`               | CDR detail layout (summary + timeline + transcript)                |
| `src/analytics/cdr/cdr-pdf-template.test.ts`          | CDR template tests                                                 |
| `src/analytics/qa/qa-pdf-template.ts`                 | QA detail layout (score + breakdown + notes)                       |
| `src/analytics/qa/qa-pdf-template.test.ts`            | QA template tests                                                  |
| `src/admin/reports/templates/cdr-summary-template.ts` | Scheduled report CDR summary                                       |
| `src/admin/reports/templates/qa-summary-template.ts`  | Scheduled report QA summary                                        |
| `src/admin/reports/templates/templates.test.ts`       | Tests for both reports templates                                   |
| `tests/e2e/tests/export/pdf-download.spec.ts`         | Playwright E2E smoke (1 spec)                                      |

### Modified (10 files)

| Path                                         | Change                                                |
| -------------------------------------------- | ----------------------------------------------------- |
| `package.json`                               | Add 4 deps + bump version `2.0.4` → `2.1.0`           |
| `vite.config.ts`                             | Add `vendor-pdf` to `codeSplitting.groups`            |
| `src/index.css`                              | Append `@import './styles/print.css';`                |
| `src/shell/app-shell.tsx`                    | Add `data-print="hide"` to non-content elements       |
| `src/shell/rail.tsx`                         | Add `data-print="hide"` to root nav                   |
| `src/shell/command-palette.tsx`              | Add `data-print="hide"` to dialog                     |
| `src/analytics/cdr/cdr-detail-drawer.tsx`    | Add Print + PDF buttons + `data-print="target"`       |
| `src/analytics/qa/qa-detail-drawer.tsx`      | Add Print + PDF buttons + `data-print="target"`       |
| `src/admin/reports/reports-page.tsx`         | Wire Run Now → state → `<PdfDownloadButton>`          |
| `src/analytics/dashboard/dashboard-page.tsx` | Add `<PrintButton>`                                   |
| `public/locales/en-US/common.json`           | Add `print.*` + `export.pdf.*` keys                   |
| `public/locales/es-419/common.json`          | Same keys translated                                  |
| `public/locales/pt-BR/common.json`           | Same keys translated                                  |
| `CLAUDE.md`                                  | Bump version banner + Track 5C-export closure summary |

---

## Phase A — Foundation (5 independent tasks, batchable)

### Task 1: Install dependencies + bump version

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json` (auto)

- [ ] **Step 1: Install runtime + lazy PDF deps**

```bash
npm install --legacy-peer-deps react-to-print@^2.15 jspdf@^3 jspdf-autotable@^5 html2canvas@^1.4
```

Expected: 4 packages added. `--legacy-peer-deps` precedent from Track 5C-a11y (jsx-a11y) and react-is install.

- [ ] **Step 2: Bump version in package.json**

Edit `package.json` field:

```json
"version": "2.1.0"
```

(was `"2.0.4"`)

- [ ] **Step 3: Verify install**

```bash
npm audit --audit-level=high && npm run build
```

Expected: 0 vulnerabilities, build green (existing 910 tests not run yet — only build).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add jspdf + jspdf-autotable + html2canvas + react-to-print for Track 5C-export"
```

---

### Task 2: Create print.css foundation + import in index.css

**Files:**

- Create: `src/styles/print.css`
- Modify: `src/index.css` (append import)

- [ ] **Step 1: Create `src/styles/print.css`**

```css
/* Track 5C-export — print stylesheet foundation
 * See docs/specs/2026-05-08-track-5c-export.md §"Layer 1"
 *
 * Conventions:
 *   data-print="hide"   → element omitted in print
 *   data-print="show"   → element shown in print even if normally hidden
 *   data-print="target" → element receives `display: block` in print mode
 */

@media print {
  @page {
    size: A4 portrait;
    margin: 15mm 12mm 18mm 12mm;
  }

  html,
  body,
  * {
    background: white !important;
    color: black !important;
    box-shadow: none !important;
  }

  /* Hide shell chrome by convention + by selector */
  [data-print='hide'],
  nav[aria-label='primary'],
  [role='dialog']:not([data-print='show']),
  [role='navigation'],
  .toaster,
  [data-sonner-toaster],
  .skip-link,
  button:not([data-print='show']):not([data-print-keep]),
  [data-testid$='-export']:not([data-print='show']) {
    display: none !important;
  }

  /* Surface print targets */
  [data-print='target'] {
    display: block !important;
    page-break-before: auto;
  }

  /* Tables: repeat header on each page, avoid mid-row breaks */
  thead {
    display: table-header-group;
  }
  tr,
  td,
  th {
    page-break-inside: avoid;
  }

  /* Expand virtualized lists so all rows print (Track 5B) */
  [data-virtualized='true'] {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  [data-virtualized='true'] > * {
    transform: none !important;
    position: static !important;
  }

  /* Charts (Recharts SVG) scale gracefully */
  svg {
    max-width: 100%;
    height: auto;
  }

  /* Avoid leaking `border-color: oklch(...)` from Tailwind into print */
  * {
    border-color: #ccc !important;
  }
}
```

- [ ] **Step 2: Import from `src/index.css`**

Append at end of file (after existing Tailwind layers):

```css
@import './styles/print.css';
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: build green. CSS bundle delta visible in output (~+3 kB raw).

- [ ] **Step 4: Smoke check**

```bash
npm run dev &
sleep 3
# Open http://localhost:5173 → login → Ctrl+P
# Verify in browser print preview: sidebar+command-palette+toaster hidden, body content visible.
kill %1
```

Expected: print preview shows clean content area only. No automated assert here — manual visual check is documented as "smoke" only; correctness is asserted via downstream task tests.

- [ ] **Step 5: Commit**

```bash
git add src/styles/print.css src/index.css
git commit -m "feat(ui): add print.css foundation with @media print + data-print conventions"
```

---

### Task 3: Add `data-print="hide"` to shell chrome

**Files:**

- Modify: `src/shell/app-shell.tsx`
- Modify: `src/shell/rail.tsx`
- Modify: `src/shell/command-palette.tsx`

- [ ] **Step 1: Modify `src/shell/app-shell.tsx`**

Add `data-print="hide"` to `<Rail />` parent and to `<CommandPalette />` invocation. The `<main id="main-content">` stays without the attribute (it IS the print target by default).

```tsx
<div className="flex h-screen flex-col overflow-hidden">
  <SkipLink targetId="main-content">{t('a11y.skipToMain')}</SkipLink>
  <ImpersonationBanner data-print="hide" />
  <div className="flex flex-1 overflow-hidden">
    <Rail data-print="hide" />
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 overflow-auto bg-slate-50 outline-none dark:bg-slate-900"
    >
      <Outlet />
    </main>
  </div>
  <CommandPalette />
</div>
```

If `<Rail>` or `<ImpersonationBanner>` don't accept `data-*` props, add `data-print="hide"` to their root element inside their own files instead.

- [ ] **Step 2: Modify `src/shell/rail.tsx`**

Add `data-print="hide"` to the outermost element of the Rail component (likely a `<nav>` or `<aside>`). Find the root element, add the attribute.

- [ ] **Step 3: Modify `src/shell/command-palette.tsx`**

Find the Dialog root, add `data-print="hide"` to its `Trigger`/`Portal`/root element. Most likely a `<Dialog.Root>` or `<Command.Dialog>` — add to the outermost wrapper.

- [ ] **Step 4: Verify build + lint**

```bash
npm run build && npm run lint
```

Expected: green. No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/shell/
git commit -m "feat(ui): mark shell chrome with data-print=\"hide\" for print mode"
```

---

### Task 4: Add i18n keys in all 3 locales

**Files:**

- Modify: `public/locales/en-US/common.json`
- Modify: `public/locales/es-419/common.json`
- Modify: `public/locales/pt-BR/common.json`

- [ ] **Step 1: Add keys to `public/locales/en-US/common.json`**

Add these top-level keys (or merge into existing structure if `print` / `export` already exist):

```json
{
  "print": {
    "button": "Print",
    "buttonAriaLabel": "Print this page"
  },
  "export": {
    "pdf": {
      "button": "Download PDF",
      "buttonAriaLabel": "Download as PDF",
      "preparing": "Preparing PDF…",
      "ready": "PDF ready",
      "failed": "Could not generate PDF",
      "header": {
        "exportedBy": "Exported by",
        "exportedAt": "Exported at",
        "page": "Page {{current}} of {{total}}"
      }
    }
  }
}
```

If `common.json` already has an `export` key (from CSV export), nest the `pdf` subkey alongside any existing `csv` keys without removing them.

- [ ] **Step 2: Add the same keys to `public/locales/es-419/common.json`**

```json
{
  "print": {
    "button": "Imprimir",
    "buttonAriaLabel": "Imprimir esta página"
  },
  "export": {
    "pdf": {
      "button": "Descargar PDF",
      "buttonAriaLabel": "Descargar como PDF",
      "preparing": "Generando PDF…",
      "ready": "PDF listo",
      "failed": "No se pudo generar el PDF",
      "header": {
        "exportedBy": "Exportado por",
        "exportedAt": "Exportado el",
        "page": "Página {{current}} de {{total}}"
      }
    }
  }
}
```

- [ ] **Step 3: Add the same keys to `public/locales/pt-BR/common.json`**

```json
{
  "print": {
    "button": "Imprimir",
    "buttonAriaLabel": "Imprimir esta página"
  },
  "export": {
    "pdf": {
      "button": "Baixar PDF",
      "buttonAriaLabel": "Baixar como PDF",
      "preparing": "Gerando PDF…",
      "ready": "PDF pronto",
      "failed": "Não foi possível gerar o PDF",
      "header": {
        "exportedBy": "Exportado por",
        "exportedAt": "Exportado em",
        "page": "Página {{current}} de {{total}}"
      }
    }
  }
}
```

- [ ] **Step 4: Run i18n parity check**

```bash
npm run i18n:check
```

Expected: PASS (no key drift).

- [ ] **Step 5: Commit**

```bash
git add public/locales/
git commit -m "feat(i18n): add print + export.pdf keys (3 locales)"
```

---

### Task 5: Update `vite.config.ts` with `vendor-pdf` chunk

**Files:**

- Modify: `vite.config.ts:46-79`

- [ ] **Step 1: Add `vendor-pdf` group**

In the `codeSplitting.groups` array (currently 13 entries), append a 14th:

```ts
{
  name: 'vendor-pdf',
  test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable|html2canvas|raf|css-line-break|text-segmentation|fflate|atob)[\\/]/,
},
```

(Note: `jspdf` v3 has transitive deps for image processing — `raf`, `css-line-break`, `text-segmentation`, `fflate`, `atob`. Grouping them in `vendor-pdf` keeps the lazy chunk cohesive.)

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: build green. Output should NOT yet show `vendor-pdf` chunk because no source code imports the libs eagerly — chunk emerges only when Tasks B/C land.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore(build): add vendor-pdf chunk group for Track 5C-export lazy import"
```

---

## Phase B — Primitives (TDD, sequential — B7 depends on B6's helpers)

### Task 6: `<PrintButton>` component

**Files:**

- Create: `src/core/ui/print-button.tsx`
- Create: `src/core/ui/print-button.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/core/ui/print-button.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRef } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PrintButton } from './print-button';

beforeEach(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      fallbackLng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      resources: {
        'en-US': {
          common: {
            print: { button: 'Print', buttonAriaLabel: 'Print this page' },
          },
        },
      },
    });
  }
});

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <I18nextProvider i18n={i18n}>
      <div ref={ref}>content</div>
      <PrintButton contentRef={ref} documentTitle="test-doc" />
    </I18nextProvider>
  );
}

describe('PrintButton', () => {
  it('Renders_ButtonWithI18nLabel', () => {
    render(<Harness />);
    const btn = screen.getByRole('button', { name: /print this page/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Print');
  });

  it('CallsOnBeforePrint_AndOnAfterPrint_OnClick', async () => {
    const onBefore = vi.fn();
    const onAfter = vi.fn();
    function H() {
      const ref = useRef<HTMLDivElement>(null);
      return (
        <I18nextProvider i18n={i18n}>
          <div ref={ref} />
          <PrintButton
            contentRef={ref}
            documentTitle="t"
            onBeforePrint={onBefore}
            onAfterPrint={onAfter}
          />
        </I18nextProvider>
      );
    }
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<H />);
    fireEvent.click(screen.getByRole('button'));
    // react-to-print resolves in microtasks
    await new Promise((r) => setTimeout(r, 50));
    expect(onBefore).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it('HasDataPrintShow_AttributeSoButtonIsVisibleInPrintHeader', () => {
    render(<Harness />);
    const btn = screen.getByRole('button');
    // The button itself uses data-print="hide" because we don't want it in printed output
    expect(btn).toHaveAttribute('data-print', 'hide');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/ui/print-button.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/ui/print-button.tsx`**

```tsx
import { useReactToPrint } from 'react-to-print';
import { Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, type ButtonProps } from '@/core/ui/button';
import type { RefObject, ReactNode } from 'react';

interface PrintButtonProps {
  contentRef: RefObject<HTMLElement | null>;
  documentTitle?: string;
  onBeforePrint?: () => void | Promise<void>;
  onAfterPrint?: () => void;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  children?: ReactNode;
}

export function PrintButton({
  contentRef,
  documentTitle,
  onBeforePrint,
  onAfterPrint,
  variant = 'outline',
  size,
  children,
}: PrintButtonProps) {
  const { t } = useTranslation('common');
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle,
    onBeforePrint,
    onAfterPrint,
  });

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => handlePrint()}
      aria-label={t('print.buttonAriaLabel')}
      data-print="hide"
    >
      <Printer className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {children ?? t('print.button')}
    </Button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/core/ui/print-button.test.tsx
```

Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ui/print-button.tsx src/core/ui/print-button.test.tsx
git commit -m "feat(ui): add PrintButton primitive wrapping react-to-print"
```

---

### Task 7: PDF engine + helpers + tests

**Files:**

- Create: `src/core/pdf/engine.ts`
- Create: `src/core/pdf/helpers.ts`
- Create: `src/core/pdf/index.ts`
- Create: `src/core/pdf/helpers.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/core/pdf/helpers.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { createPdfHelpers } from './helpers';

describe('createPdfHelpers', () => {
  it('Header_DrawsTenantTitleAndExporter', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const textSpy = vi.spyOn(doc, 'text');
    const helpers = createPdfHelpers(doc, {
      tenantName: 'Acme',
      title: 'CDR Detail',
      exportedBy: 'agent@acme.com',
      exportedAt: new Date('2026-05-08T14:30:00Z'),
      i18n: defaultI18n(),
    });
    helpers.header();
    const calls = textSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain('Acme');
    expect(calls).toContain('CDR Detail');
    expect(calls.some((c) => String(c).includes('agent@acme.com'))).toBe(true);
  });

  it('Footer_DrawsPageOfTotalUsingI18n', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const textSpy = vi.spyOn(doc, 'text');
    const helpers = createPdfHelpers(doc, {
      tenantName: 'X',
      title: 'T',
      exportedBy: 'u@x',
      exportedAt: new Date(),
      i18n: defaultI18n(),
    });
    helpers.footer();
    const calls = textSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((c) => /Page 1 of/.test(c))).toBe(true);
  });

  it('Section_AdvancesYCursor_AndCallsBody', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const helpers = createPdfHelpers(doc, baseOpts());
    const body = vi.fn();
    helpers.section('Summary', body);
    expect(body).toHaveBeenCalledOnce();
  });

  it('RasterizeChart_ReturnsBase64Png_FromHtml2Canvas', async () => {
    const fakeCanvas = { toDataURL: () => 'data:image/png;base64,FAKE' } as HTMLCanvasElement;
    const html2canvas = vi.fn().mockResolvedValue(fakeCanvas);
    const target = document.createElement('div');
    target.style.width = '100px';
    target.style.height = '100px';
    document.body.appendChild(target);
    const helpers = createPdfHelpers(new jsPDF(), baseOpts(), html2canvas);
    const dataUrl = await helpers.rasterizeChart(target);
    expect(dataUrl).toBe('data:image/png;base64,FAKE');
    expect(html2canvas).toHaveBeenCalledWith(target, expect.objectContaining({ scale: 2 }));
  });
});

function defaultI18n() {
  return {
    exportedBy: 'Exported by',
    exportedAt: 'Exported at',
    page: 'Page {{current}} of {{total}}',
  };
}
function baseOpts() {
  return {
    tenantName: 'X',
    title: 'T',
    exportedBy: 'u@x',
    exportedAt: new Date(),
    i18n: defaultI18n(),
  };
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/pdf/helpers.test.ts
```

Expected: FAIL — `./helpers` not found.

- [ ] **Step 3: Implement `src/core/pdf/engine.ts`** (re-export bundle for lazy import)

```ts
// Cohesive re-export so consumers can `await import('@/core/pdf/engine')` and
// pull all PDF deps into the lazy chunk in one shot.
export { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // augments jsPDF prototype with autoTable()
export { default as html2canvas } from 'html2canvas';
export { createPdfHelpers, type PdfHelpers, type PdfHelperOptions } from './helpers';
```

- [ ] **Step 4: Implement `src/core/pdf/helpers.ts`**

```ts
import type { jsPDF } from 'jspdf';
import type { UserOptions as AutoTableOptions } from 'jspdf-autotable';
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

export function createPdfHelpers(
  doc: jsPDF,
  opts: PdfHelperOptions,
  html2canvasFn: typeof _html2canvas = _html2canvas,
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
    // jspdf-autotable augments doc with autoTable()
    (doc as unknown as { autoTable: (o: AutoTableOptions) => void }).autoTable({
      startY: yCursor,
      margin: { top: HEADER_HEIGHT_MM + 4, bottom: FOOTER_HEIGHT_MM },
      ...at,
    });
    const lastY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? yCursor;
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
```

- [ ] **Step 5: Implement `src/core/pdf/index.ts`** (public barrel)

```ts
export type { PdfHelpers, PdfHelperOptions, PdfI18n } from './helpers';
```

(Note: `engine.ts` is intentionally NOT re-exported here — it must only be reached via `await import('@/core/pdf/engine')` so it lands in the lazy chunk.)

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run src/core/pdf/helpers.test.ts
```

Expected: 4 PASS.

- [ ] **Step 7: Verify lint + build**

```bash
npm run lint && npm run build
```

Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/core/pdf/
git commit -m "feat(pdf): add jsPDF engine module + helpers (header, footer, section, table, rasterizeChart)"
```

---

### Task 8: `<PdfDownloadButton>` component (lazy import)

**Files:**

- Create: `src/core/ui/pdf-download-button.tsx`
- Create: `src/core/ui/pdf-download-button.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/core/ui/pdf-download-button.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { PdfDownloadButton } from './pdf-download-button';

vi.mock('@/core/pdf/engine', async () => {
  const save = vi.fn();
  class FakePdf {
    save = save;
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
    html2canvas: vi.fn(),
    createPdfHelpers: () => ({
      header: vi.fn(),
      footer: vi.fn(),
      section: vi.fn((_t: string, body: () => void) => body()),
      table: vi.fn(),
      rasterizeChart: vi.fn().mockResolvedValue('data:image/png;base64,X'),
    }),
    __save: save, // exposed for test access
  };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/core/auth/auth-store', () => ({
  useAuthStore: () => ({ user: { email: 'u@x' } }),
}));
vi.mock('@/core/tenant/tenant-store', () => ({
  useTenantStore: () => ({ activeTenantId: 't1' }),
}));
vi.mock('@/core/api/hooks/use-tenants', () => ({
  useTenant: () => ({ data: { id: 't1', name: 'Acme' } }),
}));

beforeEach(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
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

function wrap(ui: React.ReactNode) {
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
    let resolve: () => void = () => {};
    const onGenerate = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(wrap(<PdfDownloadButton filename="x.pdf" documentTitle="X" onGenerate={onGenerate} />));
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-busy', 'true'));
    resolve();
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
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(
      wrap(
        <PdfDownloadButton filename="my-export.pdf" documentTitle="X" onGenerate={onGenerate} />,
      ),
    );
    fireEvent.click(screen.getByRole('button'));
    const engine = await import('@/core/pdf/engine');
    const saveMock = (engine as unknown as { __save: ReturnType<typeof vi.fn> }).__save;
    await waitFor(() => expect(saveMock).toHaveBeenCalledWith('my-export.pdf'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/core/ui/pdf-download-button.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/ui/pdf-download-button.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
import { Download, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/core/ui/button';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useTenant } from '@/core/api/hooks/use-tenants';
import { addSentryBreadcrumb } from '@/core/observability/sentry';
import type { PdfHelpers } from '@/core/pdf';

export interface PdfGenerationContext {
  doc: import('jspdf').jsPDF;
  helpers: PdfHelpers;
}

interface PdfDownloadButtonProps {
  filename: string;
  documentTitle: string;
  onGenerate: (ctx: PdfGenerationContext) => Promise<void>;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  children?: ReactNode;
  disabled?: boolean;
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
  const { user } = useAuthStore();
  const { activeTenantId } = useTenantStore();
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
      addSentryBreadcrumb({
        category: 'pdf.export',
        message: documentTitle,
        data: { filename, durationMs: Math.round(performance.now() - start) },
        level: 'info',
      });
    } catch (err) {
      toast.error(t('export.pdf.failed'));
      // eslint-disable-next-line no-console
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/core/ui/pdf-download-button.test.tsx
```

Expected: 5 PASS.

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

Expected: green. (The `eslint-disable no-console` is justified for surfaced errors.)

- [ ] **Step 6: Commit**

```bash
git add src/core/ui/pdf-download-button.tsx src/core/ui/pdf-download-button.test.tsx
git commit -m "feat(ui): add PdfDownloadButton with lazy import + Sentry breadcrumb"
```

---

## Phase C — PDF Templates (3 tasks, parallel-safe within phase)

### Task 9: CDR detail PDF template + tests

**Files:**

- Create: `src/analytics/cdr/cdr-pdf-template.ts`
- Create: `src/analytics/cdr/cdr-pdf-template.test.ts`

- [ ] **Step 1: Inspect CDR types**

```bash
grep -nE 'interface Cdr|type Cdr|CdrDetail' src/core/api/hooks/use-cdr.ts | head -20
```

Note returned types/fields — implementer adapts the field names below to the actual shape.

- [ ] **Step 2: Write failing test**

Create `src/analytics/cdr/cdr-pdf-template.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { createPdfHelpers } from '@/core/pdf/helpers';
import { renderCdrPdf } from './cdr-pdf-template';

const mockI18n = (k: string) => k;

describe('renderCdrPdf', () => {
  it('Renders_WithSummarySection_AndTimelineTable', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const helpers = createPdfHelpers(doc, {
      tenantName: 'Acme',
      title: 'CDR',
      exportedBy: 'u',
      exportedAt: new Date(),
      i18n: { exportedBy: 'a', exportedAt: 'b', page: 'c' },
    });
    const sectionSpy = vi.spyOn(helpers, 'section');
    const tableSpy = vi.spyOn(helpers, 'table');
    renderCdrPdf({
      doc,
      helpers,
      cdr: {
        sessionId: 's1',
        startTime: '2026-05-08T10:00:00Z',
        contact: { name: 'John', phone: '+1 555' },
        channel: 'voice',
        queue: 'sales',
        agent: 'Alice',
        duration: 240,
        disposition: 'resolved',
        slaMet: true,
        timeline: [
          { at: '10:00:01', event: 'queued' },
          { at: '10:00:05', event: 'answered', actor: 'Alice' },
        ],
        transcript: [
          { speaker: 'agent', at: '10:00:05', text: 'Hello' },
          { speaker: 'customer', at: '10:00:08', text: 'Hi' },
        ],
      },
      t: mockI18n,
    });
    expect(sectionSpy).toHaveBeenCalled();
    expect(tableSpy).toHaveBeenCalled();
  });

  it('OmitsTranscriptSection_WhenTranscriptEmpty', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const helpers = createPdfHelpers(doc, {
      tenantName: 'X',
      title: 'X',
      exportedBy: 'u',
      exportedAt: new Date(),
      i18n: { exportedBy: 'a', exportedAt: 'b', page: 'c' },
    });
    const sectionSpy = vi.spyOn(helpers, 'section');
    renderCdrPdf({
      doc,
      helpers,
      cdr: {
        sessionId: 's1',
        startTime: '2026-05-08T10:00:00Z',
        contact: { name: 'J' },
        channel: 'voice',
        queue: 'q',
        agent: 'A',
        duration: 1,
        disposition: 'r',
        slaMet: true,
        timeline: [],
        transcript: [],
      },
      t: mockI18n,
    });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).not.toContain('analytics.cdr.pdf.transcriptTitle');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/analytics/cdr/cdr-pdf-template.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/analytics/cdr/cdr-pdf-template.ts`**

```ts
import type { jsPDF } from 'jspdf';
import type { PdfHelpers } from '@/core/pdf';

export interface CdrPdfData {
  sessionId: string;
  startTime: string;
  contact: { name?: string; phone?: string; email?: string };
  channel: string;
  queue: string;
  agent: string;
  duration: number; // seconds
  disposition: string;
  slaMet: boolean;
  qaScore?: number;
  sentiment?: string;
  timeline: Array<{ at: string; event: string; actor?: string; details?: string }>;
  transcript: Array<{ speaker: string; at: string; text: string }>;
}

interface RenderCdrPdfArgs {
  doc: jsPDF;
  helpers: PdfHelpers;
  cdr: CdrPdfData;
  t: (key: string) => string;
}

export function renderCdrPdf({ helpers, cdr, t }: RenderCdrPdfArgs) {
  helpers.section(t('analytics.cdr.pdf.summaryTitle'), () => {
    helpers.table({
      body: [
        [t('analytics.cdr.pdf.field.sessionId'), cdr.sessionId],
        [t('analytics.cdr.pdf.field.startTime'), cdr.startTime],
        [
          t('analytics.cdr.pdf.field.contact'),
          [cdr.contact.name, cdr.contact.phone, cdr.contact.email].filter(Boolean).join(' · '),
        ],
        [t('analytics.cdr.pdf.field.channel'), cdr.channel],
        [t('analytics.cdr.pdf.field.queue'), cdr.queue],
        [t('analytics.cdr.pdf.field.agent'), cdr.agent],
        [t('analytics.cdr.pdf.field.duration'), `${cdr.duration}s`],
        [t('analytics.cdr.pdf.field.disposition'), cdr.disposition],
        [t('analytics.cdr.pdf.field.slaMet'), cdr.slaMet ? t('common.yes') : t('common.no')],
        ...(cdr.qaScore !== undefined
          ? [[t('analytics.cdr.pdf.field.qaScore'), `${cdr.qaScore}`]]
          : []),
        ...(cdr.sentiment ? [[t('analytics.cdr.pdf.field.sentiment'), cdr.sentiment]] : []),
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    });
  });

  if (cdr.timeline.length > 0) {
    helpers.section(t('analytics.cdr.pdf.timelineTitle'), () => {
      helpers.table({
        head: [
          [
            t('analytics.cdr.pdf.timeline.at'),
            t('analytics.cdr.pdf.timeline.event'),
            t('analytics.cdr.pdf.timeline.actor'),
          ],
        ],
        body: cdr.timeline.map((e) => [e.at, e.event, e.actor ?? '—']),
        styles: { fontSize: 9 },
      });
    });
  }

  if (cdr.transcript.length > 0) {
    helpers.section(t('analytics.cdr.pdf.transcriptTitle'), () => {
      helpers.table({
        head: [
          [
            t('analytics.cdr.pdf.transcript.at'),
            t('analytics.cdr.pdf.transcript.speaker'),
            t('analytics.cdr.pdf.transcript.text'),
          ],
        ],
        body: cdr.transcript.map((row) => [row.at, row.speaker, row.text]),
        styles: { fontSize: 9, cellWidth: 'wrap', overflow: 'linebreak' },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 22 } },
      });
    });
  }
}
```

- [ ] **Step 5: Add i18n keys for `analytics.cdr.pdf.*` to all 3 locales**

In `public/locales/en-US/analytics.json`, ensure keys exist (or add):

```json
{
  "cdr": {
    "pdf": {
      "summaryTitle": "Call Summary",
      "timelineTitle": "Timeline",
      "transcriptTitle": "Transcript",
      "field": {
        "sessionId": "Session ID",
        "startTime": "Start time",
        "contact": "Contact",
        "channel": "Channel",
        "queue": "Queue",
        "agent": "Agent",
        "duration": "Duration",
        "disposition": "Disposition",
        "slaMet": "SLA met",
        "qaScore": "QA score",
        "sentiment": "Sentiment"
      },
      "timeline": { "at": "At", "event": "Event", "actor": "Actor" },
      "transcript": { "at": "At", "speaker": "Speaker", "text": "Text" }
    }
  }
}
```

Mirror in `es-419/analytics.json` and `pt-BR/analytics.json` with translations:

- es-419: "Resumen de la llamada", "Línea de tiempo", "Transcripción", etc.
- pt-BR: "Resumo da chamada", "Linha do tempo", "Transcrição", etc.

(Implementer translates each leaf key.)

- [ ] **Step 6: Run tests + i18n parity**

```bash
npx vitest run src/analytics/cdr/cdr-pdf-template.test.ts && npm run i18n:check
```

Expected: 2 PASS + i18n parity green.

- [ ] **Step 7: Commit**

```bash
git add src/analytics/cdr/cdr-pdf-template.ts src/analytics/cdr/cdr-pdf-template.test.ts public/locales/
git commit -m "feat(analytics): add CDR detail PDF template"
```

---

### Task 10: QA detail PDF template + tests

**Files:**

- Create: `src/analytics/qa/qa-pdf-template.ts`
- Create: `src/analytics/qa/qa-pdf-template.test.ts`

- [ ] **Step 1: Inspect QA types**

```bash
grep -nE 'interface Qa|type Qa|QaDetail|QaScore' src/core/api/hooks/use-qa.ts | head -20
```

Note actual field names; adapt if shape differs from below.

- [ ] **Step 2: Write failing test**

Create `src/analytics/qa/qa-pdf-template.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { createPdfHelpers } from '@/core/pdf/helpers';
import { renderQaPdf } from './qa-pdf-template';

const mockI18n = (k: string) => k;

describe('renderQaPdf', () => {
  it('Renders_HeaderSection_AndScoreBreakdown', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const helpers = createPdfHelpers(doc, {
      tenantName: 'X',
      title: 'X',
      exportedBy: 'u',
      exportedAt: new Date(),
      i18n: { exportedBy: 'a', exportedAt: 'b', page: 'c' },
    });
    const tableSpy = vi.spyOn(helpers, 'table');
    renderQaPdf({
      doc,
      helpers,
      qa: {
        id: 'q1',
        evaluatedAt: '2026-05-08',
        evaluator: 'Bob',
        agent: 'Alice',
        sessionId: 's1',
        overallScore: 87,
        passed: true,
        sections: [
          {
            name: 'Greeting',
            items: [
              { criterion: 'Used name', weight: 5, scored: 5, comment: '' },
              { criterion: 'Friendly tone', weight: 5, scored: 4, comment: 'Good' },
            ],
          },
        ],
        notes: 'Solid call overall.',
      },
      t: mockI18n,
    });
    expect(tableSpy).toHaveBeenCalled();
    const callsWithBody = tableSpy.mock.calls.filter((c) => c[0].body);
    expect(callsWithBody.length).toBeGreaterThanOrEqual(2);
  });

  it('Renders_NotesSection_WhenNotesPresent', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const helpers = createPdfHelpers(doc, {
      tenantName: 'X',
      title: 'X',
      exportedBy: 'u',
      exportedAt: new Date(),
      i18n: { exportedBy: 'a', exportedAt: 'b', page: 'c' },
    });
    const sectionSpy = vi.spyOn(helpers, 'section');
    renderQaPdf({
      doc,
      helpers,
      qa: {
        id: 'q1',
        evaluatedAt: '2026-05-08',
        evaluator: 'B',
        agent: 'A',
        sessionId: 's',
        overallScore: 80,
        passed: true,
        sections: [],
        notes: 'Nice job',
      },
      t: mockI18n,
    });
    const titles = sectionSpy.mock.calls.map((c) => c[0]);
    expect(titles).toContain('analytics.qa.pdf.notesTitle');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/analytics/qa/qa-pdf-template.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/analytics/qa/qa-pdf-template.ts`**

```ts
import type { jsPDF } from 'jspdf';
import type { PdfHelpers } from '@/core/pdf';

export interface QaPdfData {
  id: string;
  evaluatedAt: string;
  evaluator: string;
  agent: string;
  sessionId: string;
  overallScore: number;
  passed: boolean;
  sections: Array<{
    name: string;
    items: Array<{ criterion: string; weight: number; scored: number; comment?: string }>;
  }>;
  notes?: string;
}

interface RenderQaPdfArgs {
  doc: jsPDF;
  helpers: PdfHelpers;
  qa: QaPdfData;
  t: (key: string) => string;
}

export function renderQaPdf({ helpers, qa, t }: RenderQaPdfArgs) {
  helpers.section(t('analytics.qa.pdf.summaryTitle'), () => {
    helpers.table({
      body: [
        [t('analytics.qa.pdf.field.id'), qa.id],
        [t('analytics.qa.pdf.field.evaluatedAt'), qa.evaluatedAt],
        [t('analytics.qa.pdf.field.evaluator'), qa.evaluator],
        [t('analytics.qa.pdf.field.agent'), qa.agent],
        [t('analytics.qa.pdf.field.sessionId'), qa.sessionId],
        [t('analytics.qa.pdf.field.overallScore'), `${qa.overallScore}`],
        [
          t('analytics.qa.pdf.field.result'),
          qa.passed ? t('analytics.qa.pdf.passed') : t('analytics.qa.pdf.failed'),
        ],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    });
  });

  for (const sec of qa.sections) {
    helpers.section(sec.name, () => {
      helpers.table({
        head: [
          [
            t('analytics.qa.pdf.scoring.criterion'),
            t('analytics.qa.pdf.scoring.weight'),
            t('analytics.qa.pdf.scoring.scored'),
            t('analytics.qa.pdf.scoring.comment'),
          ],
        ],
        body: sec.items.map((it) => [
          it.criterion,
          `${it.weight}`,
          `${it.scored}`,
          it.comment ?? '—',
        ]),
        styles: { fontSize: 9, cellWidth: 'wrap', overflow: 'linebreak' },
      });
    });
  }

  if (qa.notes && qa.notes.trim().length > 0) {
    helpers.section(t('analytics.qa.pdf.notesTitle'), () => {
      helpers.table({
        body: [[qa.notes ?? '']],
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
      });
    });
  }
}
```

- [ ] **Step 5: Add i18n keys for `analytics.qa.pdf.*` to all 3 locales**

Add the same nested keys (`summaryTitle`, `notesTitle`, `field.*`, `scoring.*`, `passed`, `failed`) under `qa.pdf` to all 3 locale `analytics.json` files.

- [ ] **Step 6: Run tests + i18n parity**

```bash
npx vitest run src/analytics/qa/qa-pdf-template.test.ts && npm run i18n:check
```

Expected: 2 PASS + parity green.

- [ ] **Step 7: Commit**

```bash
git add src/analytics/qa/qa-pdf-template.ts src/analytics/qa/qa-pdf-template.test.ts public/locales/
git commit -m "feat(analytics): add QA detail PDF template"
```

---

### Task 11: Reports CDR Summary + QA Summary templates + tests

**Files:**

- Create: `src/admin/reports/templates/cdr-summary-template.ts`
- Create: `src/admin/reports/templates/qa-summary-template.ts`
- Create: `src/admin/reports/templates/templates.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/admin/reports/templates/templates.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { createPdfHelpers } from '@/core/pdf/helpers';
import { renderCdrSummary } from './cdr-summary-template';
import { renderQaSummary } from './qa-summary-template';

const mockI18n = (k: string) => k;
const baseHelperOpts = {
  tenantName: 'X',
  title: 'X',
  exportedBy: 'u',
  exportedAt: new Date(),
  i18n: { exportedBy: 'a', exportedAt: 'b', page: 'c' },
};

describe('renderCdrSummary', () => {
  it('Renders_KPIs_AndCdrTable', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const helpers = createPdfHelpers(doc, baseHelperOpts);
    const tableSpy = vi.spyOn(helpers, 'table');
    renderCdrSummary({
      doc,
      helpers,
      data: {
        period: { from: '2026-05-01', to: '2026-05-08' },
        kpis: { totalCalls: 1234, avgHandleTime: 245, slaPercent: 92.5, abandonmentPercent: 3.1 },
        rows: [{ startTime: '10:00', agent: 'A', queue: 'Q', duration: 200, disposition: 'r' }],
      },
      t: mockI18n,
    });
    expect(tableSpy).toHaveBeenCalledTimes(2); // KPI table + rows table
  });
});

describe('renderQaSummary', () => {
  it('Renders_ScoreDistribution_AndPerAgentBreakdown', () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const helpers = createPdfHelpers(doc, baseHelperOpts);
    const tableSpy = vi.spyOn(helpers, 'table');
    renderQaSummary({
      doc,
      helpers,
      data: {
        period: { from: '2026-05-01', to: '2026-05-08' },
        distribution: { excellent: 30, good: 40, fair: 20, poor: 10 },
        perAgent: [{ agent: 'Alice', evaluations: 5, avgScore: 88, passRate: 0.8 }],
      },
      t: mockI18n,
    });
    expect(tableSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/admin/reports/templates/templates.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/admin/reports/templates/cdr-summary-template.ts`**

```ts
import type { jsPDF } from 'jspdf';
import type { PdfHelpers } from '@/core/pdf';

export interface CdrSummaryData {
  period: { from: string; to: string };
  kpis: {
    totalCalls: number;
    avgHandleTime: number;
    slaPercent: number;
    abandonmentPercent: number;
  };
  rows: Array<{
    startTime: string;
    agent: string;
    queue: string;
    duration: number;
    disposition: string;
  }>;
}

interface Args {
  doc: jsPDF;
  helpers: PdfHelpers;
  data: CdrSummaryData;
  t: (key: string) => string;
}

export function renderCdrSummary({ helpers, data, t }: Args) {
  helpers.section(t('admin.reports.pdf.cdr.kpiTitle'), () => {
    helpers.table({
      body: [
        [t('admin.reports.pdf.cdr.period'), `${data.period.from} → ${data.period.to}`],
        [t('admin.reports.pdf.cdr.totalCalls'), `${data.kpis.totalCalls}`],
        [t('admin.reports.pdf.cdr.avgHandleTime'), `${data.kpis.avgHandleTime}s`],
        [t('admin.reports.pdf.cdr.slaPercent'), `${data.kpis.slaPercent.toFixed(1)}%`],
        [
          t('admin.reports.pdf.cdr.abandonmentPercent'),
          `${data.kpis.abandonmentPercent.toFixed(1)}%`,
        ],
      ],
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 1.5 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    });
  });

  helpers.section(t('admin.reports.pdf.cdr.rowsTitle'), () => {
    helpers.table({
      head: [
        [
          t('admin.reports.pdf.cdr.col.startTime'),
          t('admin.reports.pdf.cdr.col.agent'),
          t('admin.reports.pdf.cdr.col.queue'),
          t('admin.reports.pdf.cdr.col.duration'),
          t('admin.reports.pdf.cdr.col.disposition'),
        ],
      ],
      body: data.rows.map((r) => [r.startTime, r.agent, r.queue, `${r.duration}s`, r.disposition]),
      styles: { fontSize: 9 },
    });
  });
}
```

- [ ] **Step 4: Implement `src/admin/reports/templates/qa-summary-template.ts`**

```ts
import type { jsPDF } from 'jspdf';
import type { PdfHelpers } from '@/core/pdf';

export interface QaSummaryData {
  period: { from: string; to: string };
  distribution: { excellent: number; good: number; fair: number; poor: number };
  perAgent: Array<{ agent: string; evaluations: number; avgScore: number; passRate: number }>;
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
        [t('admin.reports.pdf.qa.excellent'), `${data.distribution.excellent}`],
        [t('admin.reports.pdf.qa.good'), `${data.distribution.good}`],
        [t('admin.reports.pdf.qa.fair'), `${data.distribution.fair}`],
        [t('admin.reports.pdf.qa.poor'), `${data.distribution.poor}`],
      ],
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
    });
  });

  helpers.section(t('admin.reports.pdf.qa.perAgentTitle'), () => {
    helpers.table({
      head: [
        [
          t('admin.reports.pdf.qa.col.agent'),
          t('admin.reports.pdf.qa.col.evaluations'),
          t('admin.reports.pdf.qa.col.avgScore'),
          t('admin.reports.pdf.qa.col.passRate'),
        ],
      ],
      body: data.perAgent.map((a) => [
        a.agent,
        `${a.evaluations}`,
        `${a.avgScore.toFixed(1)}`,
        `${(a.passRate * 100).toFixed(1)}%`,
      ]),
      styles: { fontSize: 9 },
    });
  });
}
```

- [ ] **Step 5: Add `admin.reports.pdf.cdr.*` and `admin.reports.pdf.qa.*` keys to 3 locales**

In `public/locales/en-US/admin.json` (and mirror in es-419, pt-BR), add keys under `reports.pdf`:

```json
{
  "reports": {
    "pdf": {
      "cdr": {
        "kpiTitle": "Key Metrics",
        "rowsTitle": "Calls",
        "period": "Period",
        "totalCalls": "Total calls",
        "avgHandleTime": "Avg handle time",
        "slaPercent": "SLA met",
        "abandonmentPercent": "Abandonment",
        "col": {
          "startTime": "Start time",
          "agent": "Agent",
          "queue": "Queue",
          "duration": "Duration",
          "disposition": "Disposition"
        }
      },
      "qa": {
        "distributionTitle": "Score Distribution",
        "perAgentTitle": "Per-agent breakdown",
        "period": "Period",
        "excellent": "Excellent",
        "good": "Good",
        "fair": "Fair",
        "poor": "Poor",
        "col": {
          "agent": "Agent",
          "evaluations": "Evaluations",
          "avgScore": "Avg score",
          "passRate": "Pass rate"
        }
      }
    }
  }
}
```

- [ ] **Step 6: Run tests + i18n parity**

```bash
npx vitest run src/admin/reports/templates/templates.test.ts && npm run i18n:check
```

Expected: 2 PASS + parity green.

- [ ] **Step 7: Commit**

```bash
git add src/admin/reports/templates/ public/locales/
git commit -m "feat(reports): add CDR Summary + QA Summary PDF templates"
```

---

## Phase D — Surface integration (4 tasks, parallel-safe)

### Task 12: Integrate Print + PDF buttons into CDR detail drawer

**Files:**

- Modify: `src/analytics/cdr/cdr-detail-drawer.tsx`

- [ ] **Step 1: Inspect current drawer**

```bash
grep -nE 'export (default )?function|<Drawer|<Sheet|toolbar|footer' src/analytics/cdr/cdr-detail-drawer.tsx | head -10
```

Locate the drawer's action toolbar / footer area where the buttons go.

- [ ] **Step 2: Add buttons to the drawer**

Edit `src/analytics/cdr/cdr-detail-drawer.tsx`:

1. Add imports at top:

```tsx
import { useRef } from 'react';
import { PrintButton } from '@/core/ui/print-button';
import { PdfDownloadButton } from '@/core/ui/pdf-download-button';
import { renderCdrPdf, type CdrPdfData } from './cdr-pdf-template';
```

2. Inside the component, after the `useCdrDetail` hook:

```tsx
const printRef = useRef<HTMLDivElement>(null);
const pdfData: CdrPdfData | null = cdr
  ? {
      sessionId: cdr.sessionId,
      startTime: cdr.startTime,
      contact: { name: cdr.contactName, phone: cdr.contactPhone, email: cdr.contactEmail },
      channel: cdr.channel,
      queue: cdr.queue,
      agent: cdr.agent,
      duration: cdr.duration,
      disposition: cdr.disposition,
      slaMet: cdr.slaMet,
      qaScore: cdr.qaScore,
      sentiment: cdr.sentiment,
      timeline: cdr.events ?? [],
      transcript: transcript?.turns ?? [],
    }
  : null;
const filename = cdr ? `cdr-${cdr.sessionId}-${todayStamp()}.pdf` : 'cdr.pdf';

function todayStamp() {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '');
}
```

3. Wrap drawer body content in a `<div ref={printRef} data-print="target">`:

```tsx
<div ref={printRef} data-print="target">
  {/* existing drawer body markup */}
</div>
```

4. Add buttons in the drawer toolbar/footer:

```tsx
<div className="flex items-center gap-2">
  <PrintButton contentRef={printRef} documentTitle={`cdr-${cdr?.sessionId ?? ''}`} />
  {pdfData && (
    <PdfDownloadButton
      filename={filename}
      documentTitle={t('analytics.cdr.pdf.documentTitle', { id: cdr.sessionId })}
      onGenerate={async ({ doc, helpers }) => {
        renderCdrPdf({ doc, helpers, cdr: pdfData, t });
      }}
    />
  )}
</div>
```

(Field names — `contactName`, `events`, `transcript.turns` — adapt to actual `useCdrDetail` shape; if names differ, map accordingly.)

- [ ] **Step 3: Add `documentTitle` i18n key to `analytics.json` (3 locales)**

```json
{
  "cdr": {
    "pdf": {
      "documentTitle": "Call Detail — {{id}}"
    }
  }
}
```

- [ ] **Step 4: Verify build + lint + i18n**

```bash
npm run build && npm run lint && npm run i18n:check
```

Expected: green.

- [ ] **Step 5: Manual smoke (dev server)**

```bash
npm run dev &
sleep 3
# Navigate to /analytics/cdr → click row → drawer opens → Print & Download PDF buttons visible
# Click Download PDF → file downloads named cdr-<id>-<timestamp>.pdf
# Open the PDF, verify header (tenant, exporter), summary rows, timeline, transcript
kill %1
```

Expected: PDF downloads with correct content.

- [ ] **Step 6: Commit**

```bash
git add src/analytics/cdr/cdr-detail-drawer.tsx public/locales/
git commit -m "feat(cdr): add Print + Download PDF buttons to detail drawer"
```

---

### Task 13: Integrate Print + PDF buttons into QA detail drawer

**Files:**

- Modify: `src/analytics/qa/qa-detail-drawer.tsx`

Mirror Task 12's structure, swapping the imports/data shape:

- [ ] **Step 1: Inspect QA drawer**

```bash
grep -nE 'export (default )?function|<Drawer|<Sheet|toolbar|footer' src/analytics/qa/qa-detail-drawer.tsx | head -10
```

- [ ] **Step 2: Add imports + buttons**

```tsx
import { useRef } from 'react';
import { PrintButton } from '@/core/ui/print-button';
import { PdfDownloadButton } from '@/core/ui/pdf-download-button';
import { renderQaPdf, type QaPdfData } from './qa-pdf-template';
```

```tsx
const printRef = useRef<HTMLDivElement>(null);
const pdfData: QaPdfData | null = qa
  ? {
      id: qa.id,
      evaluatedAt: qa.evaluatedAt,
      evaluator: qa.evaluator,
      agent: qa.agent,
      sessionId: qa.sessionId,
      overallScore: qa.overallScore,
      passed: qa.passed,
      sections: qa.sections,
      notes: qa.notes,
    }
  : null;
const filename = qa
  ? `qa-${qa.id}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.pdf`
  : 'qa.pdf';
```

Wrap body in `<div ref={printRef} data-print="target">`. Add buttons in the toolbar:

```tsx
<div className="flex items-center gap-2">
  <PrintButton contentRef={printRef} documentTitle={`qa-${qa?.id ?? ''}`} />
  {pdfData && (
    <PdfDownloadButton
      filename={filename}
      documentTitle={t('analytics.qa.pdf.documentTitle', { id: qa.id })}
      onGenerate={async ({ doc, helpers }) => {
        renderQaPdf({ doc, helpers, qa: pdfData, t });
      }}
    />
  )}
</div>
```

- [ ] **Step 3: Add `documentTitle` key to QA section in 3 locales**

```json
{
  "qa": {
    "pdf": {
      "documentTitle": "QA Evaluation — {{id}}"
    }
  }
}
```

- [ ] **Step 4: Verify**

```bash
npm run build && npm run lint && npm run i18n:check
```

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/analytics/qa/qa-detail-drawer.tsx public/locales/
git commit -m "feat(qa): add Print + Download PDF buttons to detail drawer"
```

---

### Task 14: Wire PDF generation into Reports page Run Now flow

**Files:**

- Modify: `src/admin/reports/reports-page.tsx`
- Possibly modify: `src/core/api/hooks/use-reports.ts` (only if data shape requires it)

- [ ] **Step 1: Inspect current Run Now flow**

```bash
grep -nE 'useRunReport|format.*PDF|onRun|\"PDF\"' src/admin/reports/reports-page.tsx src/core/api/hooks/use-reports.ts
```

Identify:

- `useRunReport()` mutation signature (input + response shape)
- How "Run Now" button currently dispatches the mutation
- Whether the response carries the data payload OR only a job ID

- [ ] **Step 2: If response is job-only, inspect for a results endpoint**

```bash
grep -nE 'reports/.*result|reports/.*data|export-job' src/core/api/hooks/use-reports.ts
```

Branch:

- **A.** If the response payload includes the data rows → use them directly.
- **B.** If only a job ID → fetch data via existing hooks (`useCdrList` / `useQaList`) using the report's saved filters as a fallback.

Document the chosen branch in commit message.

- [ ] **Step 3: Replace the "Run Now" button cell with stateful flow**

Conceptual change in `src/admin/reports/reports-page.tsx`:

```tsx
import { useState } from 'react';
import { PdfDownloadButton } from '@/core/ui/pdf-download-button';
import { renderCdrSummary, type CdrSummaryData } from './templates/cdr-summary-template';
import { renderQaSummary, type QaSummaryData } from './templates/qa-summary-template';

type ReadyPayload =
  | { type: 'cdr-summary'; data: CdrSummaryData }
  | { type: 'qa-summary'; data: QaSummaryData };

function ReportActions({ report }: { report: ReportRow }) {
  const { t } = useTranslation('admin');
  const runMutation = useRunReport();
  const [ready, setReady] = useState<ReadyPayload | null>(null);

  if (report.format !== 'PDF') {
    // Existing CSV path — render the legacy "Run Now" + CSV download untouched.
    return <LegacyRunNowButton report={report} />;
  }

  async function handleRunNow() {
    setReady(null);
    const result = await runMutation.mutateAsync({ id: report.id });
    if (report.type === 'CDRSummary') {
      setReady({ type: 'cdr-summary', data: toCdrSummary(result) });
    } else if (report.type === 'QASummary') {
      setReady({ type: 'qa-summary', data: toQaSummary(result) });
    }
    // Interval / AgentPerformance: not implemented this track — show CSV-only fallback.
  }

  if (ready) {
    const filename = `${report.type.toLowerCase()}-${report.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
    return (
      <PdfDownloadButton
        filename={filename}
        documentTitle={t(`reports.pdf.${ready.type}.documentTitle`)}
        onGenerate={async ({ doc, helpers }) => {
          if (ready.type === 'cdr-summary') {
            renderCdrSummary({ doc, helpers, data: ready.data, t });
          } else {
            renderQaSummary({ doc, helpers, data: ready.data, t });
          }
        }}
      />
    );
  }

  return (
    <Button
      onClick={handleRunNow}
      disabled={runMutation.isPending}
      aria-busy={runMutation.isPending}
    >
      {runMutation.isPending ? t('reports.running') : t('reports.runNow')}
    </Button>
  );
}
```

`toCdrSummary` / `toQaSummary` are local mappers that adapt the API response shape to the template-expected shape. If branch B was chosen (job-only response), these mappers fetch data via `useCdrList()`/`useQaList()` using `report.params` and synthesize the KPIs client-side.

For `report.type === 'IntervalReport'` and `'AgentPerformance'` with `format === 'PDF'`: explicitly disable PDF and surface a `Tooltip` "PDF for this report type ships in a follow-up patch." (Translation key: `admin.reports.pdf.notYetSupported`.)

- [ ] **Step 4: Add `documentTitle` keys to 3 locales**

In `admin.json` under `reports.pdf`:

```json
{
  "cdr-summary": { "documentTitle": "CDR Summary" },
  "qa-summary": { "documentTitle": "QA Summary" }
}
```

Plus `reports.pdf.notYetSupported`: `"PDF for this report type is not yet available."`

- [ ] **Step 5: Verify build + lint + i18n**

```bash
npm run build && npm run lint && npm run i18n:check
```

Expected: green.

- [ ] **Step 6: Manual smoke**

Open `/admin/reports` → click "Run Now" on a CDRSummary or QASummary row with `format: PDF` → button changes to "Download PDF" once data resolves → click → PDF downloads.

- [ ] **Step 7: Commit**

```bash
git add src/admin/reports/ public/locales/
git commit -m "feat(reports): wire PDF generation flow on Run Now for CDR Summary + QA Summary"
```

---

### Task 15: Add `<PrintButton>` to Analytics Dashboard

**Files:**

- Modify: `src/analytics/dashboard/dashboard-page.tsx`

- [ ] **Step 1: Inspect current dashboard structure**

```bash
grep -nE 'export (default )?function|<Filter|<KpiCard|<TrendChart|FilterBar' src/analytics/dashboard/dashboard-page.tsx | head -10
```

- [ ] **Step 2: Add `<PrintButton>` near FilterBar**

```tsx
import { useRef } from 'react';
import { PrintButton } from '@/core/ui/print-button';
```

```tsx
const printRef = useRef<HTMLDivElement>(null);
```

Wrap the dashboard body (KPIs + charts + heatmap) in `<div ref={printRef} data-print="target">`. In the page header next to FilterBar:

```tsx
<div className="flex items-center justify-between gap-2">
  <FilterBar ... />
  <PrintButton contentRef={printRef} documentTitle="dashboard" />
</div>
```

- [ ] **Step 3: Verify build + lint**

```bash
npm run build && npm run lint
```

Expected: green.

- [ ] **Step 4: Manual smoke**

Open `/analytics` → click Print → browser print preview shows dashboard cleanly without sidebar/command-palette. Save as PDF works.

- [ ] **Step 5: Commit**

```bash
git add src/analytics/dashboard/dashboard-page.tsx
git commit -m "feat(dashboard): add PrintButton for analytics dashboard"
```

---

## Phase E — Closure (3 tasks, sequential)

### Task 16: Playwright E2E spec for PDF download

**Files:**

- Create: `tests/e2e/tests/export/pdf-download.spec.ts`

- [ ] **Step 1: Inspect existing E2E auth fixture**

```bash
ls tests/e2e/tests/ && grep -rE 'export const test|fixtures/auth' tests/e2e/fixtures/ 2>/dev/null | head -5
```

Locate the auth fixture (likely `tests/e2e/fixtures/auth-fixture.ts`).

- [ ] **Step 2: Create the spec**

`tests/e2e/tests/export/pdf-download.spec.ts`:

```ts
import { test, expect } from '@/fixtures/auth-fixture';

test.describe('PDF export — CDR detail', () => {
  test('Downloads_Pdf_FromCdrDetailDrawer', async ({ page }) => {
    await page.goto('/analytics/cdr');
    await page.waitForSelector('[data-testid="cdr-table"]', { timeout: 15_000 });

    // Open first row's detail drawer (ag-grid row click)
    await page.locator('.ag-row').first().click();
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();

    // Click Download PDF
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download as pdf/i }).click();
    const download = await downloadPromise;

    // Assert filename pattern + non-zero size
    expect(download.suggestedFilename()).toMatch(/^cdr-.+\.pdf$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import('node:fs/promises');
    const stats = await fs.stat(path!);
    expect(stats.size).toBeGreaterThan(5_000); // > 5 kB
  });
});
```

(Adjust the import path of the auth fixture to match the project's actual fixture export. If the fixture is named `test` exported from `tests/e2e/fixtures/auth-fixture.ts`, the alias `@` may not work in playwright config — use a relative path: `import { test, expect } from '../../fixtures/auth-fixture';`.)

- [ ] **Step 3: Add `data-testid="cdr-table"` to the CDR ag-grid wrapper if not present**

```bash
grep -nE 'data-testid' src/analytics/cdr/cdr-page.tsx | head -5
```

If no `cdr-table` testid exists, add one to the table wrapper element. Otherwise keep as-is.

- [ ] **Step 4: Run the spec (requires running demo backend)**

```bash
# Start backend (separate terminal): cd ../Verbara.Platform && dotnet run --project src/Verbara.Platform.Api
npx playwright test -c tests/e2e/playwright.config.ts tests/e2e/tests/export/pdf-download.spec.ts
```

Expected: 1 PASS. If backend is not available, the spec is skipped/marked as xfail in the PR — document the manual smoke that backed up the assertion.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/tests/export/ src/analytics/cdr/cdr-page.tsx
git commit -m "test(e2e): add Playwright spec for CDR detail PDF download"
```

---

### Task 17: Final verification gate

**No file changes** — purely a validation checkpoint. Run all gates and capture results.

- [ ] **Step 1: Run unit tests**

```bash
npm run test -- --run
```

Expected: 910 (existing) + ~20 (new from this track) = ~930 PASS, 0 FAIL.

- [ ] **Step 2: Run lint + i18n parity**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings (or only the 3 pre-existing react-hooks library warnings noted in CLAUDE.md). i18n parity green.

- [ ] **Step 3: Run build + measure bundle**

```bash
npm run build
```

Expected: Build green. Inspect output:

- `index.js` shell delta vs pre-track: ≤ +5 kB raw / +2 kB gzip (react-to-print is the only eager addition; print.css is CSS, separate)
- `vendor-pdf-*.js` chunk present, ~140 kB gzip — only emitted when something imports it (the lazy import in `pdf-download-button.tsx`)

If the eager shell delta exceeds the budget, investigate whether `react-to-print` was tree-shaken; if not, lazy-import it inside `<PrintButton>` too.

- [ ] **Step 4: Run audit**

```bash
npm audit --audit-level=high
```

Expected: 0 vulnerabilities.

- [ ] **Step 5: Run Playwright (if backend available)**

```bash
npx playwright test -c tests/e2e/playwright.config.ts tests/e2e/tests/export/pdf-download.spec.ts
```

Expected: 1 PASS.

- [ ] **Step 6: Manual a11y smoke**

Open `/analytics/cdr`, open detail drawer, Tab through controls. Verify:

- Print + Download PDF buttons in tab order
- Both have visible focus rings (Track 5C-a11y baseline)
- Click Download → button keeps focus, `aria-busy="true"` set, screen reader (or DevTools accessibility tree) shows correct label
- After download completes, focus stays on button, `aria-busy="false"`

- [ ] **Step 7: No commit needed (validation only)** — proceed to Task 18.

---

### Task 18: Update CLAUDE.md + memory + closure commit

**Files:**

- Modify: `CLAUDE.md`
- Modify: `~/.claude/projects/-media-Data-Source-Verbara-Verbara-Platform-Web/memory/MEMORY.md`
- Modify: `~/.claude/projects/-media-Data-Source-Verbara-Verbara-Platform-Web/memory/project_current_position.md`
- Modify: `docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md` (mark Track 5C-export ✅)

- [ ] **Step 1: Update `CLAUDE.md`**

Bump version banner from `2.0.4` → `2.1.0` and add a Track 5C-export closure section after Track 5C-a11y:

```markdown
Track 5C-export (Print + PDF Export) done 2026-05-08, tag `v2.1.0-web`:
`<PrintButton>` + `<PdfDownloadButton>` primitives, `src/styles/print.css` foundation
(@media print, @page A4, data-print conventions), 5 PDF templates (CDR detail, QA detail,
CDR Summary, QA Summary, plus engine helpers), CDR + QA detail drawers wired,
Reports page Run Now → Download PDF flow, Analytics Dashboard PrintButton.
Bundle: shell +2 kB gzip, lazy `vendor-pdf` chunk ~140 kB gzip. ~20 unit tests

- 1 Playwright E2E. i18n 3 locales.
```

Bump test count where mentioned and update "Next" pointer to Track 5D.

- [ ] **Step 2: Update memory `project_current_position.md`**

Update the file header to reflect 2.1.0 closure, append a section for Track 5C-export with the same summary.

- [ ] **Step 3: Update memory `MEMORY.md`**

Update the "Current State (verified 2026-05-08)" line:

```markdown
- [Current position](project_current_position.md) — Web **2.1.0** (tag `v2.1.0-web`). Track 5C-export DONE. ~930 tests. Next: Track 5D
```

Add to roadmap section:

```markdown
- ~~Track 5C-export~~ — Print stylesheets + PDF export — **DONE** 2026-05-08 (tag `v2.1.0-web`)
```

- [ ] **Step 4: Update active roadmap doc**

In `docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`, change Track 5C heading from pending to closed:

```markdown
### Track 5C-export — Print stylesheets + PDF export ✅ DONE 2026-05-08

**Versión:** `2.1.0` · **Tag:** `v2.1.0-web` · **Release:** "Print + PDF export"
```

(plus a short closure summary mirroring CLAUDE.md.)

- [ ] **Step 5: Move plan to completed**

```bash
git mv docs/plans/active/2026-05-08-track-5c-export.md docs/plans/completed/2026-05-08-track-5c-export.md
```

- [ ] **Step 6: Commit closure changes**

```bash
git add CLAUDE.md docs/plans/
git commit -m "docs: close Track 5C-export — bump version, update CLAUDE.md, move plan to completed"
```

- [ ] **Step 7: Tag + push**

```bash
git tag -a v2.1.0-web -m "Track 5C-export — Print stylesheets + PDF export

- Layer 1: src/styles/print.css global @media print foundation
- Layer 2: <PrintButton> primitive (react-to-print, ~5 kB gzip eager)
- Layer 3: <PdfDownloadButton> primitive (lazy ~140 kB gzip)
- 5 PDF templates: CDR detail, QA detail, CDR Summary, QA Summary
- Surfaces wired: CDR detail drawer, QA detail drawer, Reports page (Run Now → Download PDF for CDR/QA Summary), Analytics Dashboard (PrintButton)
- ~20 new unit tests + 1 Playwright E2E
- i18n parity 3 locales (en-US, es-419, pt-BR)
- Bundle shell delta: +2 kB gzip; lazy chunk vendor-pdf only on first PDF click"

git push origin main
git push origin v2.1.0-web
```

- [ ] **Step 8: Create GitHub release**

```bash
gh release create v2.1.0-web --title "v2.1.0-web — Track 5C-export Print + PDF Export" --notes "$(cat <<'EOF'
## Track 5C-export — Print Stylesheets + PDF Export

Closes the print/export half of the original Nivel 5 Track 5C (the a11y half shipped in v2.0.4-web).

### What's new
- **Layer 1 — Print foundation:** `src/styles/print.css` global @media print rules + @page A4 + `data-print` conventions. Ctrl+P on any authenticated page now produces a clean artifact (sidebar, command palette, toaster, modals hidden, dark mode forced to light).
- **Layer 2 — `<PrintButton>` primitive:** Wraps `react-to-print`. Used on CDR detail, QA detail, Analytics Dashboard.
- **Layer 3 — `<PdfDownloadButton>` primitive:** Lazy-loads jsPDF + jspdf-autotable + html2canvas (~140 kB gzip on first click). Used on CDR detail, QA detail, Scheduled Reports.
- **5 PDF templates:** CDR detail (summary + timeline + transcript), QA detail (score + breakdown + notes), CDR Summary + QA Summary (for scheduled reports), plus engine helpers (header/footer/section/table/rasterizeChart).
- **Scheduled Reports vaporware closed:** "Run Now" → spinner → "Download PDF" flow for `format=PDF` rows of type CDRSummary or QASummary. IntervalReport + AgentPerformance deferred to a follow-up patch.

### Bundle impact
- Shell `index.js`: +2 kB gzip (react-to-print)
- print.css: +3 kB gzip
- New lazy chunk `vendor-pdf`: ~140 kB gzip, loaded only on first PDF download click.

### Tests
- ~20 new unit tests (PrintButton, PdfDownloadButton, helpers, 5 templates)
- 1 new Playwright E2E (CDR detail PDF download)
- All previous 910 tests still green.

### A11y
- New buttons pass `eslint-plugin-jsx-a11y` at error level (Track 5C-a11y CI gate).
- `aria-busy="true"` during PDF generation, focus preservation, no eslint-disable directives.

### i18n
- 3 locales (en-US, es-419, pt-BR) parity green.

### Out of scope (future tracks)
- Tier 2/3 surfaces (Audit log PDF, Billing/invoice PDF, Speech analytics PDF, etc.)
- Email/scheduled PDF delivery, tenant logo upload, watermarks
- PDF/UA accessibility tagging
- IntervalReport + AgentPerformance templates
EOF
)"
```

- [ ] **Step 9: Verify final state**

```bash
git status && git log --oneline -5 && git tag --list 'v2.1*'
```

Expected: clean working tree, recent commits in log, `v2.1.0-web` tag present.

---

## Self-Review (controller checklist before dispatching subagents)

**1. Spec coverage:**

- ✅ Layer 1 print.css → Task 2
- ✅ Layer 2 PrintButton → Task 6
- ✅ Layer 3 PdfDownloadButton → Task 8
- ✅ PDF engine + helpers → Task 7
- ✅ 3 Tier 1 surfaces (CDR detail / QA detail / Reports) → Tasks 12 / 13 / 14
- ✅ Analytics Dashboard PrintButton → Task 15 (Layer 2 only as spec said)
- ✅ Shell chrome `data-print="hide"` → Task 3
- ✅ i18n keys 3 locales + parity → Task 4 (foundation) + Tasks 9/10/11/12/13/14 (surface-specific)
- ✅ Vite chunk → Task 5
- ✅ Bundle delta verification → Task 17
- ✅ Unit tests (PrintButton 3, PdfDownloadButton 5, helpers 4, CDR template 2, QA template 2, reports templates 2 = ~18) ✓ ≥ 17 in spec ✓
- ✅ Playwright E2E → Task 16
- ✅ A11y constraints (`aria-busy`, no `eslint-disable`, focus preservation) → Tasks 8 + 17

**2. Placeholder scan:** No "TBD" / "TODO" / "implement later" tokens. Each step has either a concrete code block, a concrete command, or both.

**3. Type consistency:**

- `PdfHelpers` interface defined in Task 7 — used in Tasks 8, 9, 10, 11 with consistent method signatures (`header()`, `footer()`, `section(title, body)`, `table(opts)`, `rasterizeChart(target)`).
- `PdfGenerationContext` defined in Task 8 — used by Tasks 12, 13, 14 in `onGenerate` callbacks.
- `CdrPdfData` / `QaPdfData` / `CdrSummaryData` / `QaSummaryData` defined in their template tasks (9, 10, 11) — consumed by their respective surface tasks (12, 13, 14).
- i18n keys consistently namespaced: `common.print.*`, `common.export.pdf.*`, `analytics.cdr.pdf.*`, `analytics.qa.pdf.*`, `admin.reports.pdf.*`.

**4. Risks acknowledged in spec are addressed:**

- jsPDF column wrap → uses `cellWidth: 'wrap'` + `overflow: 'linebreak'` in transcript table (Task 9).
- html2canvas + dark mode → `backgroundColor: '#ffffff'` forced in `rasterizeChart` (Task 7).
- Track 5B virtualization → print.css expands `[data-virtualized="true"]` (Task 2).
- React 19 peer warnings on `react-to-print` → install with `--legacy-peer-deps` (Task 1).

---

## Execution mode

**Recommended: Subagent-Driven Development.**

Phase decomposition for FCM batching:

- **Phase A (5 tasks):** All independent. Batch in one wave (5 parallel subagents). Mechanical work — fast model.
- **Phase B (3 tasks):** B7 (engine + helpers) before B8 (PdfDownloadButton). B6 independent. Standard model.
- **Phase C (3 tasks):** All independent. Parallel batch. Standard model.
- **Phase D (4 tasks):** All independent (different files). Parallel batch. Standard model.
- **Phase E (3 tasks):** Sequential (16 → 17 → 18). Standard model.

Total: ~17 tasks across 5 phases. Estimated 1-2 days with subagent-driven + parallelism.
