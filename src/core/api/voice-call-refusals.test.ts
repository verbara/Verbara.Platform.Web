import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiError, describeApiError, entriesOf } from './api-error';
import {
  trunkRefusalValues,
  voiceDialRefusals,
  voiceTransferRefusals,
} from './voice-call-refusals';
import { TEST_LOCALES, createLocaleI18n } from '@/test/locale-i18n';

/**
 * The click-to-dial and voice-transfer refusal maps (design D1, D3; spec
 * `conversation-action-feedback`). The bodies are read from the verbatim copy of the host's
 * `voice-dial-transfer.v1.json`, so a renamed code or field turns this red.
 */

type Entry = { status: number; route: 'dial' | 'transfer'; body: Record<string, unknown> };

const fixture = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'tests/fixtures/contracts/voice-dial-transfer.v1.json'),
    'utf-8',
  ),
) as Record<string, Entry>;

const dialRefused = fixture.dialTrunkNotDialable!;
const transferRefused = fixture.transferTrunkNotDialable!;

const maps = [
  ['voiceDialRefusals', voiceDialRefusals, 'dial-failed', 'agent:voice.dial_failed'],
  [
    'voiceTransferRefusals',
    voiceTransferRefusals,
    'voice-transfer-failed',
    'agent:voice.transfer.failed',
  ],
] as const;

describe('voice call refusal maps', () => {
  it('VoiceDialRefusals_ShouldMapTrunkNotDialable_WhenTheFixtureDialIsRefused', () => {
    const err = new ApiError(dialRefused.status, dialRefused.body);
    expect(describeApiError(err, voiceDialRefusals)).toEqual({
      code: 'trunk-not-dialable',
      key: 'common:errors.voice.trunk_not_dialable',
    });
  });

  it('VoiceTransferRefusals_ShouldMapTrunkNotDialable_WhenTheFixtureTransferIsRefused', () => {
    const err = new ApiError(transferRefused.status, transferRefused.body);
    expect(describeApiError(err, voiceTransferRefusals)).toEqual({
      code: 'trunk-not-dialable',
      key: 'common:errors.voice.trunk_not_dialable',
    });
  });

  it.each(maps)(
    '%s_ShouldStillMapTrunkNotDialable_WhenTheSameCodeComesUnderAnotherStatus',
    (_name, map) => {
      const err = new ApiError(500, { ...dialRefused.body });
      expect(describeApiError(err, map).code).toBe('trunk-not-dialable');
    },
  );

  it.each(maps)(
    '%s_ShouldGiveTheFallback_WhenTheRefusalHasAnotherCode',
    (_name, map, code, key) => {
      const err = new ApiError(409, { accepted: false, error: 'brand-new-code', trunkId: null });
      expect(describeApiError(err, map)).toEqual({ code, key });
    },
  );

  it.each(maps)('%s_ShouldGiveTheFallback_WhenTheRefusalHasNoCode', (_name, map, code, key) => {
    expect(describeApiError(new ApiError(500, null), map)).toEqual({ code, key });
    expect(describeApiError(new ApiError(409, { error: 'Prose text' }), map)).toEqual({
      code,
      key,
    });
  });

  it.each(maps)('%s_ShouldGiveTheFallback_WhenTheNetworkFails', (_name, map, code, key) => {
    expect(describeApiError(new TypeError('Failed to fetch'), map)).toEqual({ code, key });
  });
});

describe('trunkRefusalValues', () => {
  it('TrunkRefusalValues_ShouldReturnTheDialTrunk_WhenTheFixtureDialIsRefused', () => {
    expect(trunkRefusalValues(new ApiError(dialRefused.status, dialRefused.body))).toEqual({
      trunkId: 4,
    });
  });

  it('TrunkRefusalValues_ShouldReturnTheTransferTrunk_WhenTheFixtureTransferIsRefused', () => {
    expect(trunkRefusalValues(new ApiError(transferRefused.status, transferRefused.body))).toEqual({
      trunkId: 5,
    });
  });

  it('TrunkRefusalValues_ShouldBeEmpty_WhenTheCodeIsAnotherOne', () => {
    expect(trunkRefusalValues(new ApiError(409, { error: 'no-trunk', trunkId: 4 }))).toEqual({});
  });

  it('TrunkRefusalValues_ShouldBeEmpty_WhenTheErrorIsNotAnApiError', () => {
    expect(trunkRefusalValues(new TypeError('Failed to fetch'))).toEqual({});
    expect(trunkRefusalValues(null)).toEqual({});
  });
});

describe('voice call refusal texts', () => {
  const allEntries = [...entriesOf(voiceDialRefusals), ...entriesOf(voiceTransferRefusals)];

  it.each(TEST_LOCALES)(
    'VoiceCallRefusalMaps_ShouldResolveEveryKey_WhenTheLocaleIs %s',
    async (lng) => {
      const i18n = await createLocaleI18n(lng);
      for (const entry of allEntries) {
        expect(i18n.exists(entry.key), `${lng} ${entry.key}`).toBe(true);
      }
    },
  );

  it.each(TEST_LOCALES)(
    'VoiceCallRefusalMaps_ShouldNameTheTrunkAndNeverTheBodyCode_WhenTheLocaleIs %s',
    async (lng) => {
      const i18n = await createLocaleI18n(lng);
      for (const [refused, map, trunkId] of [
        [dialRefused, voiceDialRefusals, 4],
        [transferRefused, voiceTransferRefusals, 5],
      ] as const) {
        const err = new ApiError(refused.status, refused.body);
        const text = String(i18n.t(describeApiError(err, map).key, trunkRefusalValues(err)));
        expect(text).not.toContain(refused.body.error as string);
        expect(text).not.toContain('{{trunkId}}');
        expect(text).toContain(String(trunkId));
      }
    },
  );
});
