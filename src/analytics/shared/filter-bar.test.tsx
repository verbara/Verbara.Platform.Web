import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi } from 'vitest';

// The QA list route takes no queue (`ListQa`), so the QA page offers no queue select;
// every other analytics page keeps it.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));
vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: () => ({ data: [{ id: 'q1', name: 'support' }] }),
}));
vi.mock('./export-button', () => ({ ExportButton: () => null }));
vi.mock('./date-range-picker', () => ({ DateRangePicker: () => null }));

import { FilterBar } from './filter-bar';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <FilterBar />
    </MemoryRouter>,
  );
}

describe('FilterBar', () => {
  it('RendersNoQueueSelect_OnTheQaPage', () => {
    renderAt('/analytics/qa');

    expect(screen.queryByTestId('filter-queue')).not.toBeInTheDocument();
  });

  it('RendersTheQueueSelect_OnTheCdrPage', () => {
    renderAt('/analytics/cdr');

    expect(screen.getByTestId('filter-queue')).toBeInTheDocument();
  });

  it('SetsTheQueueFilter_WhenAQueueIsPicked', () => {
    renderAt('/analytics/cdr');

    fireEvent.change(screen.getByTestId('filter-queue'), { target: { value: 'support' } });

    expect(useAnalyticsFilterStore.getState().queue).toBe('support');
  });
});
