import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => (typeof opts === 'string' ? opts : key),
    i18n: { changeLanguage: vi.fn() },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

const summaryHook = vi.fn((_from?: string, _until?: string) => ({ data: undefined }));
const detailsHook = vi.fn((_from?: string, _until?: string) => ({ data: [] }));

vi.mock('@/core/api/hooks/use-partner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-partner')>();
  return {
    ...actual,
    usePartnerRevenueSummary: (from?: string, until?: string) => summaryHook(from, until),
    usePartnerRevenueDetails: (from?: string, until?: string) => detailsHook(from, until),
  };
});

import PartnerRevenuePage from '@/admin/partner/revenue-page';

beforeEach(() => {
  summaryHook.mockClear();
  detailsHook.mockClear();
});

describe('PartnerRevenuePage date filter', () => {
  it('ApplyFilter_ShouldSendTheChosenDates_WhenBothDatesAreSet', () => {
    render(
      <MemoryRouter>
        <PartnerRevenuePage />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByTestId('revenue-from'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByTestId('revenue-until'), { target: { value: '2026-10-31' } });
    fireEvent.click(screen.getByTestId('apply-revenue-filter'));

    // The API reads a date-only `until` as the whole day; a midnight instant would drop Oct 31.
    expect(summaryHook).toHaveBeenLastCalledWith('2026-10-01', '2026-10-31');
    expect(detailsHook).toHaveBeenLastCalledWith('2026-10-01', '2026-10-31');
  });
});
