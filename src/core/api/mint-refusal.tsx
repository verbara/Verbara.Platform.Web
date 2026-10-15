import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { isApiError } from './api-error';

/** The `data-error-code` of a throttled recovery-code mint, identical in every locale. */
export const RECOVERY_CODES_THROTTLED = 'recovery-codes-throttled';

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
      ? String(t('auth.recovery_codes_throttled'))
      : String(t('auth.recovery_codes_throttled_seconds', { seconds: err.retryAfterSeconds }));
  return <span data-error-code={RECOVERY_CODES_THROTTLED}>{text}</span>;
}
