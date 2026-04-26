import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Mock i18n ───────────────────────────────────────────────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string) => defaultValue ?? _key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// ─── Mock partner revenue hooks ─────────────────────────────────────────────
import type {
  PartnerRevenueDetail,
  PartnerRevenueSummary,
} from '@/core/api/hooks/use-partner';

const summary: PartnerRevenueSummary = {
  totalGross: 1000,
  totalPlatformCost: 400,
  totalMargin: 600,
  customerCount: 2,
  invoiceCount: 3,
};

const details: PartnerRevenueDetail[] = [
  {
    revenueId: 'rev-1',
    customerTenantId: 'cust-alpha',
    invoiceId: 'inv-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    grossAmount: 600,
    platformCost: 240,
    partnerMargin: 360,
    periodStart: '2026-04-01T00:00:00Z',
    periodEnd: '2026-04-30T00:00:00Z',
  },
  {
    revenueId: 'rev-2',
    customerTenantId: 'cust-beta',
    invoiceId: 'inv-11111111-2222-3333-4444-555555555555',
    grossAmount: 400,
    platformCost: 160,
    partnerMargin: 240,
    periodStart: '2026-04-01T00:00:00Z',
    periodEnd: '2026-04-30T00:00:00Z',
  },
];

vi.mock('@/core/api/hooks/use-partner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-partner')>();
  return {
    ...actual,
    usePartnerRevenueSummary: () => ({ data: summary }),
    usePartnerRevenueDetails: () => ({ data: details }),
  };
});

import PartnerRevenuePage from '@/admin/partner/revenue-page';

function renderPage() {
  return render(
    <MemoryRouter>
      <PartnerRevenuePage />
    </MemoryRouter>,
  );
}

let createObjectURLSpy: ReturnType<typeof vi.fn>;
let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
let clickSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  createObjectURLSpy = vi.fn(() => 'blob:mock-url');
  revokeObjectURLSpy = vi.fn();
  // jsdom does not implement these on URL by default.
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: createObjectURLSpy,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: revokeObjectURLSpy,
  });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  clickSpy.mockRestore();
});

describe('PartnerRevenuePage CSV export', () => {
  it('CsvButton_ShouldRender_WhenDetailsPresent', () => {
    renderPage();
    expect(screen.getByTestId('revenue-csv-export')).toBeInTheDocument();
  });

  it('CsvDownload_ShouldTriggerBlob_WhenButtonClicked', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('revenue-csv-export'));

    // Blob URL was created and an anchor click was triggered.
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toMatch(/text\/csv/);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1);
  });
});
