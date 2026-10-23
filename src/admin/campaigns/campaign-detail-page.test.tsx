/**
 * The campaign detail page's edit form (spec `campaign-console`, design D4) and its status badge and
 * lifecycle actions (design D3), rendered with the real page, query hooks and a real i18next
 * instance loaded with the committed locale files. Only `customFetch` is stubbed. It plays Platform
 * as the host change's fixtures record it (`tests/fixtures/contracts/`): the detail
 * (`campaign-detail.response.json`, `status` PascalCase), the queue list, and a `PUT` that applies
 * the members it receives (absent means unchanged) and answers 200 with the detail.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import { useAuthStore } from '@/core/auth/auth-store';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import CampaignDetailPage from './campaign-detail-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

function fixture<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as T;
}

const detailFixture = fixture('campaign-detail.response.json');
const queueList = fixture('queue-list.response.json');

const CAMPAIGN_URL = '/api/v1/admin/campaigns/11';

/** What the fake Platform currently holds for campaign 11. */
let stored: Record<string, unknown>;
/** Every `PUT` body the page sent, in order. */
let puts: Record<string, unknown>[];

function answer(config: Parameters<typeof client.customFetch>[0]): unknown {
  const route = `${config.method} ${config.url}`;
  switch (route) {
    case `GET ${CAMPAIGN_URL}`:
      return { ...stored };
    case `PUT ${CAMPAIGN_URL}`: {
      const body = JSON.parse(JSON.stringify(config.data ?? null)) as Record<string, unknown>;
      puts.push(body);
      const applied = Object.fromEntries(
        Object.entries(body).filter(([, v]) => v !== null && v !== undefined),
      );
      if ('targetQueueName' in applied) applied.queueName = applied.targetQueueName;
      delete applied.targetQueueName;
      stored = { ...stored, ...applied };
      return { ...stored };
    }
    case `GET ${CAMPAIGN_URL}/dispositions`:
    case `GET ${CAMPAIGN_URL}/contact-lists`:
    case `GET ${CAMPAIGN_URL}/callbacks`:
      return [];
    case 'GET /api/v1/admin/queues':
      return queueList;
    default:
      throw new Error(`unexpected ${route}`);
  }
}

beforeEach(() => {
  puts = [];
  useAuthStore.setState({ permissions: ['campaigns:campaign:edit'] });
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => answer(config));
});

function seed(overrides: Record<string, unknown>) {
  stored = { ...detailFixture, ...overrides };
}

async function renderPage(lng: TestLocale = 'en-US'): Promise<I18n> {
  const i18n = await createLocaleI18n(lng);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/campaigns/11']}>
          <Routes>
            <Route path="/admin/campaigns/:campaignId" element={<CampaignDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  await screen.findByRole('heading', { name: String(stored.name) });
  return i18n;
}

/** The status badge in the page's header card. */
function statusBadge() {
  const heading = screen.getByRole('heading', { name: String(stored.name) });
  const el = heading.parentElement!.querySelector('[data-slot="badge"]');
  return { label: el?.textContent ?? null, variant: el?.getAttribute('data-variant') ?? null };
}

function lifecycleActions(lng: TestLocale) {
  const c = ADMIN_LOCALES[lng].campaigns;
  return [c.start, c.pause, c.resume, c.stop].filter(
    (name) => screen.queryByRole('button', { name }) !== null,
  );
}

const en = ADMIN_LOCALES['en-US'].campaigns;

async function openEdit() {
  fireEvent.click(screen.getByRole('button', { name: en.detail.edit_btn }));
  await screen.findByDisplayValue(String(stored.name));
}

/** The edit mode's queue choice, once its options (the tenant's queues) have loaded. */
async function editQueue() {
  const select = (await screen.findByTestId('campaign-edit-queue')) as HTMLSelectElement;
  await within(select).findByRole('option', { name: 'sales' });
  return select;
}

function clickSave() {
  fireEvent.click(screen.getByRole('button', { name: en.detail.save_btn }));
}

describe('CampaignDetailPage edit form', () => {
  it('CampaignDetailPage_ShouldSendTheChosenQueueByName_WhenACampaignWithoutAQueueIsEdited', async () => {
    seed({ queueName: '' });
    await renderPage();
    await openEdit();

    const select = await editQueue();
    expect(select.value, 'opens on the empty choice').toBe('');
    fireEvent.change(select, { target: { value: 'sales' } });
    clickSave();

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]!.targetQueueName).toBe('sales');
    await waitFor(() => expect(screen.queryByTestId('campaign-edit-queue')).toBeNull());
    expect(screen.getByText('sales')).toBeInTheDocument();
  });

  it('CampaignDetailPage_ShouldPreselectTheSavedQueue_WhenTheEditModeOpens', async () => {
    seed({ queueName: 'sales' });
    await renderPage();
    await openEdit();

    const select = await editQueue();

    expect(select.value).toBe('sales');
  });

  it('CampaignDetailPage_ShouldKeepAnUnlistedSavedQueue_WhenOnlyTheNameIsChanged', async () => {
    seed({ queueName: 'legacy' });
    const i18n = await renderPage();
    await openEdit();

    const select = await editQueue();
    expect(select.value, 'the unlisted saved queue is preselected').toBe('legacy');
    const unlisted = within(select).getByRole('option', { selected: true });
    const label = i18n.t('admin:campaigns.detail.queue_unlisted', { name: 'legacy' });
    expect(label, 'the unlisted label is translated').not.toMatch(/queue_unlisted/);
    expect(unlisted).toHaveTextContent(label);

    fireEvent.change(screen.getByDisplayValue(String(stored.name)), {
      target: { value: 'Q4 renewals (edited)' },
    });
    clickSave();

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]!.name).toBe('Q4 renewals (edited)');
    expect(puts[0]!.targetQueueName).toBe('legacy');
  });

  it('CampaignDetailPage_ShouldRefuseToSave_WhenNoQueueIsChosen', async () => {
    seed({ queueName: '' });
    await renderPage();
    await openEdit();
    await editQueue();

    clickSave();

    expect(await screen.findByTestId('campaign-edit-queue-error')).toHaveTextContent(
      en.validation.queueRequired,
    );
    expect(puts, 'no PUT is sent').toHaveLength(0);
  });

  it('CampaignDetailPage_ShouldSaveWithoutATargetQueue_WhenAnAgentlessCampaignIsEdited', async () => {
    seed({ mode: 'Robot', queueName: '' });
    await renderPage();
    await openEdit();
    await editQueue();

    fireEvent.change(screen.getByDisplayValue(String(stored.name)), {
      target: { value: 'Reminder robot' },
    });
    clickSave();

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]!.name).toBe('Reminder robot');
    expect(puts[0]).not.toHaveProperty('targetQueueName');
  });
});

describe.each(TEST_LOCALES)('CampaignDetailPage status in %s', (lng) => {
  const c = ADMIN_LOCALES[lng].campaigns;

  it('CampaignDetailPage_ShouldShowTheDraftLabelAndOfferStart_WhenTheStatusIsDraft', async () => {
    seed({ status: 'Draft' });
    await renderPage(lng);

    expect.soft(statusBadge().label).toBe(c.status_draft);
    expect.soft(lifecycleActions(lng)).toEqual([c.start]);
  });

  it('CampaignDetailPage_ShouldShowTheArchivedLabelAndNoAction_WhenTheStatusIsArchived', async () => {
    seed({ status: 'Archived' });
    const i18n = await renderPage(lng);

    const archived = i18n.t('admin:campaigns.status_archived');
    expect.soft(archived, 'the Archived label is translated').not.toMatch(/status_archived/);
    expect.soft(statusBadge().label).toBe(archived);
    expect.soft(lifecycleActions(lng)).toEqual([]);
  });

  it('CampaignDetailPage_ShouldShowTheRawStatusAndNoAction_WhenTheStatusIsUnknown', async () => {
    seed({ status: 'Suspended' });
    await renderPage(lng);

    expect.soft(statusBadge()).toEqual({ label: 'Suspended', variant: 'outline' });
    expect.soft(lifecycleActions(lng)).toEqual([]);
    expect.soft(screen.getByText(c.detail.queue)).toBeInTheDocument();
    expect.soft(screen.getByText(c.dispositions.heading)).toBeInTheDocument();
  });
});
