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
    });
    expect(LOGIN_NOTICE_KEYS).toEqual({ 'session-ended': 'auth.session_ended' });
  });

  it.each([
    [401, 'invalid-credentials'],
    [403, 'account-inactive'],
    [423, 'account-locked'],
    [400, 'invalid-credentials'],
    [404, 'invalid-credentials'],
    [429, 'invalid-credentials'],
    [500, 'invalid-credentials'],
    [503, 'invalid-credentials'],
  ] as const)('PasswordRefusalCode_ShouldMap %i To %s', (status, code) => {
    expect(passwordRefusalCode(status)).toBe(code);
  });

  it.each([
    [403, 'account-inactive'],
    [401, 'invalid-key'],
    [423, 'invalid-key'],
    [500, 'invalid-key'],
  ] as const)('ApiKeyRefusalCode_ShouldMap %i To %s', (status, code) => {
    expect(apiKeyRefusalCode(status)).toBe(code);
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
