import { describe, expect, it } from 'vitest';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import {
  LOGIN_NOTICE_KEYS,
  SIGN_IN_ERROR_KEYS,
  apiKeyRefusalCode,
  loginNoticeCode,
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

/** Every code the sign-in surfaces map to text: the refusal codes and the `/login` notices. */
const MAPPED_KEYS = [
  ...Object.entries(SIGN_IN_ERROR_KEYS).map(([code, key]) => ({ map: 'error', code, key })),
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
