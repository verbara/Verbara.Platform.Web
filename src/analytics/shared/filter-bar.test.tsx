import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi } from 'vitest';

// The QA list route takes no queue (`ListQa`), so the QA page offers no queue select (audit round
// 4); every other analytics page keeps it.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
}));
vi.mock('@/core/api/hooks/use-queues', () => ({ useQueues: () => ({ data: [] }) }));
vi.mock('./export-button', () => ({ ExportButton: () => null }));
vi.mock('./date-range-picker', () => ({ DateRangePicker: () => null }));

import { FilterBar } from './filter-bar';

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
});
