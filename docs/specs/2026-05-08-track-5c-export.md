# Track 5C-export — Print Stylesheets + PDF Export

**Version:** 2.1.0 (cierre del Nivel 5 junto con Track 5D)
**Status:** Draft (pending user review)
**Created:** 2026-05-08
**Predecessor:** [Track 5C-a11y](2026-05-08-track-5c-a11y.md) (closed)
**Roadmap entry:** [`docs/plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md`](../plans/active/2026-05-03-v1.14.x-operational-foundation-roadmap.md) §Nivel 5 → Track 5C — a11y deep + print/export. The a11y portion shipped in `v2.0.4-web`; this track ships the print/export portion separately.

## Problem

Verbara surfaces high-value records (call detail, QA evaluations, scheduled reports) where supervisors, compliance officers and HR routinely need a portable, archivable copy of the data. Today the product offers:

- **CSV export** in 3 places: `cdr-page.tsx`, `auth-events-page.tsx`, `audit-export` — mature pattern (Blob + `URL.createObjectURL`)
- **No PDF generation** anywhere
- **No `@media print` CSS** anywhere — Ctrl+P from any page produces a polluted screenshot with sidebar, navigation, modals, dark-mode background, etc.
- **Vaporware "PDF" badge** in `reports-page.tsx` (`src/admin/reports/`) that promises CDRSummary / QASummary / IntervalReport / AgentPerformance PDFs but does not generate them

This forces users to take screenshots, export CSV and reformat in Excel, or print and lose layout fidelity. For compliance use cases (call recording archive, GDPR data subject requests, QA feedback to agents), screenshots are not acceptable.

## Goals

1. **Print foundation** — global `@media print` stylesheets that turn Ctrl+P into a usable artifact on every page in the app.
2. **3 explicit "Download PDF" surfaces** that ship as Tier 1: CDR detail, QA detail, Scheduled Reports.
3. **Bundle discipline** — zero impact at landing, lazy import of PDF libraries on click only.
4. **i18n parity** in all 3 locales (en-US, es-419, pt-BR).
5. **Compliance-grade output** — text-based PDFs (searchable, copyable), tenant header, exporter user, timestamp, page numbers.

## Acceptance

- ✅ `src/styles/print.css` imported globally; Ctrl+P on any authenticated page hides shell chrome (sidebar, command palette, notifications, modals) and forces light mode.
- ✅ `<PrintButton />` primitive in `src/core/ui/` triggers `window.print()` with a target ref. Used on at least CDR detail, QA detail, Analytics Dashboard.
- ✅ `<PdfDownloadButton />` primitive in `src/core/ui/` lazy-loads PDF libraries on click and produces a downloadable file. Used on CDR detail, QA detail, Scheduled Reports.
- ✅ Generated PDFs include: tenant name (from `auth-store`), exporter email, ISO timestamp, page numbers (`Page X of Y`).
- ✅ Bundle: `index.js` shell delta ≤ +2 kB gzip. Lazy chunk `pdf-export-vendor` ~140 kB gzip, loaded only on first PDF download click.
- ✅ Unit tests: 3+ for `<PrintButton>`, 5+ for `<PdfDownloadButton>` (mock html2canvas + jsPDF), 3+ for PDF helpers.
- ✅ E2E test: 1 Playwright spec opens a CDR detail, clicks Download PDF, asserts a Blob download (filename pattern + non-zero size).
- ✅ i18n: 3 locales × `common.print.*` + `common.export.pdf.*` keys, parity check passing.
- ✅ Lint 0 errors, TypeScript clean, build green, all existing 910 tests still pass + new tests.
- ✅ A11y: print + PDF buttons have proper `aria-label`, `aria-busy` during loading, focus is preserved after dialog close. Both new components must pass `eslint-plugin-jsx-a11y` at error level (CI gate from Track 5C-a11y) — no `eslint-disable` directives unless justified inline.
- ✅ Focus management: clicking Download PDF triggers loading state, but the button itself remains the focused element. After completion, focus stays on the button (does NOT move to a toast or hidden element). This preserves keyboard navigation for screen reader users.
- ✅ PDF generation status announced via existing Sonner toast (`role="status"` from Track 5C-a11y) — no new ARIA region needed.

## Out of Scope (explicit)

These ship as future tracks or are deferred to backend work:

- **Tier 2/3 surfaces:** Analytics Dashboard PDF, Audit log PDF, Billing/invoice PDF, Speech analytics PDF, CDR list PDF, Compliance dashboard PDF, Survey results PDF, Agent detail PDF. Print stylesheets DO benefit them via the foundation; only the explicit "Download PDF" button is out of scope.
- **Email delivery / scheduled PDF cron** — backend feature; not part of this track.
- **Tenant logo upload** — requires backend asset endpoint; for now PDFs use tenant _name_ (text), not logo.
- **Watermarks** (e.g., "CONFIDENTIAL") — defer.
- **PDF/UA accessibility tagging** — client-side libs do not produce tagged PDFs; defer to a server-side rendering track if/when needed.
- **Audit logging of who exported what** — backend feature; the Web track adds a Sentry breadcrumb only.
- **Excel / XLSX export** — separate ask, not in roadmap.
- **PDF preview modal** — defer; user gets browser's print preview (Layer 2) or direct download (Layer 3).
- **Backend-rendered PDFs (Puppeteer)** — explicitly excluded per CLAUDE.md note that Web tracks do not span backend. Roadmap's "jspdf or backend rendering" wording resolved as client-side jsPDF.

## Architecture — 3 layers

Each layer is independent and can be removed without breaking the others. Layer 1 benefits the entire app for free; Layer 2 wraps Layer 1 in a button; Layer 3 produces a directly-downloadable file without invoking the print dialog.

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: <PdfDownloadButton />  (CDR detail, QA, Reports)   │
│   ─ lazy imports jspdf + jspdf-autotable + html2canvas      │
│   ─ produces .pdf via Blob download                          │
│   ─ ~140 kB gzip lazy chunk                                  │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: <PrintButton />        (CDR/QA/Dashboard/anywhere) │
│   ─ wraps window.print() with target ref + pre/post hooks   │
│   ─ uses react-to-print 2.x (~5 kB gzip)                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: src/styles/print.css   (foundation, app-wide)      │
│   ─ @media print + @page rules                               │
│   ─ hides shell chrome, forces light mode, expands lists    │
│   ─ 0 kB JS, ~3 kB CSS gzip                                  │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1 — `src/styles/print.css`

Imported once from `src/index.css` (at the bottom, after Tailwind layers). Contents (representative — exact selectors finalized during implementation):

```css
@media print {
  /* Page setup — A4 default (LATAM/EU); browser print dialog allows user override to Letter/Legal */
  @page {
    size: A4 portrait;
    margin: 15mm 12mm 18mm 12mm;
  }

  /* Force light mode */
  html,
  body,
  * {
    background: white !important;
    color: black !important;
    box-shadow: none !important;
  }

  /* Hide shell chrome */
  [data-print='hide'],
  nav[aria-label='primary'],
  [role='dialog']:not([data-print='show']),
  [role='navigation'],
  .toaster,
  .skip-link,
  button:not([data-print='show']),
  [data-testid$='-export']:not([data-print='show']) {
    display: none !important;
  }

  /* Show only the print target */
  [data-print='target'] {
    display: block !important;
  }

  /* Tables: prevent row breaks, repeat header */
  thead {
    display: table-header-group;
  }
  tr,
  td,
  th {
    page-break-inside: avoid;
  }

  /* Expand virtualization (Track 5B) */
  [data-virtualized='true'] {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }
  [data-virtualized='true'] > * {
    transform: none !important;
    position: static !important;
  }

  /* Charts: ensure SVG prints */
  svg {
    max-width: 100%;
    height: auto;
  }

  /* Reduce-motion already handled by Track 5C-a11y */
}
```

**Hooks for components:** Components use `data-print="hide" | "show" | "target"` attributes (no Tailwind plugin needed; standard data attributes).

### Layer 2 — `<PrintButton />`

```tsx
import { useReactToPrint } from 'react-to-print';

interface PrintButtonProps {
  contentRef: React.RefObject<HTMLElement>;
  documentTitle?: string; // becomes default filename in browser print dialog
  onBeforePrint?: () => void | Promise<void>;
  onAfterPrint?: () => void;
  children?: React.ReactNode; // defaults to translated "Print"
  variant?: ButtonProps['variant']; // default 'outline'
}
```

Renders a `<Button>` with `Printer` lucide icon. On click:

1. Calls `onBeforePrint` (consumer can expand virtualized lists, close drawers, etc.)
2. Invokes `useReactToPrint({ contentRef, documentTitle })`
3. After print dialog closes, calls `onAfterPrint`

Browser handles "Save as PDF" or physical printing — we don't care which.

**Library:** `react-to-print@^2.15` (5 kB gzip, no PDF engine).

### Layer 3 — `<PdfDownloadButton />`

```tsx
interface PdfDownloadButtonProps {
  filename: string; // e.g., "cdr-acme-2026-05-08-1430.pdf"
  documentTitle: string; // PDF metadata title
  onGenerate: (ctx: PdfGenerationContext) => Promise<void>;
  children?: React.ReactNode; // defaults to translated "Download PDF"
  variant?: ButtonProps['variant']; // default 'outline'
}

interface PdfGenerationContext {
  doc: jsPDF;
  helpers: PdfHelpers; // header(), footer(), table(), section(), addImage(), etc.
}
```

Renders a `<Button>` with `Download` lucide icon. On click:

1. Sets `loading=true`, button shows spinner + `aria-busy="true"`
2. **Lazy-imports** `jspdf`, `jspdf-autotable`, `html2canvas` via `await import('@/core/pdf/engine')` — single chunk
3. Calls user-supplied `onGenerate(ctx)` to lay out the document
4. Helper `helpers.header()` is called automatically (and `helpers.footer()` per page) so consumers don't repeat boilerplate
5. Calls `doc.save(filename)` which triggers Blob download
6. Logs Sentry breadcrumb `pdf.export` with `{ surface, filename, durationMs }`
7. Surfaces error as toast `t('common.export.pdf.failed')` if generation throws
8. Sets `loading=false` regardless

**Library trio:** `jspdf@^3.x` + `jspdf-autotable@^5.x` + `html2canvas@^1.4.x`. All three resolved into one chunk via Vite `optimizeDeps` exclusion + Rollup `manualChunks` group `vendor-pdf`.

### `src/core/pdf/engine.ts` — re-export module

Single re-export module so the lazy import is cohesive:

```ts
export { default as jsPDF } from 'jspdf';
export { default as autoTable } from 'jspdf-autotable';
export { default as html2canvas } from 'html2canvas';
export * from './helpers';
```

### `src/core/pdf/helpers.ts` — composition primitives

```ts
export interface PdfHelpers {
  header(opts: HeaderOpts): void;
  footer(): void;
  section(title: string, body: () => void): void;
  table(opts: AutoTableOpts): void;
  rasterizeChart(target: HTMLElement): Promise<string>; // returns base64 PNG
}

interface HeaderOpts {
  title: string;
  tenantName: string;
  exportedBy: string; // user email
  exportedAt: Date;
}
```

`header()` writes a 0.5-inch banner at top-of-page with tenant name (left), title (center), timestamp+exporter (right). Drawn on `addPage` via jsPDF event. `footer()` writes "Page X of Y" centered. `rasterizeChart()` wraps `html2canvas(target)` with white background + 2× scale for retina.

### Tenant + user metadata

Read from existing stores and hooks:

```ts
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenant } from '@/core/api/hooks/use-tenants';
import { useTenantStore } from '@/core/tenant/tenant-store';

// In a component (PdfDownloadButton consumer):
const { user } = useAuthStore(); // user.email — always present on authenticated routes
const { activeTenantId } = useTenantStore();
const { data: tenant } = useTenant(activeTenantId ?? ''); // tenant.name — null while loading
```

`auth-store` exposes `user.email` and `tenantId`. `tenant-store` exposes `activeTenantId`. Tenant _name_ is not in any store — fetched via `useTenant(id)` which already exists in `use-tenants.ts`. The PDF helper accepts both:

- `tenantName: string` for display (falls back to `tenantId` if `tenant.name` not yet loaded — rare race but possible on first PDF after impersonation switch)
- `exportedBy: string` (user email)

PDF generation waits for `tenant.name` to resolve via TanStack Query — since the user has been on the authenticated app for at least one render before clicking "Download PDF", the tenant query is almost certainly cached. If somehow not cached, the button is disabled with `aria-busy` until resolved.

## Tier 1 Surfaces

### 1. CDR Detail PDF

**File:** `src/analytics/cdr/cdr-detail-drawer.tsx`

**Layout (~3-4 pages):**

1. **Page 1 — Summary card:** Contact name, phone, channel, queue, agent, start time, duration, disposition, SLA met, sentiment, QA score (if any). Two-column grid.
2. **Page 2 — Timeline:** Vertical event list (call answered, transferred, on-hold, wrap-up, disposition set). Renders timeline with `autoTable`.
3. **Page 3+ — Transcript:** If transcript exists, full text by speaker turn. Each turn = 1 row with timestamp + speaker label + text. Page-breaks per turn.

**No charts in CDR detail PDF.** Recording player is omitted (not paper-suitable).

### 2. QA Detail PDF

**File:** `src/analytics/qa/qa-detail-drawer.tsx`

**Layout (~2-3 pages):**

1. **Page 1 — Header + Score card:** Evaluation date, evaluator, agent, call ID (link back to CDR), overall score (large), pass/fail badge.
2. **Page 1-2 — Scoring breakdown:** Scorecard sections with criteria, weights, points scored. `autoTable` with sub-headers per section.
3. **Page 2-3 — Evaluator notes:** Free-text comments per criterion + overall feedback.

### 3. Scheduled Reports PDF

**File:** `src/admin/reports/reports-page.tsx` + `src/admin/reports/use-reports.ts`

**Currently:** the page lists scheduled reports with a "Run Now" button that calls `useRunReport()` and shows a toast. The result of "Run Now" is currently unused on the Web side (backend stores it; we don't expose download).

**UX flow change:**

1. User clicks "Run Now" on a row where `format === "PDF"` (CSV path stays unchanged)
2. Row enters loading state — button shows spinner, `aria-busy="true"`
3. `useRunReport()` mutation resolves with the data payload (rows + summary)
4. Row state flips to "Ready" — button becomes a `<PdfDownloadButton />` populated with the result
5. User clicks Download PDF → lazy import + generation as per Layer 3 spec
6. PDF lifetime: in-memory until user navigates away; not persisted to a queue

**Templates:** 4 templates under `src/admin/reports/templates/`:

- `cdr-summary-template.ts` — KPI cards + filtered CDR table (autoTable)
- `qa-summary-template.ts` — score distribution + per-agent breakdown
- `interval-template.ts` — call volume / SLA / abandonment intervals (table + optional sparkline)
- `agent-performance-template.ts` — per-agent metrics (occupancy, AHT, calls handled, QA avg)

**Minimum viable acceptance:** **2 templates** (CDR Summary + QA Summary) ship in this track because their data shapes are already covered by existing hooks (`useCdrList`, `useQaList`). Templates 3-4 (Interval + Agent Performance) ship as part of this track **only if** the corresponding hook + backend response shape is already populated; otherwise documented as deferred to a follow-up patch within Nivel 5 (does not block Track 5C-export tag).

**API contract verification at implementation start:** Read `useRunReport()` in `use-reports.ts` — confirm response shape. If only `jobId` is returned (no data rows), check whether a `GET /admin/reports/{id}/results/{jobId}` exists. If neither path works, ship the 2 minimum templates wired directly to `useCdrList` / `useQaList` filtered by the report's saved parameters.

### Print stylesheet beneficiaries (foundation, automatic)

Every page in the app gets a usable Ctrl+P. Tier 2 candidates (Dashboard, Audit, Speech analytics, etc.) get a basic print without a dedicated PDF button — sufficient for the "browser Save as PDF" workflow. We add `<PrintButton />` (Layer 2) on **only 3 surfaces** for explicit UX: CDR detail, QA detail, Analytics Dashboard.

## File Structure

### Created

```
src/styles/print.css                       — Layer 1 (~120 lines)
src/core/ui/print-button.tsx               — Layer 2 wrapper
src/core/ui/pdf-download-button.tsx        — Layer 3 wrapper
src/core/pdf/
  engine.ts                                 — re-export bundle
  helpers.ts                                — header/footer/section/table/rasterizeChart
  index.ts                                  — types + barrel
src/admin/reports/templates/
  cdr-summary-template.ts
  qa-summary-template.ts
  interval-template.ts
  agent-performance-template.ts
src/analytics/cdr/cdr-pdf-template.ts      — CDR detail layout
src/analytics/qa/qa-pdf-template.ts        — QA detail layout
tests/e2e/tests/export/pdf-download.spec.ts — Playwright smoke
```

### Modified

```
src/index.css                               — import print.css
src/analytics/cdr/cdr-detail-drawer.tsx    — add <PrintButton> + <PdfDownloadButton>
src/analytics/qa/qa-detail-drawer.tsx      — add <PrintButton> + <PdfDownloadButton>
src/admin/reports/reports-page.tsx         — wire PDF generation per format=PDF
src/analytics/dashboard/dashboard-page.tsx — add <PrintButton> only (no PDF)
src/shell/app-shell.tsx                     — data-print="hide" on shell chrome
vite.config.ts                              — manualChunks group "vendor-pdf"
public/locales/en-US/common.json           — print + export.pdf keys
public/locales/es-419/common.json          — same keys
public/locales/pt-BR/common.json           — same keys
package.json                                — add deps + bump 2.0.4 → 2.1.0
```

## Library Decisions

| Lib               | Version | Why                                       | Bundle (gzip) | Eager?      |
| ----------------- | ------- | ----------------------------------------- | ------------- | ----------- |
| `react-to-print`  | ^2.15   | Layer 2 orchestration only, no PDF engine | ~5 kB         | Yes (small) |
| `jspdf`           | ^3.0    | Text-based PDF, searchable output         | ~50 kB        | Lazy        |
| `jspdf-autotable` | ^5.0    | Table layouts with multi-page flow        | ~30 kB        | Lazy        |
| `html2canvas`     | ^1.4    | Chart rasterization only (not whole page) | ~50 kB        | Lazy        |

**Rejected alternatives:**

| Rejected                      | Reason                                                                  |
| ----------------------------- | ----------------------------------------------------------------------- |
| `pdfmake`                     | 250 kB gzip — too heavy for the value over jsPDF                        |
| `react-pdf` (renderer)        | 250 kB gzip + we'd rewrite layouts in JSX (duplicate logic)             |
| `html2pdf.js`                 | Wraps html2canvas+jspdf but rasterizes EVERYTHING → non-searchable PDFs |
| Backend Puppeteer             | Out of scope per CLAUDE.md (Web track doesn't span backend)             |
| Browser-only `window.print()` | Insufficient — users explicitly asked for "Download PDF" UX in Tier 1   |

## i18n Keys

`public/locales/{en-US,es-419,pt-BR}/common.json`:

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

Three locales — translations in es-419 and pt-BR done at implementation time. Parity check is part of `npm run lint`.

## Testing

### Unit (Vitest)

| File                           | Tests | Focus                                                                                |
| ------------------------------ | ----- | ------------------------------------------------------------------------------------ |
| `print-button.test.tsx`        | 3     | Renders, calls window.print on click, runs onBeforePrint/onAfterPrint hooks          |
| `pdf-download-button.test.tsx` | 5     | Renders, lazy-loads on click, sets aria-busy, calls onGenerate, surfaces error toast |
| `pdf/helpers.test.ts`          | 4     | header() output, footer() pagination, section() y-cursor, rasterizeChart mock        |
| `cdr-pdf-template.test.ts`     | 2     | Renders summary + timeline + transcript with mock data                               |
| `qa-pdf-template.test.ts`      | 2     | Renders score breakdown                                                              |
| `reports/templates/*.test.ts`  | 4     | One per template (smoke: doesn't throw, page count > 0)                              |

**~20 new unit tests.** Mock `jsPDF` at module level (test against helper API surface, not lib internals). Mock `html2canvas` to return a fixed base64 string.

### E2E (Playwright)

`tests/e2e/tests/export/pdf-download.spec.ts`:

1. Login via auth fixture
2. Navigate to `/analytics/cdr`
3. Click first row → drawer opens
4. Click "Download PDF" button
5. Assert: `page.waitForEvent('download')` fires, filename matches `/^cdr-.*\.pdf$/`, file size > 5 kB

Single E2E spec — additional surfaces have unit coverage; E2E exists to prove the lazy-import + Blob plumbing works end-to-end.

### Print stylesheet visual check

Manual smoke (documented in PR, not automated): Ctrl+P on `/analytics/cdr`, `/admin/reports`, `/operations/wallboard` → preview shows clean output with no shell chrome.

## Bundle Impact

- **Eager (shell):** +5 kB gzip from `react-to-print` (Layer 2 button is eager).
- **Lazy chunk `vendor-pdf`:** ~140 kB gzip, loaded only on first PDF download click. Cached per session.
- **CSS:** +3 kB gzip from `print.css`.
- **Total landing:** +8 kB gzip — well within Track 2B perf budget.

`vite.config.ts` adds `vendor-pdf` to the existing 13-vendor split:

```ts
{ name: 'vendor-pdf', test: /[\\/]node_modules[\\/](jspdf|jspdf-autotable|html2canvas)[\\/]/ }
```

## Risks & Mitigations

| Risk                                                                | Likelihood | Mitigation                                                                             |
| ------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| jspdf-autotable column widths break with long contact names in CDR  | M          | Use `cellWidth: 'wrap'` + `overflow: 'linebreak'`                                      |
| html2canvas fails on dark mode chart (CSS vars not resolved)        | M          | Force `data-theme="light"` on rasterization target before capture, restore after       |
| Sentry beforeBreadcrumb redacts PDF generation breadcrumbs as PII   | L          | `pdf.export` breadcrumb tag is whitelisted in `beforeBreadcrumb` filter                |
| Track 5B virtualized DataTable doesn't print all rows               | M          | Layer 1 CSS expands `[data-virtualized]` containers; verify in CDR table print test    |
| Lazy chunk fails to load on offline (after auth)                    | L          | Catch `import()` rejection, surface toast `export.pdf.failed`, keep button enabled     |
| RHF/Zod-rendered scheduled reports have non-PDF format pre-existing | L          | `<PdfDownloadButton>` only mounted when `format === 'PDF'`; CSV path unchanged         |
| Filename collision when downloading 2 PDFs in same minute           | L          | Filename includes `HHmm`; if user repeats, browser appends ` (1)` natively             |
| Tenant name with special chars breaks PDF filename                  | L          | `slugify` tenant in filename, keep raw in PDF body                                     |
| react-to-print v2 React 19 compatibility                            | L          | Verified at install; if peer warns, document `--legacy-peer-deps` (jsx-a11y precedent) |

## Versioning

Per [ADR-0005](../decisions/0005-versioning-track-end-tags.md): Track 5C-export ships as **`2.1.0`** with annotated tag **`v2.1.0-web`**. This is a minor bump because:

- New customer-facing capabilities (Download PDF buttons)
- New shared primitives in `src/core/ui/` (`PrintButton`, `PdfDownloadButton`)
- Closes the `format=PDF` vaporware on `reports-page.tsx`

If Track 5D (Forms UX + multi-tenant indicator) ships immediately after, both close Nivel 5 jointly with `v2.1.0-web` and `v2.1.x-web` respectively (see ADR-0005 — only the _last_ patch of Nivel 5 closure receives the milestone tag and GitHub release; intermediate PDFs ship under the same minor).

Final closure tag for Nivel 5: **`v2.1.x-web` "UX Maturity complete"** — assigned at Track 5D close.

## Open Questions

None blocking design. Implementation-time clarifications:

1. **Reports endpoint shape:** Confirm `useRunReport()` mutation's response shape — if it returns only a `jobId` we may need a separate `GET /admin/reports/{id}/results/{jobId}` to fetch data. Document at implementation start; if backend doesn't expose Web-callable results we ship CDR Summary + QA Summary first (use existing hooks) and defer Interval + Agent Performance.
2. **Recharts `<svg>` font embedding in PDF:** Initial implementation uses `html2canvas` (rasterizes including fonts). If file size becomes an issue (>2 MB for dashboard PDF), revisit with svg2pdf.js — out of scope for this track.

## Self-review notes

- ✅ All sections concrete (no TBD/TODO).
- ✅ Architecture, surfaces, libraries, i18n, tests, bundle, risks all enumerated.
- ✅ Out of scope explicitly listed; Tier 2/3 surfaces benefit from Layer 1 only.
- ✅ Versioning tied to ADR-0005.
- ✅ A11y impact considered (aria-busy on loading, focus preservation).
- ✅ Bundle delta within Track 2B budget.
- ✅ Library choices justified with rejected alternatives table.
