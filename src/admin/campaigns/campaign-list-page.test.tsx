/**
 * The campaign list's status badge and row lifecycle actions (spec `campaign-console`, design D3),
 * rendered with the real page, query hooks and a real i18next instance loaded with the committed
 * locale files. Only `customFetch` is stubbed. It answers the list with the host fixture
 * `campaign-list.response.json` (`items[].status` PascalCase), its items changed per case.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import CampaignListPage from './campaign-list-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

type ListItem = { id: number; name: string; status: string } & Record<string, unknown>;
type CampaignList = { items: ListItem[] } & Record<string, unknown>;

const listFixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/campaign-list.response.json'),
    'utf-8',
  ),
) as CampaignList;

/** The list the fake Platform answers: the fixture, with campaign 11's `status` set per case. */
let list: CampaignList;

function seed(status: string) {
  list = {
    ...listFixture,
    items: listFixture.items.map((item) => (item.id === 11 ? { ...item, status } : item)),
  };
}

beforeEach(() => {
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const route = `${config.method} ${config.url}`;
    if (route === 'GET /api/v1/admin/campaigns') return list;
    throw new Error(`unexpected ${route}`);
  });
});

async function renderPage(lng: TestLocale): Promise<I18n> {
  const i18n = await createLocaleI18n(lng);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/campaigns']}>
          <CampaignListPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  await screen.findByText('Q4 renewals');
  return i18n;
}

/** The status badge and the lifecycle actions of the row naming `campaignName`. */
function row(campaignName: string, lng: TestLocale) {
  const c = ADMIN_LOCALES[lng].campaigns;
  const tr = screen.getByText(campaignName).closest('tr')!;
  const badge = tr.querySelector('[data-slot="badge"]');
  const actions = [c.start, c.pause, c.resume, c.stop].filter(
    (name) => within(tr).queryByRole('button', { name }) !== null,
  );
  return {
    label: badge?.textContent ?? null,
    variant: badge?.getAttribute('data-variant') ?? null,
    actions,
  };
}

describe.each(TEST_LOCALES)('CampaignListPage status in %s', (lng) => {
  const c = ADMIN_LOCALES[lng].campaigns;

  it('CampaignListPage_ShouldOfferPauseAndStop_WhenARowIsActive', async () => {
    seed('Active');
    await renderPage(lng);

    const active = row('Q4 renewals', lng);
    expect.soft(active.label).toBe(c.status_active);
    expect.soft(active.actions).toEqual([c.pause, c.stop]);
  });

  it('CampaignListPage_ShouldShowTheArchivedLabelAndNoAction_WhenARowIsArchived', async () => {
    seed('Archived');
    const i18n = await renderPage(lng);

    const archived = i18n.t('admin:campaigns.status_archived');
    expect.soft(archived, 'the Archived label is translated').not.toMatch(/status_archived/);
    const r = row('Q4 renewals', lng);
    expect.soft(r.label).toBe(archived);
    expect.soft(r.actions).toEqual([]);
  });

  it('CampaignListPage_ShouldShowTheRawStatusAndNoAction_WhenARowHasAnUnknownStatus', async () => {
    seed('Suspended');
    await renderPage(lng);

    const r = row('Q4 renewals', lng);
    expect.soft({ label: r.label, variant: r.variant }).toEqual({
      label: 'Suspended',
      variant: 'outline',
    });
    expect.soft(r.actions).toEqual([]);
    // The other row (the fixture's `Draft` campaign 12) still renders, and reads as a draft.
    const other = row('Reminder robot', lng);
    expect.soft(other.label).toBe(c.status_draft);
    expect.soft(other.actions).toEqual([c.start]);
  });
});
