import type { TFunction } from 'i18next';
import { isApiError, type ApiErrorEntry, type ApiErrorMap } from './api-error';
import { toastApiError } from './toast-api-error';

/**
 * The host's partner-channel refusals (Verbara.Platform change `partner-channel-pilot-fixes`,
 * design D3 here). Each is identified by the machine code in the body's `error`, read by
 * {@link ApiError} into `err.code` (ADR-0013); the values a message names come from `err.facts`.
 */
export type PartnerChannelCode =
  'plan-exceeds-parent' | 'dunning-partner-customer' | 'currency-invalid' | 'currency-mismatch';

const ENTRIES: Readonly<Record<PartnerChannelCode, ApiErrorEntry>> = {
  'plan-exceeds-parent': {
    code: 'plan-exceeds-parent',
    key: 'common:errors.partner_channel.plan_exceeds_parent',
  },
  'dunning-partner-customer': {
    code: 'dunning-partner-customer',
    key: 'common:errors.partner_channel.dunning_partner_customer',
  },
  'currency-invalid': {
    code: 'currency-invalid',
    key: 'common:errors.partner_channel.currency_invalid',
  },
  'currency-mismatch': {
    code: 'currency-mismatch',
    key: 'common:errors.partner_channel.currency_mismatch',
  },
};

/** `currency-invalid` with a null `currency`: the stored card has no currency at all. */
const CURRENCY_MISSING: ApiErrorEntry = {
  code: 'currency-invalid',
  key: 'common:errors.partner_channel.currency_missing',
};

const PLAN_NAMES = new Set(['Starter', 'Pro', 'Enterprise']);

/** A plan's localized label, or the plan as received when it has none. */
function planLabel(plan: unknown, t: TFunction): string {
  const name = typeof plan === 'string' ? plan : '';
  return PLAN_NAMES.has(name) ? String(t(`common:errors.partner_channel.plans.${name}`)) : name;
}

/**
 * The values the message names, taken from the refusal's facts only. Plans pass through their
 * localized labels; currency codes and ids are shown as received.
 */
function valuesOf(
  code: PartnerChannelCode,
  facts: Readonly<Record<string, unknown>>,
  t: TFunction,
): Record<string, unknown> {
  switch (code) {
    case 'plan-exceeds-parent':
      return {
        requestedPlan: planLabel(facts.requestedPlan, t),
        parentPlan: planLabel(facts.parentPlan, t),
      };
    case 'currency-invalid':
      return { currency: facts.currency };
    case 'currency-mismatch':
      return { partnerCurrency: facts.partnerCurrency, hostCurrency: facts.hostCurrency };
    case 'dunning-partner-customer':
      return { partnerTenantId: facts.partnerTenantId };
  }
}

/** The partner-channel code of `err` when it is one of `codes`, else `null`. */
export function partnerChannelCodeOf(
  err: unknown,
  codes: readonly PartnerChannelCode[],
): PartnerChannelCode | null {
  if (!isApiError(err) || err.code === null) return null;
  return (codes as readonly string[]).includes(err.code) ? (err.code as PartnerChannelCode) : null;
}

/**
 * Shows `err` as a localized error toast (`data-error-code` = the machine code) when it is one of
 * the partner-channel refusals in `codes`, and returns `true`. Returns `false` for anything else,
 * so the caller keeps its current handling of every other refusal. The raw `error` is never shown.
 */
export function toastPartnerChannelRefusal(
  err: unknown,
  codes: readonly PartnerChannelCode[],
  t: TFunction,
): boolean {
  const code = partnerChannelCodeOf(err, codes);
  if (code === null || !isApiError(err)) return false;
  const entry =
    code === 'currency-invalid' && err.facts.currency === null ? CURRENCY_MISSING : ENTRIES[code];
  const map: ApiErrorMap = { codes: { [code]: entry }, fallback: entry };
  toastApiError(err, map, t, { values: valuesOf(code, err.facts, t) });
  return true;
}

/** Every entry the refusals can produce, for tests that check each key exists in every locale. */
export const PARTNER_CHANNEL_ENTRIES: readonly ApiErrorEntry[] = [
  ...Object.values(ENTRIES),
  CURRENCY_MISSING,
];
