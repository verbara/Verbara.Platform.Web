import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiError, describeApiError, entriesOf } from './api-error';
import {
  listenPhoneRefusals,
  supervisorListenRefusals,
  alreadyListeningOf,
} from './supervisor-listen-refusals';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';

/**
 * The two closed refusal maps of the silent listen (design D5; spec `conversation-action-feedback`).
 * The codes are read from the verbatim copy of the host's `supervisor-listen-refusals.json`, so a code
 * the host adds turns this red instead of reaching the generic message unnoticed.
 */

type Entry = { status: number; routes: string[]; body: Record<string, unknown> };

const readJson = (name: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as Record<string, unknown>;

const refusals = Object.entries(readJson('supervisor-listen-refusals.json')).filter(
  ([key]) => !key.startsWith('_'),
) as [string, Entry][];
const phone = readJson('supervisor-listen-phone.v1.json') as {
  invalid: { status: number; body: Record<string, unknown> };
};

describe('supervisorListenRefusals', () => {
  it('SupervisorListenRefusals_ShouldCoverThirteenFixtureCodes_WhenReadFromTheFixtureCopy', () => {
    expect(refusals).toHaveLength(13);
  });

  it.each(refusals)(
    'SupervisorListenRefusals_ShouldHaveItsOwnEntry_WhenTheCodeIs %s',
    (_name, entry) => {
      const code = entry.body.error as string;
      const err = new ApiError(entry.status, entry.body);
      const described = describeApiError(err, supervisorListenRefusals);

      expect(described.code).toBe(code);
      expect(described.key).not.toBe(supervisorListenRefusals.fallback.key);
      expect(supervisorListenRefusals.codes?.[code]).toBeDefined();
    },
  );

  it('SupervisorListenRefusals_ShouldUseTheSharedVoiceKey_WhenTheCodeIsTrunkNotDialable', () => {
    expect(supervisorListenRefusals.codes?.['trunk-not-dialable']).toEqual({
      code: 'trunk-not-dialable',
      key: 'common:errors.voice.trunk_not_dialable',
    });
  });

  it('SupervisorListenRefusals_ShouldGiveListenFailed_WhenTheCodeIsUnknown', () => {
    const err = new ApiError(418, {
      error: 'brand-new-code',
      conversationId: null,
      listenId: null,
    });
    expect(describeApiError(err, supervisorListenRefusals).code).toBe('listen-failed');
  });

  it('SupervisorListenRefusals_ShouldGiveListenFailed_WhenTheErrorIsNotAnApiError', () => {
    expect(describeApiError(new TypeError('network'), supervisorListenRefusals).code).toBe(
      'listen-failed',
    );
  });

  it('AlreadyListeningOf_ShouldExposeTheExistingListen_WhenTheRefusalIsAlreadyListening', () => {
    const entry = refusals.find(([name]) => name === 'alreadyListening')?.[1];
    const err = new ApiError(entry!.status, entry!.body);

    expect(err.facts.conversationId).toBe('9a8b7c6d5e4f40312a1b2c3d4e5f6071');
    expect(err.facts.listenId).toBe('b3e1f0a9c8d74e6f9a1b2c3d4e5f6a7b');
    expect(alreadyListeningOf(err)).toEqual({
      conversationId: '9a8b7c6d5e4f40312a1b2c3d4e5f6071',
      listenId: 'b3e1f0a9c8d74e6f9a1b2c3d4e5f6a7b',
    });
  });

  it('AlreadyListeningOf_ShouldBeNull_WhenTheRefusalIsAnotherCode', () => {
    const entry = refusals.find(([name]) => name === 'noVoiceCall')?.[1];
    expect(alreadyListeningOf(new ApiError(entry!.status, entry!.body))).toBeNull();
    expect(alreadyListeningOf(new Error('x'))).toBeNull();
  });
});

describe('listenPhoneRefusals', () => {
  it('ListenPhoneRefusals_ShouldMapListenPhoneInvalid_WhenTheFixtureBodyIsRefused', () => {
    const err = new ApiError(phone.invalid.status, phone.invalid.body);
    expect(describeApiError(err, listenPhoneRefusals).code).toBe('listen-phone-invalid');
  });

  it('ListenPhoneRefusals_ShouldMapUserNotFound_WhenTheAnswerIsABare404', () => {
    expect(describeApiError(new ApiError(404, null), listenPhoneRefusals).code).toBe(
      'user-not-found',
    );
  });

  it('ListenPhoneRefusals_ShouldGiveTheGenericFailure_WhenTheRefusalIsAnythingElse', () => {
    expect(describeApiError(new ApiError(500, null), listenPhoneRefusals).code).toBe(
      'listen-phone-failed',
    );
  });
});

describe('listen refusal texts', () => {
  const allEntries = [...entriesOf(supervisorListenRefusals), ...entriesOf(listenPhoneRefusals)];

  it.each(TEST_LOCALES)(
    'ListenRefusalMaps_ShouldResolveEveryKey_WhenTheLocaleIs %s',
    async (lng) => {
      const i18n = await createLocaleI18n(lng);
      for (const entry of allEntries) {
        expect(i18n.exists(entry.key), `${lng} ${entry.key}`).toBe(true);
      }
    },
  );

  it.each(TEST_LOCALES)(
    'ListenRefusalMaps_ShouldNeverRenderTheBodyText_WhenTheLocaleIs %s',
    async (lng) => {
      const i18n = await createLocaleI18n(lng);
      for (const [, entry] of refusals) {
        const err = new ApiError(entry.status, entry.body);
        const text = String(i18n.t(describeApiError(err, supervisorListenRefusals).key));
        expect(text).not.toContain(entry.body.error as string);
        for (const value of Object.values(entry.body)) {
          if (typeof value === 'string') expect(text).not.toContain(value);
        }
      }
      const invalid = new ApiError(phone.invalid.status, phone.invalid.body);
      const text = String(i18n.t(describeApiError(invalid, listenPhoneRefusals).key));
      expect(text).not.toContain('listen-phone-invalid');
    },
  );
});
