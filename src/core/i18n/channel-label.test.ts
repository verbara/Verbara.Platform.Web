import { describe, expect, it } from 'vitest';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import { createLocaleI18n } from '@/test/locale-i18n';
import { channelTypeValues } from '@/tests/utils/contract-doubles';
import { channelLabel } from './channel-label';

const LOCALES = [
  ['en-US', enCommon],
  ['es-419', esCommon],
  ['pt-BR', ptCommon],
] as const;

describe.each(LOCALES)('channelLabel in %s', (locale, common) => {
  it('ShouldHoldExactlyOneKeyPerChannelType', () => {
    expect(Object.keys(common.channels).sort()).toEqual(
      channelTypeValues.map((value) => value.toLowerCase()).sort(),
    );
  });

  it.each(channelTypeValues)(
    'ShouldLabel %s from the locale file, in both casings',
    async (value) => {
      const i18n = await createLocaleI18n(locale);
      const t = i18n.getFixedT(locale, 'common');
      const expected = common.channels[value.toLowerCase() as keyof typeof common.channels];
      expect(expected).toBeTruthy();
      expect(channelLabel(t, value)).toBe(expected);
      expect(channelLabel(t, value.toLowerCase())).toBe(expected);
    },
  );

  it('ShouldLookInCommon_WhenTheTranslatorIsBoundToAnotherNamespace', async () => {
    const i18n = await createLocaleI18n(locale);
    const t = i18n.getFixedT(locale, 'agent');
    expect(channelLabel(t, 'WebChat')).toBe(common.channels.webchat);
  });

  it.each(['CarrierPigeon', 'Pager.Beta', 'Fax:Legacy', 'constructor', '__proto__', ''])(
    'ShouldShowTheValueAsItCame_WhenNoKeyHolds %j',
    async (value) => {
      const i18n = await createLocaleI18n(locale);
      expect(channelLabel(i18n.getFixedT(locale, 'common'), value)).toBe(value);
    },
  );

  // An SSE payload is parsed unchecked, and a throw here would drop the whole handler.
  it.each([null, undefined])('ShouldShowNothing_WhenThePayloadHasNoChannel %j', async (value) => {
    const i18n = await createLocaleI18n(locale);
    expect(channelLabel(i18n.getFixedT(locale, 'common'), value)).toBe('');
  });
});
