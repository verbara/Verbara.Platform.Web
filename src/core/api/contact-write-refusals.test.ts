import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiError, describeApiError, entriesOf } from './api-error';
import {
  CONTACT_CONSENT_WITHDRAWN,
  CONTACT_DO_NOT_CONTACT,
  contactWriteRefusals,
} from './contact-write-refusals';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';

/**
 * The closed contact-write map (design W1, W6; spec `console-contact-writes`). The refusals are read from
 * the verbatim copies of the host's fixtures, so a body the host changes turns this red.
 */

type Refusal = { status: number; body?: Record<string, unknown>; _noBody?: boolean };

const refusalsOf = (name: string) =>
  (
    JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8')) as {
      refusals: Refusal[];
    }
  ).refusals;

const withBody = (name: string) =>
  refusalsOf(name)
    .filter((r): r is Refusal & { body: Record<string, unknown> } => r.body !== undefined)
    .map((r) => [name, r.status, r.body] as const);

const bodies = [
  ...withBody('contact-write-refusals.v1.json'),
  ...withBody('contact-channel-consent.v1.json'),
  ...withBody('contact-opt-out.v1.json'),
];

describe('contactWriteRefusals', () => {
  it('ContactWriteRefusals_ShouldReadEveryFixtureBody_WhenTheCopiesAreLoaded', () => {
    // 5 in contact-write-refusals, 1 in contact-channel-consent, 2 with a body in contact-opt-out.
    expect(bodies).toHaveLength(8);
  });

  it.each(bodies)(
    'ContactWriteRefusals_ShouldMapToItsCode_WhenTheBodyIsFrom %s (%i)',
    (_name, status, body) => {
      const entry = describeApiError(new ApiError(status, body), contactWriteRefusals);
      expect(entry.code).toBe(body.error);
      expect(entry.key).not.toBe(contactWriteRefusals.fallback.key);
    },
  );

  it('ContactWriteRefusals_ShouldGive404_WhenTheOptOutAnswers404WithNoBody', () => {
    const noBody = refusalsOf('contact-opt-out.v1.json').find((r) => r._noBody === true);
    expect(noBody?.status).toBe(404);
    expect(describeApiError(new ApiError(404, null), contactWriteRefusals).code).toBe('404');
  });

  it('ContactWriteRefusals_ShouldGive404_WhenAPutAnswers404WithAnEmptyBody', () => {
    expect(describeApiError(new ApiError(404, ''), contactWriteRefusals).code).toBe('404');
  });

  it('ContactWriteRefusals_ShouldGiveContactWriteFailed_WhenTheCodeIsUnknown', () => {
    const err = new ApiError(409, { error: 'brand-new-code' });
    expect(describeApiError(err, contactWriteRefusals).code).toBe('contact-write-failed');
  });

  it('ContactWriteRefusals_ShouldGiveContactWriteFailed_WhenAStatusHasNoCode', () => {
    expect(describeApiError(new ApiError(500, null), contactWriteRefusals).code).toBe(
      'contact-write-failed',
    );
  });

  it('ContactWriteRefusals_ShouldGiveContactWriteFailed_WhenTheErrorIsNotAnApiError', () => {
    expect(describeApiError(new TypeError('network'), contactWriteRefusals).code).toBe(
      'contact-write-failed',
    );
  });

  it('ContactWriteRefusals_ShouldNameTheSharedEntries_WhenRead', () => {
    expect(CONTACT_DO_NOT_CONTACT).toEqual({
      code: 'contact-do-not-contact',
      key: 'common:errors.contacts.do_not_contact',
    });
    expect(CONTACT_CONSENT_WITHDRAWN).toEqual({
      code: 'contact-consent-withdrawn',
      key: 'common:errors.contacts.consent_withdrawn',
    });
  });

  it.each(TEST_LOCALES)(
    'ContactWriteRefusals_ShouldHaveEveryKey_WhenTheLocaleIs %s',
    async (locale) => {
      const i18n = await createLocaleI18n(locale);
      const entries = [
        ...entriesOf(contactWriteRefusals),
        CONTACT_DO_NOT_CONTACT,
        CONTACT_CONSENT_WITHDRAWN,
      ];
      for (const { key } of entries) {
        expect(i18n.exists(key), `${locale} ${key}`).toBe(true);
      }
    },
  );

  it('ContactWriteRefusals_ShouldNotNameTheDetails_WhenTheChannelIsUnknown', async () => {
    const i18n = await createLocaleI18n('en-US');
    const text = i18n.t(contactWriteRefusals.codes!['unknown-consent-channel']!.key);
    for (const value of ['voice', '0', 'Fax']) expect(text).not.toContain(value);
  });
});
