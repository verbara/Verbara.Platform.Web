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
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';
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

/**
 * A case that fills every step (five steps, three base-ui selects) takes about 1 s alone and the
 * same-body case, which does it three times, about 2 s; under the whole suite's parallel load the
 * same-body case passed the 5 s default. The budget is for that load, not for a slower wizard.
 */
const FILL_EVERY_STEP_TIMEOUT = { timeout: 20_000 };

describe('CampaignWizard create body', FILL_EVERY_STEP_TIMEOUT, () => {
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

describe('CampaignWizard create response', FILL_EVERY_STEP_TIMEOUT, () => {
  it('CampaignWizard_ShouldOpenTheCreatedCampaign_WhenPlatformAnswers201WithASummary', async () => {
    const sent = await saveDraftFrom('contacts');

    expect(sent).toHaveLength(1);
    expect(await screen.findByTestId('detail-marker')).toHaveTextContent('11');
  });
});

/**
 * The predictive target abandon rate (spec `campaign-console`, design D3; Web #461). The dialing step
 * asks for a percentage (default 3, 0.1–10) whatever the pacing strategy, and the body carries it as
 * the rate `targetAbandonRate` (percent / 100), the member `campaign-create.request.json` names
 * (`0.03`). Rendered in each locale, driven through the wizard's `data-testid`s and the locale's own
 * labels, so the field message is asserted where the administrator reads it.
 */
describe.each(TEST_LOCALES)('CampaignWizard target abandon rate in %s', (lng) => {
  const c = ADMIN_LOCALES[lng].campaigns as typeof en;
  const dialing = c.dialing_step as typeof en.dialing_step & Record<string, string>;
  const validation = c.validation as typeof en.validation & Record<string, string>;

  async function renderIn() {
    const i18n = await createLocaleI18n(lng);
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
    await screen.findByRole('option', { name: 'sales' });
  }

  function fillBasicIn() {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${c.basic_step.name}`)), {
      target: { value: 'Q4 renewals' },
    });
    const select = screen.getByLabelText(new RegExp(`^${c.basic_step.queue}`)) as HTMLSelectElement;
    const sales = within(select).getByRole('option', { name: 'sales' }) as HTMLOptionElement;
    fireEvent.change(select, { target: { value: sales.value } });
  }

  const next = () => fireEvent.click(screen.getByTestId('campaign-wizard-next'));
  const header = (step: string) =>
    fireEvent.click(screen.getByTestId(`campaign-wizard-step-${step}`));
  const saveDraft = () => fireEvent.click(screen.getByTestId('campaign-wizard-save-draft'));
  const onDialingStep = () => screen.queryByText(c.dialing_step.mode_label) !== null;
  const rateInput = () =>
    dialing.target_abandon_rate
      ? screen.queryByLabelText(new RegExp(`^${escapeRegExp(dialing.target_abandon_rate)}`))
      : null;
  const rateError = () => screen.queryByTestId('campaign-wizard-abandon-rate-error');

  function chooseRadio(label: string) {
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${escapeRegExp(label)}`) }));
  }

  function setRate(value: string) {
    const input = rateInput();
    expect(input, 'the target abandon rate field').not.toBeNull();
    fireEvent.change(input!, { target: { value } });
  }

  /** From the basic step to the dialing step, with mode `mode` chosen there. */
  async function toDialing(mode: 'predictive' | 'progressive') {
    await renderIn();
    fillBasicIn();
    next();
    await waitFor(() => expect(onDialingStep()).toBe(true));
    chooseRadio(c.dialing_step.modes[mode]);
  }

  /** From the dialing step to the schedule step, with a start date, then saves the draft there. */
  async function saveFromSchedule() {
    next();
    const start = await screen.findByLabelText(new RegExp(`^${c.schedule_step.start_date}`));
    fireEvent.change(start, { target: { value: '2026-11-02' } });
    saveDraft();
    await waitFor(() => expect(posts.length).toBeGreaterThan(0), { timeout: 2000 }).catch(() => {});
  }

  async function expectRefusedOnTheField() {
    await waitFor(() => expect(rateError()).not.toBeNull()).catch(() => {});
    expect.soft(onDialingStep(), 'the dialing step is shown').toBe(true);
    expect
      .soft(rateError()?.textContent, 'the localized range message')
      .toBe(validation.abandonRateRange ?? 'abandonRateRange');
    expect.soft(posts, 'no POST is sent').toHaveLength(0);
  }

  it('CampaignWizard_ShouldSendTheDefaultRateAs0Point03_WhenAPredictiveDraftIsSaved', async () => {
    await toDialing('predictive');
    await saveFromSchedule();

    expect(posts).toHaveLength(1);
    expect(posts[0]!.targetAbandonRate).toBe(0.03);
  });

  it('CampaignWizard_ShouldSendTheEnteredRate_WhenThePacingStrategyIsFixed', async () => {
    await toDialing('predictive');
    chooseRadio(c.dialing_step.pacings.fixed);
    setRate('2.5');
    expect(document.getElementById('pacingTargetWait'), 'no target wait input').toBeNull();
    await saveFromSchedule();

    expect(posts).toHaveLength(1);
    expect(posts[0]!.targetAbandonRate).toBe(0.025);
  });

  it('CampaignWizard_ShouldAskForTheRateAndNoTargetWait_WhenThePacingStrategyIsAdaptive', async () => {
    await toDialing('predictive');
    chooseRadio(c.dialing_step.pacings.adaptive);

    expect.soft(rateInput(), 'the rate is asked for').not.toBeNull();
    expect.soft(document.getElementById('pacingTargetWait'), 'no target wait input').toBeNull();
  });

  it('CampaignWizard_ShouldSendNoRate_WhenTheModeIsProgressive', async () => {
    await toDialing('progressive');
    expect.soft(rateInput(), 'no rate is asked for').toBeNull();
    await saveFromSchedule();

    expect(posts).toHaveLength(1);
    expect(posts[0]).not.toHaveProperty('targetAbandonRate');
  });

  it('CampaignWizard_ShouldRefuseToSaveAndShowTheFieldMessage_WhenThePredictiveAbandonRateIsBelowTheMinimum', async () => {
    await toDialing('predictive');
    setRate('0.05');
    saveDraft();

    await expectRefusedOnTheField();
  });

  it('CampaignWizard_ShouldRefuseToSaveAndShowTheFieldMessage_WhenThePredictiveAbandonRateIsAboveTheMaximum', async () => {
    await toDialing('predictive');
    setRate('10.1');
    saveDraft();

    await expectRefusedOnTheField();
  });

  it('CampaignWizard_ShouldRefuseToSaveAndShowTheFieldMessage_WhenThePredictiveAbandonRateIsEmpty', async () => {
    await toDialing('predictive');
    setRate('');
    saveDraft();

    await expectRefusedOnTheField();
  });

  it('CampaignWizard_ShouldRefuseToMoveOn_WhenNextIsPressedWithAnInvalidAbandonRate', async () => {
    await toDialing('predictive');
    setRate('0.05');
    next();

    await expectRefusedOnTheField();
  });

  // The contacts step cannot hold an invalid rate: every forward move validates the dialing step
  // (design D7 of dialer-places-calls-end-to-end). The earlier step a draft can be saved from with
  // one is the basic step, reached backwards from the dialing step without validating.
  it('CampaignWizard_ShouldShowTheDialingStep_WhenTheDraftIsSavedFromAnEarlierStepWithAnInvalidAbandonRate', async () => {
    await toDialing('predictive');
    setRate('0.05');
    header('basic');
    await waitFor(() => expect(onDialingStep()).toBe(false));
    saveDraft();

    await expectRefusedOnTheField();
  });

  it('CampaignWizard_ShouldAcceptTheBoundaryRates_WhenTheRateIs0Point1Or10', async () => {
    const sent: unknown[] = [];
    for (const [percent, rate] of [
      ['0.1', 0.001],
      ['10', 0.1],
    ] as const) {
      posts = [];
      await toDialing('predictive');
      setRate(percent);
      await saveFromSchedule();
      expect(posts, `a POST is sent for ${percent} %`).toHaveLength(1);
      sent.push(posts[0]!.targetAbandonRate);
      expect.soft(posts[0]!.targetAbandonRate).toBe(rate);
      cleanup();
    }
    expect(sent).toEqual([0.001, 0.1]);
  });

  it('CampaignWizard_ShouldIgnoreTheAbandonRate_WhenTheModeIsProgressive', async () => {
    await toDialing('predictive');
    setRate('0.05');
    chooseRadio(c.dialing_step.modes.progressive);
    await saveFromSchedule();

    expect(posts, 'the progressive draft is not held by the rate').toHaveLength(1);
    expect(posts[0]).not.toHaveProperty('targetAbandonRate');
  });
});

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
