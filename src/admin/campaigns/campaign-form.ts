/**
 * The campaign wizard's form: its values, the whole-form schema that validates every move and every
 * submission, each step's validated fields, and the create body built from the whole form (design D1,
 * D2, D7 of dialer-places-calls-end-to-end). Kept apart from `campaign-wizard.tsx`, which exports the
 * component only.
 */
import { z } from 'zod';
import type { ContactImportRow, CreateCampaignBody } from '@/core/api/hooks/use-campaigns';

export const STEP_KEYS = ['basic', 'dialing', 'schedule', 'compliance', 'contacts'] as const;

/** The predictive target abandon rate the dialing step asks for, in percent (design D3; Web #461). */
export const ABANDON_RATE_PERCENT_DEFAULT = 3;
export const ABANDON_RATE_PERCENT_MIN = 0.1;
export const ABANDON_RATE_PERCENT_MAX = 10;
export type StepKey = (typeof STEP_KEYS)[number];

/**
 * One schema for the whole form (design D7), under the names the steps register. It validates every
 * forward move (over the fields of {@link STEP_FIELDS} up to the target) and every submission, so a
 * missing queue is caught on every path, whichever step the administrator is on.
 */
export const campaignFormSchema = z
  .object({
    name: z.string().min(2, 'admin:campaigns.validation.nameMinLength'),
    targetQueueName: z.string().min(1, 'admin:campaigns.validation.queueRequired'),
    mode: z.string().min(1, 'admin:campaigns.validation.dialingModeRequired'),
    maxChannels: z.coerce.number().int().positive('admin:campaigns.validation.maxChannelsPositive'),
    // An emptied number input arrives as `NaN` (`valueAsNumber`); it is accepted here and refused
    // below only for a predictive campaign, so it never holds a draft of another mode (design D3).
    targetAbandonRatePercent: z.number().or(z.nan()),
    timezone: z.string().min(1, 'admin:campaigns.validation.timezoneRequired'),
    campaignStart: z.string().min(1, 'admin:campaigns.validation.startDateRequired'),
  })
  .superRefine(
    (values, ctx) => {
      if (values.mode !== 'predictive') return;
      const percent = values.targetAbandonRatePercent;
      if (
        !Number.isFinite(percent) ||
        percent < ABANDON_RATE_PERCENT_MIN ||
        percent > ABANDON_RATE_PERCENT_MAX
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['targetAbandonRatePercent'],
          message: 'admin:campaigns.validation.abandonRateRange',
        });
      }
    },
    // Runs whatever else failed (a missing start date, say), so a forward move or a save always
    // sees the rate.
    { when: () => true },
  );

export type DialingMode = 'preview' | 'progressive' | 'predictive' | 'power' | 'agentless';
export type PacingStrategy = 'fixed' | 'adaptive' | 'timeBased';

export interface ScheduleDay {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
}

export interface CampaignFormValues {
  // Basic
  name: string;
  description: string;
  /** The chosen queue's `name`, sent as `targetQueueName` (design D1). */
  targetQueueName: string;
  /** The chosen team's id (a string, as the team list returns it), or `''` for none. */
  teamId: string;
  // Dialing
  mode: DialingMode;
  pacingStrategy: PacingStrategy;
  pacingRatio: number;
  /**
   * The predictive target abandon rate in percent (3 is 3 %), sent as the rate `targetAbandonRate`
   * (percent / 100). Asked for and validated only when `mode` is predictive.
   */
  targetAbandonRatePercent: number;
  maxChannels: number;
  callerIdPoolId: number | null;
  useGlobalDefaults: boolean;
  // Schedule
  schedule: ScheduleDay[];
  timezone: string;
  holidays: string[];
  holidayCalendarId: number | null;
  campaignStart: string;
  campaignEnd: string;
  // Compliance
  dncListId: number | null;
  maxAttempts: number;
  retryIntervalMinutes: number;
  timeBetweenAttempts: number;
  complianceNotes: string;
  // Contacts
  contactFile: string;
  columnMapping: Record<string, string>;
  // Parsed contact rows (populated by contacts step)
  parsedContacts: ContactImportRow[];
}

/** A field the whole-form schema validates. */
export type ValidatedField = keyof z.infer<typeof campaignFormSchema>;

/** Each step's validated fields, in the order the steps appear (design D7). */
export const STEP_FIELDS: Record<StepKey, readonly ValidatedField[]> = {
  basic: ['name', 'targetQueueName'],
  dialing: ['mode', 'maxChannels', 'targetAbandonRatePercent'],
  schedule: ['timezone', 'campaignStart'],
  compliance: [],
  contacts: [],
};

/** The index of the first step (in {@link STEP_KEYS} order) holding an error, or `undefined`. */
export function firstStepWithError(hasError: (field: ValidatedField) => boolean) {
  const index = STEP_KEYS.findIndex((key) => STEP_FIELDS[key].some(hasError));
  return index === -1 ? undefined : index;
}

/**
 * The `POST /api/v1/admin/campaigns` body, from the whole form (design D2). An object literal typed
 * `CreateCampaignBody`, so the excess-property check rejects a member `CreateCampaignRequest` lacks
 * (`queueId`, `status`, the DNC list, caller-id pool and holiday calendar ids) and a numeric
 * `teamId`. `dncEnabled` is always `true`: absent, Platform binds `false` and turns the global DNC
 * check off.
 */
export function buildCreateCampaignBody(values: CampaignFormValues): CreateCampaignBody {
  return {
    name: values.name,
    description: values.description || undefined,
    mode: values.mode,
    targetQueueName: values.targetQueueName,
    teamId: values.teamId || undefined,
    maxConcurrentCalls: values.maxChannels,
    powerRatio: values.mode === 'power' ? values.pacingRatio : undefined,
    targetAbandonRate:
      values.mode === 'predictive' ? toAbandonRate(values.targetAbandonRatePercent) : undefined,
    timezone: values.timezone,
    campaignStart: values.campaignStart || undefined,
    campaignEnd: values.campaignEnd || undefined,
    schedule: values.schedule.map(({ day, enabled, start, end }) => ({ day, enabled, start, end })),
    holidays: [...values.holidays],
    dncEnabled: true,
    maxAttemptsPerContact: values.maxAttempts,
    retryIntervalMinutes: values.retryIntervalMinutes,
    timeBetweenAttemptsMinutes: values.timeBetweenAttempts,
    complianceNotes: values.complianceNotes || undefined,
  };
}

/** A percent as the rate `targetAbandonRate` carries (3 → 0.03), rounded to 4 decimals against float noise. */
export function toAbandonRate(percent: number): number {
  return Math.round(percent * 100) / 10_000;
}
