import { describe, expect, it } from 'vitest';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import {
  LOGIN_NOTICE_KEYS,
  MFA_STEP_ERROR_KEYS,
  SIGN_IN_ERROR_KEYS,
  apiKeyRefusalCode,
  loginNoticeCode,
  mfaVerifyOutcome,
  passwordRefusalCode,
  resetRefusalCode,
} from './sign-in-refusal';

const LOCALES = [
  ['en-US', enCommon],
  ['es-419', esCommon],
  ['pt-BR', ptCommon],
] as const;

function lookup(tree: unknown, dottedKey: string): unknown {
  return dottedKey
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node !== null && typeof node === 'object' && Object.hasOwn(node, part)
          ? (node as Record<string, unknown>)[part]
          : undefined,
      tree,
    );
}

/**
 * Every code the sign-in surfaces map to text: the refusal codes, the MFA-step codes and the
 * `/login` notices.
 */
const MAPPED_KEYS = [
  ...Object.entries(SIGN_IN_ERROR_KEYS).map(([code, key]) => ({ map: 'error', code, key })),
  ...Object.entries(MFA_STEP_ERROR_KEYS).map(([code, key]) => ({ map: 'mfa', code, key })),
  ...Object.entries(LOGIN_NOTICE_KEYS).map(([code, key]) => ({ map: 'notice', code, key })),
];

describe('sign-in-refusal', () => {
  // The parity gate compares key sets only, so it stays green for a key missing from all three
  // locales (spec "Every mapped code resolves in every locale").
  it.each(LOCALES)(
    'EveryMappedCode_ShouldResolveToANonEmptyString_InLocale %s',
    (_locale, common) => {
      const unresolved = MAPPED_KEYS.filter(({ key }) => {
        const value = lookup(common, key);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(unresolved).toEqual([]);
    },
  );

  it('Maps_ShouldCoverEveryCodeTheSpecNames_IncludingTheSsoNoTenantMessage', () => {
    expect(SIGN_IN_ERROR_KEYS).toEqual({
      'invalid-credentials': 'auth.invalid_credentials',
      'account-inactive': 'auth.account_not_active',
      'account-locked': 'auth.account_locked',
      'invalid-key': 'auth.invalid_key',
      'sso-no-tenant': 'auth.sso_no_tenant',
      'tenant-suspended': 'auth.tenant_suspended',
      'tenant-pending-deletion': 'auth.tenant_pending_deletion',
    });
    expect(LOGIN_NOTICE_KEYS).toEqual({ 'session-ended': 'auth.session_ended' });
    expect(MFA_STEP_ERROR_KEYS).toEqual({
      'invalid-code': 'auth.mfa_invalid_code',
      'challenge-exhausted': 'auth.mfa_challenge_exhausted',
      'challenge-expired': 'auth.mfa_challenge_expired',
      'rate-limited': 'auth.mfa_rate_limited',
      'server-error': 'auth.mfa_server_error',
      'mfa-error': 'auth.mfa_error',
    });
  });

  // Platform v2.29.0 403 bodies on `login` and `apiKeyLogin`, verbatim from the host fixture
  // sign-in-refusal-codes.v1.json: `accountInactive.body`, `tenantSuspended.body`,
  // `tenantPendingDeletion.body`.
  const CODED_403_BODIES = [
    [{ error: 'account-inactive' }, 'account-inactive'],
    [{ error: 'tenant-suspended' }, 'tenant-suspended'],
    [{ error: 'tenant-pending-deletion' }, 'tenant-pending-deletion'],
  ] as const;

  // A 403 the console cannot attribute reads as the account-not-active message, true for any cause.
  const UNCODED_403_BODIES = [
    // sign-in-refusal-codes.v1.json `tenantSuspended.previousBody` (a Platform before v2.29.0).
    [
      'prose from a Platform before v2.29.0',
      { error: 'This tenant account has been suspended. Contact your administrator.' },
    ],
    ['an unknown machine code', { error: 'tenant-archived' }],
    ['a code of another route', { error: 'mfa-challenge-exhausted' }],
    ['an inherited object key', { error: 'constructor' }],
    ['a differently cased code', { error: 'Tenant-Suspended' }],
    ['a body without error', { title: 'Forbidden' }],
    ['no body or a body that is not JSON', null],
  ] as const;

  describe('PasswordRefusalCode', () => {
    it.each(CODED_403_BODIES)('ShouldMapA403With %o To %s', (body, code) => {
      expect(passwordRefusalCode(403, body)).toBe(code);
    });

    it.each(UNCODED_403_BODIES)('ShouldReturnAccountInactive_ForA403With %s', (_case, body) => {
      expect(passwordRefusalCode(403, body)).toBe('account-inactive');
    });

    it.each([
      [401, null, 'invalid-credentials'],
      [423, null, 'account-locked'],
      [400, null, 'invalid-credentials'],
      [404, null, 'invalid-credentials'],
      [429, null, 'invalid-credentials'],
      [500, null, 'invalid-credentials'],
      [503, null, 'invalid-credentials'],
      // A code is read on a 403 only: the same body on another status keeps the status mapping.
      [401, { error: 'tenant-suspended' }, 'invalid-credentials'],
      [423, { error: 'tenant-pending-deletion' }, 'account-locked'],
      [500, { error: 'account-inactive' }, 'invalid-credentials'],
    ] as const)('ShouldMap %i with body %o To %s', (status, body, code) => {
      expect(passwordRefusalCode(status, body)).toBe(code);
    });
  });

  describe('ApiKeyRefusalCode', () => {
    it.each(CODED_403_BODIES)('ShouldMapA403With %o To %s', (body, code) => {
      expect(apiKeyRefusalCode(403, body)).toBe(code);
    });

    it.each(UNCODED_403_BODIES)('ShouldReturnAccountInactive_ForA403With %s', (_case, body) => {
      expect(apiKeyRefusalCode(403, body)).toBe('account-inactive');
    });

    it.each([
      [401, null],
      [423, null],
      [500, null],
      [401, { error: 'tenant-suspended' }],
      [500, { error: 'account-inactive' }],
    ] as const)('ShouldReturnInvalidKey_For %i with body %o', (status, body) => {
      expect(apiKeyRefusalCode(status, body)).toBe('invalid-key');
    });
  });

  // `POST /api/v1/auth/mfa/verify`, one test per row of the spec table "The MFA verification step
  // SHALL report what actually happened" and per 403 / 423 case of "MFA verification MUST treat an
  // inactive-account refusal as final". Status and body are mfa-verify-refusals.v1.json values.
  describe('MfaVerifyOutcome', () => {
    it('ShouldReturnChallengeExhaustedAndClearThePendingChallenge_ForThe401ExhaustedCode', () => {
      // mfa-verify-refusals.v1.json `exhausted.status`, `exhausted.body`
      expect(mfaVerifyOutcome(401, { error: 'mfa-challenge-exhausted' })).toEqual({
        kind: 'step',
        code: 'challenge-exhausted',
        clearPending: true,
      });
    });

    it('ShouldReturnInvalidCodeAndKeepThePendingChallenge_ForA401WithNoBody', () => {
      // mfa-verify-refusals.v1.json `wrongFactor.status`, `wrongFactor.body` (null)
      expect(mfaVerifyOutcome(401, null)).toEqual({
        kind: 'step',
        code: 'invalid-code',
        clearPending: false,
      });
    });

    it('ShouldReturnInvalidCode_ForA401WithAProblemDetailsBody', () => {
      const problem = { title: 'Unauthorized', status: 401, detail: 'Unauthorized access' };
      expect(mfaVerifyOutcome(401, problem)).toEqual({
        kind: 'step',
        code: 'invalid-code',
        clearPending: false,
      });
    });

    it('ShouldReturnChallengeExpiredAndClearThePendingChallenge_ForThe400ExpiredCode', () => {
      // mfa-verify-refusals.v1.json `expired.status`, `expired.body`
      expect(mfaVerifyOutcome(400, { error: 'mfa-challenge-expired' })).toEqual({
        kind: 'step',
        code: 'challenge-expired',
        clearPending: true,
      });
    });

    it.each([
      ['prose that mentions expiry', { error: 'Invalid or expired challenge token' }],
      ['the old marker as prose', { error: 'CHALLENGE_EXPIRED' }],
      ['another machine code', { error: 'mfa-challenge-exhausted' }],
      ['no body', null],
    ] as const)('ShouldReturnMfaError_ForA400With %s', (_case, body) => {
      expect(mfaVerifyOutcome(400, body)).toEqual({
        kind: 'step',
        code: 'mfa-error',
        clearPending: false,
      });
    });

    it('ShouldReturnRateLimited_ForA429', () => {
      // mfa-verify-refusals.v1.json `rateLimited.status`; its body is not read.
      expect(mfaVerifyOutcome(429, null)).toEqual({
        kind: 'step',
        code: 'rate-limited',
        clearPending: false,
      });
    });

    it.each([
      // mfa-verify-refusals.v1.json `serverError.status` and body (illustrative)
      [500, { title: 'Internal Server Error', status: 500 }],
      [502, null],
      [503, null],
      [504, { error: 'mfa-challenge-expired' }],
    ] as const)('ShouldReturnServerError_ForA %i', (status, body) => {
      expect(mfaVerifyOutcome(status, body)).toEqual({
        kind: 'step',
        code: 'server-error',
        clearPending: false,
      });
    });

    it.each([
      [404, null],
      [409, { error: 'conflict' }],
      [422, null],
    ] as const)('ShouldReturnMfaError_ForAnyOtherNonOkStatus %i', (status, body) => {
      expect(mfaVerifyOutcome(status, body)).toEqual({
        kind: 'step',
        code: 'mfa-error',
        clearPending: false,
      });
    });

    it.each(CODED_403_BODIES)('ShouldReturnAFinalRefusal_ForA403With %o As %s', (body, code) => {
      expect(mfaVerifyOutcome(403, body)).toEqual({ kind: 'refused', code });
    });

    it.each(UNCODED_403_BODIES)(
      'ShouldReturnAFinalAccountInactiveRefusal_ForA403With %s',
      (_case, body) => {
        expect(mfaVerifyOutcome(403, body)).toEqual({ kind: 'refused', code: 'account-inactive' });
      },
    );

    it('ShouldReturnAFinalAccountLockedRefusal_ForA423WhoseProseIsNotRead', () => {
      // mfa-verify-refusals.v1.json `locked.status`, `locked.body`
      expect(mfaVerifyOutcome(423, { error: 'Account is locked' })).toEqual({
        kind: 'refused',
        code: 'account-locked',
      });
    });
  });

  it('LoginNoticeCode_ShouldReturnTheNotice_WhenTheReasonIsAllowListed', () => {
    expect(loginNoticeCode('session-ended')).toBe('session-ended');
  });

  it.each([
    ['no reason', null],
    ['an empty reason', ''],
    ['an unknown reason', 'expired'],
    ['a differently cased reason', 'SESSION-ENDED'],
    ['a padded reason', ' session-ended'],
    ['an inherited object key', 'constructor'],
    ['another inherited object key', 'toString'],
    ['the prototype key', '__proto__'],
    ['a key of the error map', 'account-inactive'],
  ])('LoginNoticeCode_ShouldReturnNull_ForAReasonOutsideTheAllowList: %s', (_case, reason) => {
    expect(loginNoticeCode(reason)).toBeNull();
  });

  // Platform v2.25.0+ AuthEndpoints.ResetPassword: a policy refusal is 400
  // `ErrorDetailResponse(string Error, IReadOnlyList<string> Details)`, camelCase on the wire.
  it('ResetRefusalCode_ShouldReturnResetPolicy_WhenTheBodyIsPlatformsErrorDetailResponse', () => {
    const body = {
      error: 'Password does not meet policy',
      details: ['Password must be at least 12 characters'],
    };
    expect(resetRefusalCode(400, body)).toBe('reset-policy');
  });

  it.each([
    ['a token refusal (ErrorResponse)', { error: 'Invalid or expired reset token' }],
    ['details that is not a list', { error: 'x', details: 'Password too short' }],
    ['a list under another name', { error: 'x', errors: ['Password too short'] }],
    ['a ProblemDetails', { title: 'Bad Request', detail: 'Something went wrong' }],
    ['no body', null],
  ])('ResetRefusalCode_ShouldReturnResetInvalid_ForA400Without_details: %s', (_case, body) => {
    expect(resetRefusalCode(400, body)).toBe('reset-invalid');
  });

  it.each([
    [500, { error: 'x', details: ['y'] }],
    [429, { error: 'Too many requests' }],
    [null, null],
  ])('ResetRefusalCode_ShouldReturnResetFailed_WhenTheStatusIsNot400: %s', (status, body) => {
    expect(resetRefusalCode(status, body)).toBe('reset-failed');
  });
});
