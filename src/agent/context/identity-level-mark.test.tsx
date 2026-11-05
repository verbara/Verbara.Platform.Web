import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TEST_LOCALES, type TestLocale } from '@/test/locale-i18n';
import enAgent from '../../../public/locales/en-US/agent.json';
import esAgent from '../../../public/locales/es-419/agent.json';
import ptAgent from '../../../public/locales/pt-BR/agent.json';
import { IdentityLevelMark } from './identity-level-mark';

/**
 * The mark against the committed locale files (W7, round-1 audit F3): an empty chip, or a label fixed in
 * one language, fails in at least two locales. There is no fallback language in `createLocaleI18n`.
 */

const { scene } = vi.hoisted(() => ({ scene: { lng: 'en-US' as TestLocale } }));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('es-419');
  return {
    ...actual,
    useTranslation: () => ({ t: i18n.getFixedT(scene.lng, 'agent'), i18n }),
  };
});

const AGENT = { 'en-US': enAgent, 'es-419': esAgent, 'pt-BR': ptAgent } as const;
const LEVELS = [
  ['Unverified', 'unverified', 'unverified_hint'],
  ['Verified', 'verified', 'verified_hint'],
] as const;

const marks = () => document.querySelectorAll('[data-identity-level]');

describe('IdentityLevelMark', () => {
  beforeEach(() => {
    scene.lng = 'en-US';
  });

  afterEach(() => {
    cleanup();
  });

  describe.each(TEST_LOCALES)('in %s', (locale) => {
    it.each(LEVELS)(
      'IdentityLevelMark_ShouldShowTheLocaleTextAndName_When%s',
      (level, textKey, hintKey) => {
        scene.lng = locale;
        const { identity } = AGENT[locale];

        render(<IdentityLevelMark identityLevel={level} />);

        const mark = document.querySelector(`[data-identity-level="${level}"]`);
        expect(identity[textKey]).toBeTruthy();
        expect(identity[hintKey]).toBeTruthy();
        expect(mark?.textContent).toBe(identity[textKey]);
        expect(mark).toHaveAccessibleName(identity[hintKey]);
        expect(marks()).toHaveLength(1);
      },
    );
  });

  it.each(['unverified', 'unverified_hint', 'verified', 'verified_hint'] as const)(
    'Locales_ShouldDifferPairwise_ForKey_%s',
    (key) => {
      const values = TEST_LOCALES.map((locale) => AGENT[locale].identity[key]);
      expect(new Set(values).size).toBe(TEST_LOCALES.length);
    },
  );

  it('IdentityLevelMark_ShouldBeReachableByRole_WithTheLocaleName', () => {
    scene.lng = 'pt-BR';
    render(<IdentityLevelMark identityLevel="Unverified" />);
    expect(screen.getByRole('img', { name: ptAgent.identity.unverified_hint })).toBeInTheDocument();
  });

  it.each([
    ['Anonymous', 'Anonymous'],
    ['absent', undefined],
    ['an unknown string', 'Trusted'],
    ['another casing', 'verified'],
    ['a name every object inherits', 'constructor'],
    ['empty', ''],
  ])('IdentityLevelMark_ShouldRenderNothing_When %s', (_name, level) => {
    const { container } = render(<IdentityLevelMark identityLevel={level} />);
    expect(marks()).toHaveLength(0);
    expect(container).toBeEmptyDOMElement();
  });
});
