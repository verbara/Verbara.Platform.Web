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
/** A disposition code as Platform v2.32.0 returns it (`addsToDnc` present, `category` the enum name). */
const dispoTarget = fixture('disposition-code.target.response.json');
/** A disposition code as a Platform before v2.32.0 returns it (no `addsToDnc`). */
const dispoCurrent = fixture('disposition-code.response.json');
const dispoCreateRequest = fixture('disposition-code-create.target.request.json');
const dispoUpdateRequest = fixture('disposition-code-update.target.request.json');

const CAMPAIGN_URL = '/api/v1/admin/campaigns/11';

/** What the fake Platform currently holds for campaign 11. */
let stored: Record<string, unknown>;
/** Every `PUT` body the page sent, in order. */
let puts: Record<string, unknown>[];
/** What `GET …/dispositions` answers. */
let dispositions: Record<string, unknown>[];
/** Every disposition `POST` and `PUT` body the page sent, as JSON on the wire. */
let dispoPosts: Record<string, unknown>[];
let dispoPuts: { codeId: number; body: Record<string, unknown> }[];

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
      return dispositions.map((d) => ({ ...d }));
    case `POST ${CAMPAIGN_URL}/dispositions`: {
      const body = JSON.parse(JSON.stringify(config.data ?? null)) as Record<string, unknown>;
      dispoPosts.push(body);
      return { id: 99, isActive: true, sortOrder: 9, ...body };
    }
    case `GET ${CAMPAIGN_URL}/contact-lists`:
    case `GET ${CAMPAIGN_URL}/callbacks`:
      return [];
    case 'GET /api/v1/admin/queues':
      return queueList;
    default: {
      const put = /^PUT \/api\/v1\/admin\/campaigns\/11\/dispositions\/(\d+)$/.exec(route);
      if (put) {
        const body = JSON.parse(JSON.stringify(config.data ?? null)) as Record<string, unknown>;
        dispoPuts.push({ codeId: Number(put[1]), body });
        return dispositions.find((d) => d.id === Number(put[1]));
      }
      throw new Error(`unexpected ${route}`);
    }
  }
}

beforeEach(() => {
  puts = [];
  dispositions = [];
  dispoPosts = [];
  dispoPuts = [];
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

describe.each(TEST_LOCALES)('CampaignDetailPage target abandon rate in %s', (lng) => {
  it('CampaignDetailPage_ShouldShowTheRateAsAPercentage_WhenTheDetailCarries0Point03', async () => {
    seed({});
    await renderPage(lng);

    const label = screen.getByText(ADMIN_LOCALES[lng].campaigns.detail.target_abandon_rate);
    const shown = label.nextElementSibling?.textContent;
    const percent = new Intl.NumberFormat(lng, { style: 'percent', maximumFractionDigits: 1 });
    expect.soft(detailFixture.targetAbandonRate, 'the fixture rate').toBe(0.03);
    expect.soft(shown).toBe(percent.format(0.03));
    if (lng === 'en-US') expect.soft(shown).toBe('3%');
  });
});

/**
 * The disposition dialog's do-not-call switch and categories (spec `campaign-console`, design D4;
 * host D6). The fake answers `GET …/dispositions` with the host's target fixture (`addsToDnc`, the
 * category as the enum name) and records every create and update body as JSON on the wire.
 */
describe('CampaignDetailPage disposition dialog', () => {
  const d = en.dispositions as typeof en.dispositions & Record<string, string>;
  /** Campaign 11's codes: `DNC` (target fixture, Failure, adds to DNC) and `SALE` (Success, does not). */
  const DNC = dispoTarget;
  const SALE = {
    ...dispoTarget,
    id: 7,
    code: 'SALE',
    label: 'Sale made',
    category: 'Success',
    isSuccess: true,
    addsToDnc: false,
    sortOrder: 1,
  };
  const SYSTEM = {
    ...dispoTarget,
    id: 8,
    code: 'SYS',
    label: 'Machine',
    category: 'SystemResult',
    addsToDnc: false,
  };

  const jsonType = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

  /** Every member of `body` is one `contract` names, with its JSON type, or `null` where `nullable`. */
  function expectMembersOf(
    body: Record<string, unknown>,
    contract: Record<string, unknown>,
    nullable: boolean,
  ) {
    for (const [member, value] of Object.entries(body)) {
      expect.soft(Object.keys(contract), `member ${member}`).toContain(member);
      const types = [jsonType(contract[member])];
      if (member === 'retryDelayMinutes') types.push('number');
      if (nullable || member === 'retryDelayMinutes') types.push('null');
      if (nullable && contract[member] === null) types.push('boolean', 'string', 'number');
      expect.soft(types, `JSON type of ${member}`).toContain(jsonType(value));
    }
  }

  async function renderWith(codes: Record<string, unknown>[]) {
    seed({});
    dispositions = codes;
    await renderPage();
    for (const code of codes) await screen.findByTestId(`disposition-row-${String(code.id)}`);
  }

  function dialog() {
    return screen.getByRole('dialog');
  }

  async function openEditor(id: unknown) {
    const row = screen.getByTestId(`disposition-row-${String(id)}`);
    fireEvent.click(within(row).getByRole('button', { name: d.row_edit }));
    await screen.findByRole('dialog');
  }

  async function openNew() {
    fireEvent.click(screen.getByRole('button', { name: d.add_btn }));
    await screen.findByRole('dialog');
  }

  const dncSwitch = () => within(dialog()).getByTestId('disposition-dnc-switch');
  const isOn = (el: HTMLElement) => el.getAttribute('aria-checked') === 'true';
  const labelInput = () => within(dialog()).getByLabelText(d.field_label) as HTMLInputElement;
  const categoryShown = () =>
    within(dialog()).getByTestId('disposition-category').querySelector('[data-slot="select-value"]')
      ?.textContent;

  async function categoryOptions() {
    fireEvent.click(within(dialog()).getByTestId('disposition-category'));
    const options = await screen.findAllByRole('option');
    return options;
  }

  async function chooseCategory(label: string) {
    const options = await categoryOptions();
    const option = options.find((o) => o.textContent === label);
    expect(option, `the ${label} option`).toBeDefined();
    fireEvent.pointerDown(option!);
    fireEvent.click(option!);
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
  }

  function save(label: string) {
    fireEvent.click(within(dialog()).getByRole('button', { name: label }));
  }

  function cancel() {
    fireEvent.click(within(dialog()).getByRole('button', { name: d.dialog_cancel }));
  }

  it('CampaignDetailPage_ShouldSendTheCreateFixture_WhenANewCodeMarkedDoNotCallIsAdded', async () => {
    await renderWith([]);
    await openNew();

    fireEvent.change(within(dialog()).getByLabelText(d.field_code), { target: { value: 'DNC' } });
    fireEvent.change(labelInput(), { target: { value: 'Do not call again' } });
    await chooseCategory(d.cat_failure);
    fireEvent.click(dncSwitch());
    save(d.dialog_add);

    await waitFor(() => expect(dispoPosts).toHaveLength(1));
    expectMembersOf(dispoPosts[0]!, dispoCreateRequest, false);
    expect(dispoPosts[0]).toEqual(dispoCreateRequest);
  });

  it('CampaignDetailPage_ShouldSayWhatTheSwitchDoes_WhenTheDialogOpens', async () => {
    await renderWith([]);
    await openNew();

    expect.soft(d.field_adds_to_dnc_help, 'the help text exists').toEqual(expect.any(String));
    expect.soft(within(dialog()).getByText(d.field_adds_to_dnc_help ?? '-')).toBeInTheDocument();
  });

  it('CampaignDetailPage_ShouldPreselectTheDoNotCallSwitch_WhenAnExistingCodeWithAddsToDncIsEdited', async () => {
    await renderWith([DNC]);
    await openEditor(DNC.id);

    expect(isOn(dncSwitch())).toBe(true);
  });

  it('CampaignDetailPage_ShouldSendAddsToDncTrueAndNoCode_WhenOnlyTheLabelOfSuchACodeIsChanged', async () => {
    await renderWith([DNC]);
    await openEditor(DNC.id);

    fireEvent.change(labelInput(), { target: { value: 'Never call again' } });
    save(d.dialog_update);

    await waitFor(() => expect(dispoPuts).toHaveLength(1));
    const { codeId, body } = dispoPuts[0]!;
    expect.soft(codeId).toBe(DNC.id);
    expect.soft(body).not.toHaveProperty('code');
    expect.soft(body.addsToDnc).toBe(true);
    expect.soft(body.label).toBe('Never call again');
    expect.soft(body.isSuccess).toBeNull();
    expectMembersOf(body, dispoUpdateRequest, true);
  });

  it('CampaignDetailPage_ShouldSendTheDerivedIsSuccess_WhenTheCategoryOfAnExistingCodeIsChanged', async () => {
    await renderWith([DNC]);
    await openEditor(DNC.id);

    await chooseCategory(d.cat_success);
    save(d.dialog_update);

    await waitFor(() => expect(dispoPuts).toHaveLength(1));
    expect.soft(dispoPuts[0]!.body.category).toBe('success');
    expect.soft(dispoPuts[0]!.body.isSuccess).toBe(true);
  });

  it('CampaignDetailPage_ShouldShowTheSecondCodesValues_WhenTheEditDialogIsReopenedForAnotherCode', async () => {
    await renderWith([SALE, DNC]);
    await openEditor(DNC.id);
    expect(isOn(dncSwitch())).toBe(true);
    cancel();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await openEditor(SALE.id);

    expect.soft(labelInput().value).toBe(SALE.label);
    expect.soft(isOn(dncSwitch())).toBe(false);
  });

  it('CampaignDetailPage_ShouldShowTheStoredValues_WhenTheEditDialogIsReopenedAfterACancel', async () => {
    await renderWith([DNC]);
    await openEditor(DNC.id);
    fireEvent.change(labelInput(), { target: { value: 'Typed then cancelled' } });
    fireEvent.click(dncSwitch());
    cancel();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await openEditor(DNC.id);

    expect.soft(labelInput().value).toBe(DNC.label);
    expect.soft(isOn(dncSwitch())).toBe(true);
  });

  it.each([
    ['Success', true],
    ['Failure', false],
  ] as const)(
    'CampaignDetailPage_ShouldSendIsSuccessFromTheCategory_WhenACodeOfThe_%s_CategoryIsCreated',
    async (category, isSuccess) => {
      await renderWith([]);
      await openNew();

      fireEvent.change(within(dialog()).getByLabelText(d.field_code), { target: { value: 'X1' } });
      fireEvent.change(labelInput(), { target: { value: 'An outcome' } });
      await chooseCategory(category === 'Success' ? d.cat_success : d.cat_failure);
      save(d.dialog_add);

      await waitFor(() => expect(dispoPosts).toHaveLength(1));
      expect.soft(dispoPosts[0]!.category).toBe(category.toLowerCase());
      expect.soft(dispoPosts[0]!.isSuccess).toBe(isSuccess);
      expect.soft(dispoPosts[0]!.addsToDnc).toBe(false);
    },
  );

  it('CampaignDetailPage_ShouldPreselectTheStoredCategory_WhenAnExistingCodeIsEdited', async () => {
    await renderWith([DNC]);
    await openEditor(DNC.id);

    expect(categoryShown()).toBe(d.cat_failure);
  });

  it('CampaignDetailPage_ShouldOfferExactlyTheFourPlatformCategories_WhenTheDialogOpens', async () => {
    await renderWith([]);
    await openNew();

    const options = await categoryOptions();

    expect(options.map((o) => o.textContent)).toEqual([
      d.cat_success,
      d.cat_failure,
      d.cat_retry ?? 'cat_retry',
      d.cat_system_result ?? 'cat_system_result',
    ]);
  });

  it('CampaignDetailPage_ShouldSendIsSuccessNull_WhenTheStoredCategoryIsRepicked', async () => {
    await renderWith([SYSTEM]);
    await openEditor(SYSTEM.id);

    await chooseCategory(d.cat_system_result ?? 'cat_system_result');
    fireEvent.change(labelInput(), { target: { value: 'Answering machine' } });
    save(d.dialog_update);

    await waitFor(() => expect(dispoPuts).toHaveLength(1));
    expect.soft(dispoPuts[0]!.body.category).toBe('systemresult');
    expect.soft(dispoPuts[0]!.body.isSuccess).toBeNull();
  });

  it('CampaignDetailPage_ShouldSendRetryAndIsSuccessFalse_WhenTheRetryOptionIsChosen', async () => {
    await renderWith([SYSTEM]);
    await openEditor(SYSTEM.id);

    await chooseCategory(d.cat_retry ?? 'cat_retry');
    save(d.dialog_update);

    await waitFor(() => expect(dispoPuts).toHaveLength(1));
    expect.soft(dispoPuts[0]!.body.category).toBe('retry');
    expect.soft(dispoPuts[0]!.body.isSuccess).toBe(false);
  });

  it('CampaignDetailPage_ShouldMarkOnlyTheDoNotCallCodes_WhenTheListHasOldAndNewShapes', async () => {
    await renderWith([dispoCurrent, DNC, SALE]);

    const marked = (id: unknown) =>
      isOn(
        within(screen.getByTestId(`disposition-row-${String(id)}`)).getByTestId(
          'disposition-row-dnc',
        ),
      );
    expect.soft(marked(DNC.id), 'DNC is marked').toBe(true);
    expect.soft(marked(SALE.id), 'SALE is not').toBe(false);
    expect.soft(marked(dispoCurrent.id), 'a code without addsToDnc is not').toBe(false);
  });

  it('CampaignDetailPage_ShouldShowTheSwitchOff_WhenACodeWithoutAddsToDncIsEdited', async () => {
    await renderWith([dispoCurrent]);
    await openEditor(dispoCurrent.id);

    expect.soft(isOn(dncSwitch())).toBe(false);
    expect
      .soft(categoryShown(), 'the stored Retry is preselected')
      .toBe(d.cat_retry ?? 'cat_retry');
  });

  it('CampaignDetailPage_ShouldShowTheCategoryLabel_WhenTheListRendersACode', async () => {
    await renderWith([DNC]);

    const row = screen.getByTestId(`disposition-row-${String(DNC.id)}`);
    expect(within(row).getByTestId('disposition-row-category')).toHaveTextContent(d.cat_failure);
  });
});
