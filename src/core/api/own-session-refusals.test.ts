import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import { ApiError, describeApiError, entriesOf } from './api-error';
import { ownSessionRefusals, SESSION_IS_CURRENT } from './own-session-refusals';

/** Host fixture `own-session-revoke.v1.json`: the refusals of `DELETE /api/v1/auth/sessions/{tokenId}`. */
const CONTRACT = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/own-session-revoke.v1.json'),
    'utf-8',
  ),
) as {
  sessionIsCurrent: { status: number; body: { error: string } };
  notFound: { status: number; body: null };
};

describe('ownSessionRefusals', () => {
  it('describeApiError_ShouldMapEachRefusalOfTheContractFixture_WhenTheFixtureIsRead', () => {
    const current = CONTRACT.sessionIsCurrent;
    expect(
      describeApiError(new ApiError(current.status, current.body), ownSessionRefusals).key,
    ).toBe('errors.own_session.session_is_current');
    const missing = CONTRACT.notFound;
    expect(
      describeApiError(new ApiError(missing.status, missing.body), ownSessionRefusals).key,
    ).toBe('errors.own_session.not_found');
  });

  it('describeApiError_ShouldReportSessionIsCurrent_WhenTheRouteAnswers400WithTheCode', () => {
    expect(
      describeApiError(new ApiError(400, { error: 'session-is-current' }), ownSessionRefusals),
    ).toEqual({ code: 'session-is-current', key: 'errors.own_session.session_is_current' });
    expect(SESSION_IS_CURRENT).toBe('session-is-current');
  });

  it('describeApiError_ShouldReportNotFound_WhenTheRouteAnswers404WithNoBody', () => {
    expect(describeApiError(new ApiError(404, null), ownSessionRefusals)).toEqual({
      code: 'session-not-found',
      key: 'errors.own_session.not_found',
    });
  });

  it.each([
    [400, { error: 'Cannot revoke the current session' }],
    [500, null],
    [403, { error: 'some-unknown-code' }],
  ] as const)(
    'describeApiError_ShouldReportRevokeFailed_WhenTheMapDoesNotKnowStatus %s',
    (status, body) => {
      expect(describeApiError(new ApiError(status, body), ownSessionRefusals).key).toBe(
        'errors.own_session.revoke_failed',
      );
    },
  );

  it('describeApiError_ShouldReportRevokeFailed_WhenTheErrorIsNotAnApiError', () => {
    expect(describeApiError(new TypeError('Failed to fetch'), ownSessionRefusals).code).toBe(
      'session-revoke-failed',
    );
  });
});

function hasKey(resource: unknown, key: string): boolean {
  let node: unknown = resource;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, part)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}

describe('ownSessionRefusals locale coverage', () => {
  const locales = { 'en-US': enCommon, 'es-419': esCommon, 'pt-BR': ptCommon } as const;

  it('ownSessionRefusals_ShouldCoverTheThreeOutcomes', () => {
    expect(new Set(entriesOf(ownSessionRefusals).map((e) => e.key))).toEqual(
      new Set([
        'errors.own_session.session_is_current',
        'errors.own_session.not_found',
        'errors.own_session.revoke_failed',
      ]),
    );
  });

  it.each(Object.keys(locales) as (keyof typeof locales)[])(
    'ownSessionRefusals_ShouldResolveEveryEntryToAKeyPresentIn %s',
    (locale) => {
      const missing = entriesOf(ownSessionRefusals)
        .filter((e) => !hasKey(locales[locale], e.key))
        .map((e) => e.key);
      expect(missing).toEqual([]);
    },
  );
});
