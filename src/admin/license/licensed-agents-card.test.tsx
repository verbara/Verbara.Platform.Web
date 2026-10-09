import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { format } from 'date-fns';

import { createWrapper } from '@/test/hook-test-utils';
import type { LicensedAgentPeaks } from '@/core/api/hooks/use-system';

// i18n returns the key, so the copy is asserted through its key (spec: the advisory banner's
// tier-neutral text is asserted through its i18n key, not its text).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' ? `${k}:${JSON.stringify(opts)}` : k,
  }),
}));

// Month options are labelled `yyyy-MM`, so a test can pick a month by name.
vi.mock('@/core/i18n/use-format', () => ({
  useFormatDate: () => ({
    formatDate: (v: string | Date) => (typeof v === 'string' ? v : format(v, 'yyyy-MM')),
  }),
  useFormatNumber: () => ({ formatNumber: (n: number) => String(n) }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { LicensedAgentsCard } from './licensed-agents-card';
import { peakDayTenants } from './peak-day-tenants';

const PEAKS_PATH = resolve(process.cwd(), 'tests/fixtures/contracts/licensed-agent-peaks.v1.json');
const EXPORT_PATH = resolve(
  process.cwd(),
  'tests/fixtures/contracts/licensed-agent-export.v1.json',
);

function peaksFixture(): LicensedAgentPeaks {
  return JSON.parse(readFileSync(PEAKS_PATH, 'utf-8')) as LicensedAgentPeaks;
}

function withPeaks(mutate: (p: LicensedAgentPeaks) => void): LicensedAgentPeaks {
  const p = peaksFixture();
  mutate(p);
  return p;
}

const EMPTY = withPeaks((p) => {
  p.deployment = { peakLicensedAgents: 0, peakDay: null, overBand: false };
  p.days = [];
});

const server = setupServer();
const peaksRequests: URLSearchParams[] = [];
const exportRequests: URLSearchParams[] = [];

function servePeaks(body: LicensedAgentPeaks) {
  server.use(
    http.get('*/api/v1/management/licensing/agents', ({ request }) => {
      peaksRequests.push(new URL(request.url).searchParams);
      return HttpResponse.json(body);
    }),
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  peaksRequests.length = 0;
  exportRequests.length = 0;
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

// Today, for every test: 8 October 2026 (local time).
const TODAY = new Date(2026, 9, 8, 12, 0, 0);

function renderCard() {
  return render(<LicensedAgentsCard today={TODAY} />, { wrapper: createWrapper() });
}

async function selectMonth(name: string) {
  fireEvent.click(screen.getByTestId('license-agents-month-select'));
  const option = await screen.findByRole('option', { name });
  // base-ui commits a mouse click only when the press started on the item.
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option);
}

describe('LicensedAgentsCard', () => {
  it('Render_ShouldShowPeakAgainstBandWithMeter_WhenPeakIs47Of50', async () => {
    servePeaks(peaksFixture());
    renderCard();

    expect(await screen.findByTestId('license-agents-peak')).toHaveTextContent('47');
    expect(screen.getByTestId('license-agents-band')).toHaveTextContent('/ 50');
    expect(screen.getByTestId('license-agents-peak-day')).toHaveAttribute('data-day', '2026-09-17');
    const meter = screen.getByTestId('license-agents-meter');
    expect(meter).toHaveAttribute('aria-valuenow', '47');
    expect(meter).toHaveAttribute('aria-valuemax', '50');
    expect(meter).toHaveAttribute('data-tone', 'advisory');
    expect(screen.queryByTestId('license-agents-not-declared')).toBeNull();
    expect(screen.getByTestId('license-agents-day-zone')).toHaveTextContent('"zone":"UTC"');
  });

  it.each([null, 0])(
    'Render_ShouldShowNotDeclaredAndNoMeter_WhenMaxAgentsIs%s',
    async (maxAgents) => {
      servePeaks(withPeaks((p) => (p.license.maxAgents = maxAgents)));
      renderCard();

      expect(await screen.findByTestId('license-agents-not-declared')).toBeInTheDocument();
      expect(screen.getByTestId('license-agents-peak')).toHaveTextContent('47');
      expect(screen.queryByTestId('license-agents-meter')).toBeNull();
      expect(screen.queryByTestId('license-agents-band')).toBeNull();
    },
  );

  it('Render_ShouldShowEmptyStateOnly_WhenNoDayOfTheMonthIsClosed', async () => {
    servePeaks(EMPTY);
    renderCard();

    expect(await screen.findByTestId('license-agents-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('license-agents-peak')).toBeNull();
    expect(screen.queryByTestId('license-agents-peak-day')).toBeNull();
    expect(screen.queryByTestId('license-agents-meter')).toBeNull();
    expect(screen.queryByTestId('license-agents-not-declared')).toBeNull();
    expect(screen.queryByTestId('license-agents-tenant-breakdown')).toBeNull();
    // The month selector, the day zone and the export stay available.
    expect(screen.getByTestId('license-agents-month-select')).toBeInTheDocument();
    expect(screen.getByTestId('license-agents-day-zone')).toBeInTheDocument();
    expect(screen.getByTestId('license-agents-export-button')).toBeEnabled();
  });

  it('MonthSelect_ShouldOfferExactlyFifteenMonths_WhenOpened', async () => {
    servePeaks(peaksFixture());
    renderCard();

    fireEvent.click(screen.getByTestId('license-agents-month-select'));
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(15);
    expect(options[0]).toHaveTextContent('2026-10');
    expect(options[14]).toHaveTextContent('2025-08');
    expect(options[1]).toHaveAttribute('data-month', '2026-09');
  });

  it('Render_ShouldRequestCurrentMonthAndShowInProgressHint_WhenDefaultSelection', async () => {
    servePeaks(peaksFixture());
    renderCard();

    expect(screen.getByTestId('license-agents-month-in-progress')).toBeInTheDocument();
    await waitFor(() => expect(peaksRequests).toHaveLength(1));
    expect(peaksRequests[0]!.get('from')).toBe('2026-10-01');
    expect(peaksRequests[0]!.get('to')).toBe('2026-10-31');
  });

  it('MonthSelect_ShouldDrivePeaksAndExport_WhenPastMonthSelected', async () => {
    const bytes = readFileSync(EXPORT_PATH);
    servePeaks(peaksFixture());
    server.use(
      http.get('*/api/v1/management/licensing/agents/export', ({ request }) => {
        exportRequests.push(new URL(request.url).searchParams);
        return new HttpResponse(bytes, { headers: { 'Content-Type': 'application/json' } });
      }),
    );
    let saved: Blob | null = null;
    let savedName = '';
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn((b: Blob) => {
      saved = b;
      return 'blob:licensed-agents';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      savedName = this.download;
    });

    try {
      renderCard();
      await selectMonth('2026-09');

      await waitFor(() =>
        expect(peaksRequests.some((q) => q.get('from') === '2026-09-01')).toBe(true),
      );
      const september = peaksRequests.find((q) => q.get('from') === '2026-09-01')!;
      expect(september.get('to')).toBe('2026-09-30');
      expect(screen.queryByTestId('license-agents-month-in-progress')).toBeNull();

      fireEvent.click(screen.getByTestId('license-agents-export-button'));
      await waitFor(() => expect(saved).not.toBeNull());
      expect(exportRequests).toHaveLength(1);
      expect(exportRequests[0]!.get('from')).toBe('2026-09-01');
      expect(exportRequests[0]!.get('to')).toBe('2026-09-30');
      expect(Buffer.from(await saved!.arrayBuffer()).equals(bytes)).toBe(true);
      expect(savedName).toBe('licensed-agents-2026-09-01-2026-09-30.json');
    } finally {
      click.mockRestore();
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
    }
  });

  it('Breakdown_ShouldListPeakDayTenantsByLicensedAgents_WhenPeakDayHasAnEntry', async () => {
    servePeaks(peaksFixture());
    renderCard();

    const breakdown = await screen.findByTestId('license-agents-tenant-breakdown');
    const rows = breakdown.querySelectorAll('tr[data-tenant-id]');
    expect([...rows].map((r) => r.getAttribute('data-tenant-id'))).toEqual([
      'ten-acme',
      'ten-globex',
    ]);
    expect(within(rows[0] as HTMLElement).getByText('Acme Support')).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute('data-licensed-agents', '32');
    expect(within(rows[1] as HTMLElement).getByText('Globex Sales')).toBeInTheDocument();
    expect(rows[1]).toHaveAttribute('data-licensed-agents', '15');
    // The 2026-09-16 figures (30 and 14) are not shown, nor any hash.
    expect(breakdown.querySelector('[data-licensed-agents="30"]')).toBeNull();
    expect(breakdown.querySelector('[data-licensed-agents="14"]')).toBeNull();
    expect(screen.getByTestId('license-agents-card').textContent).not.toContain('lac1:');
  });

  it('Breakdown_ShouldNotRender_WhenDaysHasNoEntryForThePeakDay', async () => {
    servePeaks(withPeaks((p) => (p.deployment.peakDay = '2026-09-18')));
    renderCard();

    expect(await screen.findByTestId('license-agents-peak')).toBeInTheDocument();
    expect(screen.queryByTestId('license-agents-tenant-breakdown')).toBeNull();
  });

  it('PeakDayTenants_ShouldSortDescending_WhenServerOrderDiffers', () => {
    const peaks = withPeaks((p) => p.days[1]!.tenants.reverse());
    expect(peakDayTenants(peaks)?.map((t) => t.licensedAgents)).toEqual([32, 15]);
    expect(peakDayTenants(EMPTY)).toBeNull();
  });

  it('AdvisoryBanner_ShouldRenderTierNeutralKey_WhenOverBandIsTrue', async () => {
    servePeaks(withPeaks((p) => (p.deployment.overBand = true)));
    renderCard();

    const banner = await screen.findByTestId('license-agents-advisory-banner');
    expect(banner).toHaveAttribute('data-i18n-key', 'admin:license.agents.advisory');
    expect(banner).toHaveTextContent('admin:license.agents.advisory');
    expect(banner.className).toContain('amber');
    expect(banner.className).not.toContain('destructive');
    expect(screen.getByTestId('license-agents-export-button')).toBeEnabled();
  });

  it('AdvisoryBanner_ShouldNotRender_WhenOverBandIsFalse', async () => {
    servePeaks(peaksFixture());
    renderCard();

    expect(await screen.findByTestId('license-agents-peak')).toBeInTheDocument();
    expect(screen.queryByTestId('license-agents-advisory-banner')).toBeNull();
  });

  it('Render_ShouldShowError_WhenPeaksRequestFails', async () => {
    server.use(
      http.get('*/api/v1/management/licensing/agents', () =>
        HttpResponse.json({ detail: 'boom' }, { status: 500 }),
      ),
    );
    renderCard();

    expect(await screen.findByTestId('license-agents-error')).toBeInTheDocument();
    expect(screen.getByTestId('license-agents-export-button')).toBeEnabled();
  });
});
