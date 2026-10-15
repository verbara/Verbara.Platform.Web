import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { isApiError } from './api-error';

/** The `data-error-code` of a throttled recovery-code mint, identical in every locale. */
export const RECOVERY_CODES_THROTTLED = 'recovery-codes-throttled';

/**
 * The locale keys of the throttled-mint message: with and without the `Retry-After` seconds.
 * `throttledSeconds` is an i18next plural base key: the locales carry its `_one`, `_many` and
 * `_other` forms, selected by `count`.
 */
export const MINT_REFUSAL_KEYS = {
  throttledSeconds: 'auth.recovery_codes_throttled_seconds',
  throttled: 'auth.recovery_codes_throttled',
} as const;

/**
 * What the console shows when Platform throttles a recovery-code mint (design D3 of
 * `sign-in-refusals-say-what-happened`): for a 429, a localized wait-and-retry message, naming the
 * `Retry-After` seconds when Platform sent a usable number, wrapped in an element carrying
 * `data-error-code="recovery-codes-throttled"`. The body's `error` text is never shown.
 *
 * Returns `null` for any other failure, so the caller keeps its current handling.
 */
export function describeMintRefusal(err: unknown, t: TFunction): ReactNode | null {
  if (!isApiError(err) || err.status !== 429) return null;
  const text =
    err.retryAfterSeconds === null
      ? String(t(MINT_REFUSAL_KEYS.throttled))
      : String(t(MINT_REFUSAL_KEYS.throttledSeconds, { count: err.retryAfterSeconds }));
  return <span data-error-code={RECOVERY_CODES_THROTTLED}>{text}</span>;
}
