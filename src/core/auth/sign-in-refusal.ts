/**
 * What the sign-in surfaces say when a sign-in does not complete, and the notice `/login` shows
 * when the console ended a session (design D2 and D7, spec `sign-in-refusal-feedback`).
 *
 * The login page holds a *code*, never display text. The code picks the translation key and is
 * exposed as `data-error-code` / `data-notice-code`, identical in every locale. A refusal's code
 * comes from the HTTP status of the sign-in response and, on a 403, from the machine code in the
 * body's `error`: since Platform v2.29.0 that code is a contract on `POST /api/v1/auth/login`,
 * `/auth/mfa/verify` and `/auth/login/apikey` (design D1). Only codes on a closed allow-list are
 * read; prose in a body is never shown, and a 403 without a known code reads as account-inactive,
 * which is how an older Platform's answers are handled.
 */

import { machineCodeOf } from '@/core/api/api-error';

/** Why a sign-in on the login page did not complete. */
export type SignInErrorCode =
  | 'invalid-credentials'
  | 'account-inactive'
  | 'account-locked'
  | 'invalid-key'
  | 'sso-no-tenant'
  | 'tenant-suspended'
  | 'tenant-pending-deletion';

/**
 * The `common` translation key of each code. A `Record`, so a new code fails the build until it
 * has a key; every key exists in all three locales (asserted by the login page's tests, because
 * the parity gate cannot see a key missing from all three).
 */
export const SIGN_IN_ERROR_KEYS: Readonly<Record<SignInErrorCode, string>> = {
  'invalid-credentials': 'auth.invalid_credentials',
  'account-inactive': 'auth.account_not_active',
  'account-locked': 'auth.account_locked',
  'invalid-key': 'auth.invalid_key',
  'sso-no-tenant': 'auth.sso_no_tenant',
  'tenant-suspended': 'auth.tenant_suspended',
  'tenant-pending-deletion': 'auth.tenant_pending_deletion',
};

/** The 403 codes a sign-in route may carry in `error` (Platform v2.29.0+), and nothing else. */
const SIGN_IN_403_CODES: readonly SignInErrorCode[] = [
  'account-inactive',
  'tenant-suspended',
  'tenant-pending-deletion',
];

/**
 * The code for a 403 on a sign-in route: the body's `error` when it is one of the three sign-in
 * codes (the account's own status, or the status of the tenant the request names), else
 * `account-inactive`, whose message is true for either cause. `body` is the parsed body, `null`
 * when it is absent or not JSON.
 */
function forbiddenRefusalCode(body: unknown): SignInErrorCode {
  const code = machineCodeOf(body);
  return SIGN_IN_403_CODES.find((known) => known === code) ?? 'account-inactive';
}

/**
 * The code for a refused `POST /api/v1/auth/login`, from its status and, on a 403, its parsed
 * body (`null` when absent or not JSON).
 */
export function passwordRefusalCode(status: number, body: unknown): SignInErrorCode {
  if (status === 403) return forbiddenRefusalCode(body);
  if (status === 423) return 'account-locked';
  // 401 (unknown email or wrong password) and any other failure keep the message shown before.
  return 'invalid-credentials';
}

/**
 * The code for a refused `POST /api/v1/auth/login/apikey`: a 403 is the key owner's account or its
 * tenant, read as for the password form; any other failure is an invalid key.
 */
export function apiKeyRefusalCode(status: number, body: unknown): SignInErrorCode {
  return status === 403 ? forbiddenRefusalCode(body) : 'invalid-key';
}

/** Why the console sent the user to `/login`, as the allow-listed `reason` query value. */
export type LoginNoticeCode = 'session-ended';

/** The `common` translation key of each notice. */
export const LOGIN_NOTICE_KEYS: Readonly<Record<LoginNoticeCode, string>> = {
  'session-ended': 'auth.session_ended',
};

/**
 * The notice for a `/login?reason=` value, or `null` for a missing or unknown one. Only the map's
 * own keys match, so a value such as `constructor` or `__proto__` shows nothing. The raw value is
 * never rendered.
 */
export function loginNoticeCode(reason: string | null): LoginNoticeCode | null {
  if (reason === null || !Object.hasOwn(LOGIN_NOTICE_KEYS, reason)) return null;
  return reason as LoginNoticeCode;
}

/** Why a password reset did not complete (design D8, H4). */
export type ResetRefusalCode = 'reset-policy' | 'reset-invalid' | 'reset-failed';

/** The `common` translation key of each reset refusal. */
export const RESET_REFUSAL_KEYS: Readonly<Record<ResetRefusalCode, string>> = {
  'reset-policy': 'auth.reset_policy',
  'reset-invalid': 'auth.reset_invalid',
  'reset-failed': 'auth.reset_failed',
};

/**
 * The code for a refused `POST /api/v1/auth/reset-password`, from the status and the shape of the
 * body, never from its text. Platform (v2.25.0+, `AuthEndpoints.ResetPassword`) answers 400
 * `ErrorDetailResponse(Error, Details)` — `{ error, details: string[] }` on the wire — for a
 * password the tenant's policy rejects, and 400 `ErrorResponse { error }` for an unknown, used or
 * expired token; anything else (another status, or a network failure: pass `null`) is generic.
 * The `details` strings are English and are never shown: the page renders `auth.reset_policy`.
 */
export function resetRefusalCode(status: number | null, body: unknown): ResetRefusalCode {
  if (status !== 400) return 'reset-failed';
  const details =
    typeof body === 'object' && body !== null ? (body as { details?: unknown }).details : undefined;
  return Array.isArray(details) ? 'reset-policy' : 'reset-invalid';
}
