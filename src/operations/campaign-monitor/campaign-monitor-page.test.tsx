/**
 * The Operations campaign monitor (spec `operations-campaign-monitor`, design D1; Web #460), rendered
 * with the real page, card, `useActiveCampaignMetrics` and campaign metrics store, and a real i18next
 * instance loaded with the committed locale files. Only `customFetch` is stubbed. It plays Platform
 * as the host fixture `campaign-metrics-list.response.json` records it: `campaignId` a JSON number,
 * `status` the enum name (`"Active"`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import { queryClient as appQueryClient } from '@/core/api/query-client';
import { useCampaignMetricsStore } from '@/operations/stores/campaign-metrics-store';
import {
  OPERATIONS_LOCALES,
  TEST_LOCALES,
  createLocaleI18n,
  type TestLocale,
} from '@/test/locale-i18n';
import CampaignMonitorPage from './campaign-monitor-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

type MetricsItem = { campaignId: number; campaignName: string; status: string } & Record<
  string,
  unknown
>;

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as T;
}

const metricsList = fixture<MetricsItem[]>('campaign-metrics-list.response.json');
const activeItem = metricsList[0]!;

/** What `GET /api/v1/operations/campaigns/metrics` answers in the current test. */
let served: MetricsItem[];

beforeEach(() => {
  served = metricsList;
  useCampaignMetricsStore.setState({ campaigns: [] });
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const route = `${config.method} ${config.url}`;
    if (route === 'GET /api/v1/operations/campaigns/metrics') return served;
    return undefined;
  });
});

async function renderPage(
  lng: TestLocale = 'en-US',
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const i18n = await createLocaleI18n(lng);
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CampaignMonitorPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

/** The card of campaign `id`, once it has rendered. */
async function card(id: number) {
  return screen.findByTestId(`campaign-card-${id}`);
}

function actions(el: HTMLElement, lng: TestLocale = 'en-US') {
  const c = OPERATIONS_LOCALES[lng].campaigns;
  return [c.pause, c.resume, c.stop].filter(
    (name) => within(el).queryByRole('button', { name: new RegExp(name) }) !== null,
  );
}

const en = OPERATIONS_LOCALES['en-US'].campaigns;

/** The GETs of the monitor's list so far. */
function metricsReads() {
  return vi
    .mocked(client.customFetch)
    .mock.calls.filter(([config]) => config.url === '/api/v1/operations/campaigns/metrics').length;
}

describe('CampaignMonitorPage', () => {
  it('CampaignMonitorPage_ShouldReadTheApiAgainAndReplaceTheSnapshot_WhenReopenedInsideTheStaleTime', async () => {
    // The production defaults: renderPage's own client has no staleTime, so its data is always stale
    // and a reopen refetches with or without the hook's refetchOnMount.
    const productionQueries = appQueryClient.getDefaultOptions().queries;
    expect(productionQueries?.staleTime).toBe(30_000);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { ...productionQueries, retry: false } },
    });

    const first = await renderPage('en-US', queryClient);
    await card(activeItem.campaignId);
    expect(metricsReads()).toBe(1);
    first.unmount();

    served = [{ ...activeItem, status: 'Paused' }];
    await renderPage('en-US', queryClient);

    await waitFor(() => expect(metricsReads()).toBe(2));
    await waitFor(() =>
      expect(
        within(screen.getByTestId(`campaign-card-${activeItem.campaignId}`)).getByTestId(
          'campaign-card-status',
        ),
      ).toHaveTextContent(en.status_paused),
    );
  });

  it('CampaignMonitorPage_ShouldRenderTheActiveCardWithPauseAndStop_WhenPlatformSendsTheEnumName', async () => {
    await renderPage();

    const el = await card(activeItem.campaignId);
    expect.soft(within(el).getByText(activeItem.campaignName)).toBeInTheDocument();
    expect.soft(within(el).getByTestId('campaign-card-status')).toHaveTextContent(en.status_active);
    expect.soft(actions(el)).toEqual([en.pause, en.stop]);
    // connectRate 0.42 and abandonRate 0.02 are fractions, rendered as percentages.
    expect.soft(within(el).getByText('42%')).toBeInTheDocument();
    expect.soft(within(el).getByText('2%')).toBeInTheDocument();
  });

  it('CampaignMonitorPage_ShouldShowTheRawStatusWithNoAction_WhenTheStatusIsUnknown', async () => {
    served = [
      { ...activeItem, campaignId: 12, campaignName: 'Odd one', status: 'Suspended' },
      activeItem,
    ];
    await renderPage();

    const odd = await card(12);
    const badge = within(odd).getByTestId('campaign-card-status');
    expect.soft(badge).toHaveTextContent(/^Suspended$/);
    expect.soft(badge.getAttribute('data-variant')).toBe('outline');
    expect.soft(actions(odd)).toEqual([]);
    expect.soft(await card(activeItem.campaignId), 'the other card renders').toBeInTheDocument();
  });

  it('CampaignMonitorPage_ShouldShowOnlyThePausedCampaign_WhenThePausedFilterIsChosen', async () => {
    served = [
      activeItem,
      { ...activeItem, campaignId: 12, campaignName: 'Paused one', status: 'Paused' },
    ];
    await renderPage();
    await card(12);

    fireEvent.click(screen.getByTestId('campaign-monitor-filter-paused'));

    const cards = within(screen.getByTestId('campaign-monitor-cards')).queryAllByTestId(
      /^campaign-card-\d+$/,
    );
    expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual(['campaign-card-12']);
  });
});

describe.each(TEST_LOCALES)('CampaignMonitorPage status labels in %s', (lng) => {
  const c = OPERATIONS_LOCALES[lng].campaigns as Record<string, string>;

  it('CampaignMonitorPage_ShouldShowTheLocalizedCompletedLabel_WhenTheStatusIsCompleted', async () => {
    served = [{ ...activeItem, status: 'Completed' }];
    await renderPage(lng);

    const el = await card(activeItem.campaignId);
    expect.soft(c.status_completed, 'the Completed label exists').toEqual(expect.any(String));
    expect
      .soft(within(el).getByTestId('campaign-card-status'))
      .toHaveTextContent(c.status_completed ?? 'status_completed');
    expect.soft(actions(el, lng)).toEqual([]);
  });
});
