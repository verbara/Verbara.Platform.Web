/**
 * The campaign wizard's create body and its validation paths (spec `campaign-console`, design D1, D2,
 * D5, D7), rendered with the real wizard, steps, query hooks and a real i18next instance loaded with
 * the committed locale files. Only `customFetch` is stubbed. It plays Platform as the host change's
 * fixtures record it (`tests/fixtures/contracts/`): the queue and team lists, and the 201
 * `CampaignSummaryDto` of a create. Every assertion on the body reads it as it goes on the wire
 * (`JSON.stringify`, as `customFetch` serializes it), so an `undefined` member is absent.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import { ADMIN_LOCALES, createLocaleI18n } from '@/test/locale-i18n';
import CampaignWizard from './campaign-wizard';

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

const createRequest = fixture('campaign-create.request.json');
const createdResponse = fixture('campaign-created.response.json');
const queueList = fixture('queue-list.response.json');
const teamList = fixture('team-list.response.json');

const en = ADMIN_LOCALES['en-US'].campaigns;

/** Selections no campaign DTO carries (design Non-Goals); chosen so their absence from the body means something. */
const DNC_LIST = {
  id: 5,
  name: 'Main DNC',
  scope: 'tenant',
  entryCount: 3,
  createdAt: '2026-09-01T00:00:00Z',
};
const CALLER_ID_POOL = { id: 4, name: 'Pool A' };
const HOLIDAY_CALENDAR = { id: 6, name: 'CO holidays' };

const FORBIDDEN_MEMBERS = ['queueId', 'status', 'holidayCalendarId', 'callerIdPoolId', 'dncListId'];

/** Every `POST /api/v1/admin/campaigns` body the wizard sent, as JSON on the wire. */
let posts: Record<string, unknown>[];

function answer(config: Parameters<typeof client.customFetch>[0]): unknown {
  const route = `${config.method} ${config.url}`;
  switch (route) {
    case 'GET /api/v1/admin/queues':
      return queueList;
    case 'GET /api/v1/admin/teams':
      return teamList;
    case 'GET /api/v1/admin/dnc-lists':
      return [DNC_LIST];
    case 'GET /api/v1/admin/caller-id-pools':
      return [CALLER_ID_POOL];
    case 'GET /api/v1/admin/holiday-calendars':
      return [HOLIDAY_CALENDAR];
    case 'GET /api/v1/admin/dialer/settings':
      return {
        maxGlobalChannels: 100,
        defaultRingTimeoutSeconds: 30,
        campaignPollIntervalSeconds: 5,
        maxConcurrentCampaigns: 10,
        blendModeEnabled: false,
        jitterMinMs: 0,
        jitterMaxMs: 0,
        ahtCacheDurationSeconds: 60,
        scheduledCallbackPollSeconds: 30,
      };
    case 'POST /api/v1/admin/campaigns':
      posts.push(JSON.parse(JSON.stringify(config.data ?? null)) as Record<string, unknown>);
      return createdResponse;
    case 'POST /api/v1/admin/campaigns/11/start':
      return undefined;
    default:
      throw new Error(`unexpected ${route}`);
  }
}

beforeEach(() => {
  posts = [];
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => answer(config));
});

function DetailMarker() {
  const { campaignId } = useParams<{ campaignId: string }>();
  return <div data-testid="detail-marker">{campaignId}</div>;
}

async function renderWizard() {
  const i18n = await createLocaleI18n('en-US');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/campaigns/new']}>
          <Routes>
            <Route path="/admin/campaigns/new" element={<CampaignWizard />} />
            <Route path="/admin/campaigns/:campaignId" element={<DetailMarker />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  // The basic step is up once its queue list has loaded.
  await screen.findByRole('option', { name: 'sales' });
}

const queueSelect = () =>
  screen.getByLabelText(new RegExp(`^${en.basic_step.queue}`)) as HTMLSelectElement;
const onBasicStep = () => screen.queryByLabelText(new RegExp(`^${en.basic_step.name}`)) !== null;

function clickNext() {
  fireEvent.click(screen.getByRole('button', { name: en.next }));
}

function clickHeader(step: 'basic' | 'dialing' | 'schedule' | 'compliance' | 'contacts') {
  fireEvent.click(screen.getByRole('button', { name: en[`step_${step}`] }));
}

function clickSaveDraft() {
  fireEvent.click(screen.getByRole('button', { name: en.saveDraft }));
}

/**
 * Opens a base-ui select (the only one on the step) and clicks the option of `choice`, the press
 * starting on the option; the trigger then holds the choice's id (the select has no `items` map).
 */
async function chooseInStepSelect(choice: { id: number; name: string }) {
  const optionName = choice.name;
  const triggers = document.querySelectorAll('[data-slot="select-trigger"]');
  expect(triggers).toHaveLength(1);
  fireEvent.click(triggers[0]!);
  const name = new RegExp(`^${optionName}`);
  const option = await screen.findByRole('option', { name });
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option', { name })).toHaveLength(0));
  expect(triggers[0]!.querySelector('[data-slot="select-value"]')).toHaveTextContent(
    String(choice.id),
  );
}

function fillBasic({ queue }: { queue: boolean }) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${en.basic_step.name}`)), {
    target: { value: 'Q4 renewals' },
  });
  if (queue) {
    const select = queueSelect();
    const sales = within(select).getByRole('option', { name: 'sales' }) as HTMLOptionElement;
    fireEvent.change(select, { target: { value: sales.value } });
  }
  const team = screen.getByLabelText(new RegExp(`^${en.basic_step.team}`)) as HTMLSelectElement;
  const outbound = within(team).getByRole('option', { name: 'Outbound' }) as HTMLOptionElement;
  fireEvent.change(team, { target: { value: outbound.value } });
}

/** Fills every step (name, queue "sales", team "Outbound", a start date, the three selections) and ends on contacts. */
async function fillEveryStep() {
  fillBasic({ queue: true });
  clickNext();
  // Dialing: defaults, plus a caller-id pool.
  await screen.findByText(en.dialing_step.mode_label);
  await chooseInStepSelect(CALLER_ID_POOL);
  clickNext();
  // Schedule: a timezone, a start date and a holiday calendar.
  const start = await screen.findByLabelText(new RegExp(`^${en.schedule_step.start_date}`));
  fireEvent.change(screen.getByLabelText(new RegExp(`^${en.schedule_step.timezone}`)), {
    target: { value: 'America/Bogota' },
  });
  fireEvent.change(start, { target: { value: '2026-11-02' } });
  await chooseInStepSelect(HOLIDAY_CALENDAR);
  clickNext();
  // Compliance: defaults, plus a DNC list.
  await screen.findByText(en.compliance_step.dnc_list);
  await chooseInStepSelect(DNC_LIST);
  clickNext();
  await screen.findByText(en.contacts_step.upload_label);
}

type SaveStep = 'basic' | 'schedule' | 'contacts';

/** Renders the wizard, fills every step, goes back to `step` and saves the draft; returns the POSTs sent. */
async function saveDraftFrom(step: SaveStep) {
  await renderWizard();
  await fillEveryStep();
  if (step !== 'contacts') {
    clickHeader(step);
    if (step === 'basic') await waitFor(() => expect(onBasicStep()).toBe(true));
    else await screen.findByLabelText(new RegExp(`^${en.schedule_step.start_date}`));
  }
  clickSaveDraft();
  await waitFor(() => expect(posts.length).toBeGreaterThan(0), { timeout: 2000 }).catch(() => {});
  return posts;
}

const jsonType = (v: unknown) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

/** Members whose fixture value is `null` but whose JSON type (spec) is a number. */
const NULL_IN_FIXTURE: Record<string, string> = {
  powerRatio: 'number',
  targetAbandonRate: 'number',
};
/** Members the spec types as nullable. */
const NULLABLE = new Set([
  'description',
  'teamId',
  'powerRatio',
  'targetAbandonRate',
  'campaignStart',
  'campaignEnd',
  'complianceNotes',
]);

function allowedTypes(member: string): string[] {
  const fromFixture = jsonType(createRequest[member]);
  const base = fromFixture === 'null' ? (NULL_IN_FIXTURE[member] ?? 'null') : fromFixture;
  return NULLABLE.has(member) ? [base, 'null'] : [base];
}

describe('CampaignWizard create body', () => {
  it.each<SaveStep>(['basic', 'schedule', 'contacts'])(
    'CampaignWizard_ShouldSendTheCreateRequestMembersOnly_WhenTheDraftIsSavedFromThe_%s_Step',
    async (step) => {
      const sent = await saveDraftFrom(step);

      expect(sent, 'a POST is sent').toHaveLength(1);
      const body = sent[0]!;
      expect.soft(body.targetQueueName).toBe('sales');
      expect.soft(body.teamId).toBe('7');
      for (const member of FORBIDDEN_MEMBERS) expect.soft(body, member).not.toHaveProperty(member);
      for (const [member, value] of Object.entries(body)) {
        expect.soft(Object.keys(createRequest), `member ${member}`).toContain(member);
        if (member in createRequest) {
          expect.soft(allowedTypes(member), `JSON type of ${member}`).toContain(jsonType(value));
        }
      }
      expect.soft(Array.isArray(body.schedule), 'schedule is an array').toBe(true);
      for (const day of Array.isArray(body.schedule) ? (body.schedule as unknown[]) : []) {
        expect.soft(day).toEqual({
          day: expect.any(String),
          enabled: expect.any(Boolean),
          start: expect.any(String),
          end: expect.any(String),
        });
      }
      expect.soft(body.holidays).toEqual([]);
      expect.soft(body.dncEnabled).toBe(true);
      expect.soft(body.maxConcurrentCalls).toBe(10);
      expect.soft(body.maxAttemptsPerContact).toBe(3);
      expect.soft(body.retryIntervalMinutes).toBe(60);
      expect.soft(body.timeBetweenAttemptsMinutes).toBe(30);
      expect.soft(body.mode).toBe('preview');
      expect.soft(body.timezone).toBe('America/Bogota');
    },
  );

  it('CampaignWizard_ShouldSendTheSameBody_WhenTheDraftIsSavedFromTheBasicScheduleOrContactsStep', async () => {
    const bodies: Record<string, unknown>[] = [];
    for (const step of ['basic', 'schedule', 'contacts'] as const) {
      posts = [];
      const sent = await saveDraftFrom(step);
      expect(sent, `a POST is sent from ${step}`).toHaveLength(1);
      bodies.push(sent[0]!);
      cleanup();
    }

    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2]).toEqual(bodies[0]);
  });
});

describe('CampaignWizard without a queue', () => {
  async function renderWithNameOnly() {
    await renderWizard();
    fillBasic({ queue: false });
  }

  async function expectRefusedOnBasicStep() {
    const message = () => screen.queryByTestId('campaign-wizard-queue-error');
    await waitFor(() => expect(message()).not.toBeNull()).catch(() => {});
    expect.soft(onBasicStep(), 'still on the basic step').toBe(true);
    expect
      .soft(message()?.textContent, 'the required-queue message')
      .toBe(en.validation.queueRequired);
    expect.soft(posts, 'no POST is sent').toHaveLength(0);
  }

  it('CampaignWizard_ShouldStayOnTheBasicStep_WhenNextIsPressedWithoutAQueue', async () => {
    await renderWithNameOnly();

    clickNext();

    await expectRefusedOnBasicStep();
  });

  it('CampaignWizard_ShouldStayOnTheBasicStep_WhenTheContactsHeaderIsChosenWithoutAQueue', async () => {
    await renderWithNameOnly();

    clickHeader('contacts');

    await expectRefusedOnBasicStep();
  });

  it('CampaignWizard_ShouldStayOnTheBasicStep_WhenTheDraftIsSavedWithoutAQueue', async () => {
    await renderWithNameOnly();

    clickSaveDraft();

    await expectRefusedOnBasicStep();
  });
});

describe('CampaignWizard schedule step', () => {
  it('CampaignWizard_ShouldStayOnTheScheduleStep_WhenNextIsPressedWithoutAStartDate', async () => {
    await renderWizard();
    fillBasic({ queue: true });
    clickNext();
    await screen.findByText(en.dialing_step.mode_label);
    clickNext();
    await screen.findByLabelText(new RegExp(`^${en.schedule_step.start_date}`));

    clickNext();

    await waitFor(() =>
      expect(screen.queryByText(en.validation.startDateRequired)).not.toBeNull(),
    ).catch(() => {});
    expect
      .soft(
        screen.queryByLabelText(new RegExp(`^${en.schedule_step.start_date}`)),
        'still on the schedule step',
      )
      .not.toBeNull();
    expect
      .soft(screen.queryByText(en.validation.startDateRequired), 'the start-date message')
      .not.toBeNull();
  });
});

describe('CampaignWizard create response', () => {
  it('CampaignWizard_ShouldOpenTheCreatedCampaign_WhenPlatformAnswers201WithASummary', async () => {
    const sent = await saveDraftFrom('contacts');

    expect(sent).toHaveLength(1);
    expect(await screen.findByTestId('detail-marker')).toHaveTextContent('11');
  });
});
