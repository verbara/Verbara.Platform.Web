import type { components } from '@/core/api/generated/openapi';

/**
 * A user's account status as Platform's `UserStatus` enum names it (`Active` | `Suspended` |
 * `Deactivated`). Writes send these names; a rename on the Platform side fails `npm run build`
 * here instead of shipping a 400.
 */
export type AccountStatus = NonNullable<components['schemas']['UserStatus']>;

/** The badge variants a status maps to (a subset of `Badge`'s). */
export type AccountStatusBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

interface AccountStatusMeta {
  /** Namespaced i18n key of the status label, valid with any `t`. */
  labelKey: string;
  badgeVariant: AccountStatusBadgeVariant;
}

/**
 * One entry per `UserStatus` member. Typed as a `Record`, so a status added to the contract fails
 * the build until it gets a label and a variant. Insertion order is the order the edit form offers.
 */
const STATUS_META: Record<AccountStatus, AccountStatusMeta> = {
  Active: { labelKey: 'admin:users.statuses.active', badgeVariant: 'default' },
  Suspended: { labelKey: 'admin:users.statuses.suspended', badgeVariant: 'secondary' },
  Deactivated: { labelKey: 'admin:users.statuses.deactivated', badgeVariant: 'destructive' },
};

/** Every account status, in the order the edit form offers them. */
export const ACCOUNT_STATUSES = Object.keys(STATUS_META) as readonly AccountStatus[];

/** The `data-status` value for a status the console does not know. */
export const UNKNOWN_DATA_STATUS = 'unknown';

/**
 * Reads a `UserDto.status` into an {@link AccountStatus}. Platform writes the read side as a
 * lower-case string (`Status.ToString().ToLowerInvariant()`) while the write side takes the enum
 * name, so the match is case-insensitive. Returns `undefined` for an empty or unknown value; the
 * caller then shows the raw value and never blocks on it.
 */
export function normalizeAccountStatus(raw: string | null | undefined): AccountStatus | undefined {
  if (!raw) return undefined;
  const wanted = raw.trim().toLowerCase();
  if (!wanted) return undefined;
  return ACCOUNT_STATUSES.find((status) => status.toLowerCase() === wanted);
}

/** The i18n key of a known status's label. */
export function accountStatusLabelKey(status: AccountStatus): string {
  return STATUS_META[status].labelKey;
}

/** The badge variant for a status; an unknown status gets the neutral `outline`. */
export function accountStatusBadgeVariant(
  status: AccountStatus | undefined,
): AccountStatusBadgeVariant {
  return status ? STATUS_META[status].badgeVariant : 'outline';
}

/**
 * The canonical lower-case `data-status` value (`active` | `suspended` | `deactivated`), identical
 * in every locale. An unknown status is exposed as {@link UNKNOWN_DATA_STATUS}.
 */
export function accountStatusDataAttribute(status: AccountStatus | undefined): string {
  return status ? status.toLowerCase() : UNKNOWN_DATA_STATUS;
}

/** Everything a status badge needs, derived from the raw `UserDto.status`. */
export interface AccountStatusView {
  /** The normalized status, or `undefined` when the value is unknown. */
  status: AccountStatus | undefined;
  /** The label's i18n key, or `undefined` when the raw value should be shown as reported. */
  labelKey: string | undefined;
  badgeVariant: AccountStatusBadgeVariant;
  dataStatus: string;
}

export function describeAccountStatus(raw: string | null | undefined): AccountStatusView {
  const status = normalizeAccountStatus(raw);
  return {
    status,
    labelKey: status ? accountStatusLabelKey(status) : undefined,
    badgeVariant: accountStatusBadgeVariant(status),
    dataStatus: accountStatusDataAttribute(status),
  };
}
