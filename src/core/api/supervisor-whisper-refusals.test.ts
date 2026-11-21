import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiError, describeApiError, entriesOf } from './api-error';
import { supervisorWhisperRefusals } from './supervisor-whisper-refusals';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';

/**
 * The whisper's closed refusal map (design D2; spec `conversation-action-feedback`). The statuses
 * are read from the verbatim copy of the host's `supervisor-whisper.v1.json`, so a refusal status the
 * host adds turns this red instead of reaching the generic message unnoticed.
 */

const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/supervisor-whisper.v1.json'),
    'utf-8',
  ),
) as {
  responses: Record<string, string>;
  refusalBodies: Record<string, unknown>;
};

const refusalStatuses = Object.keys(fixture.responses)
  .map(Number)
  .filter((status) => status >= 400);

describe('supervisorWhisperRefusals', () => {
  it('SupervisorWhisperRefusals_ShouldCoverTheFixtureRefusals_WhenReadFromTheFixtureCopy', () => {
    expect(refusalStatuses).toEqual([400, 404, 409]);
    expect(Object.keys(fixture.responses)).toContain('204');
  });

  it.each([
    [400, 'whisper-text-invalid'],
    [404, 'whisper-session-not-found'],
    [409, 'whisper-session-not-bound'],
    [500, 'whisper-failed'],
  ])('SupervisorWhisperRefusals_ShouldMapTheStatus_WhenTheAnswerIs %i', (status, code) => {
    expect(describeApiError(new ApiError(status, null), supervisorWhisperRefusals).code).toBe(code);
  });

  it('SupervisorWhisperRefusals_ShouldGiveWhisperFailed_WhenTheErrorIsNotAnApiError', () => {
    expect(describeApiError(new TypeError('network'), supervisorWhisperRefusals).code).toBe(
      'whisper-failed',
    );
  });

  it.each([
    [400, { error: 'whisper-session-not-bound' }, 'whisper-text-invalid'],
    [409, { error: 'whisper-text-invalid' }, 'whisper-session-not-bound'],
    [404, { error: 'whisper-text-invalid' }, 'whisper-session-not-found'],
    [500, { error: 'whisper-text-invalid' }, 'whisper-failed'],
  ])(
    'SupervisorWhisperRefusals_ShouldIgnoreTheBodyError_WhenTheStatusIs %i',
    (status, body, code) => {
      expect(describeApiError(new ApiError(status, body), supervisorWhisperRefusals).code).toBe(
        code,
      );
    },
  );

  it('SupervisorWhisperRefusals_ShouldMapTheFixtureBodies_ToTheirStatusEntries', () => {
    for (const status of [400, 409]) {
      const body = fixture.refusalBodies[String(status)];
      const described = describeApiError(new ApiError(status, body), supervisorWhisperRefusals);
      expect(described.code).toBe((body as { error: string }).error);
    }
  });
});

describe('whisper refusal texts', () => {
  const allEntries = entriesOf(supervisorWhisperRefusals);

  it.each(TEST_LOCALES)(
    'WhisperRefusalMap_ShouldResolveEveryKey_WhenTheLocaleIs %s',
    async (lng) => {
      const i18n = await createLocaleI18n(lng);
      for (const entry of allEntries) {
        expect(i18n.exists(entry.key), `${lng} ${entry.key}`).toBe(true);
        expect(String(i18n.t(entry.key))).not.toContain(entry.code);
      }
    },
  );
});
