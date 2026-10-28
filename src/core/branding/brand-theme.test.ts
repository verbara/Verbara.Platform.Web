/**
 * The theme layer (design D5): the favicon and the five Tailwind 4 brand properties, painted inline
 * on the document root and restored by a reset.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BRAND_CSS_PROPERTIES,
  applyBrandTheme,
  brandForeground,
  resetBrandTheme,
} from './brand-theme';
import type { PublicBranding } from './public-branding';

function brand(fields: Partial<PublicBranding>): PublicBranding {
  return {
    displayName: null,
    logoUrl: null,
    faviconUrl: null,
    primaryColor: null,
    secondaryColor: null,
    accentColor: null,
    locale: null,
    timezone: null,
    ...fields,
  };
}

function icon(): HTMLLinkElement {
  const link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) throw new Error('no favicon link');
  return link;
}

const rootStyle = () => document.documentElement.style;

beforeEach(() => {
  document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />';
});

afterEach(() => {
  resetBrandTheme();
  document.head.innerHTML = '';
});

describe('applyBrandTheme', () => {
  it('applyBrandTheme_ShouldSetTheFaviconAndDropItsType_WhenTheBrandHasOne', () => {
    applyBrandTheme(brand({ faviconUrl: 'https://cdn.example/acme.ico' }));

    expect(icon().getAttribute('href')).toBe('https://cdn.example/acme.ico');
    expect(icon().hasAttribute('type')).toBe(false);
  });

  it('applyBrandTheme_ShouldSetTheFiveBrandProperties_WhenTheBrandHasAPrimaryColour', () => {
    applyBrandTheme(brand({ primaryColor: '#336699' }));

    expect(rootStyle().getPropertyValue('--color-brand')).toBe('#336699');
    expect(rootStyle().getPropertyValue('--color-brand-light')).toBe(
      'color-mix(in oklab, #336699 80%, white)',
    );
    expect(rootStyle().getPropertyValue('--color-brand-dark')).toBe(
      'color-mix(in oklab, #336699 80%, black)',
    );
    expect(rootStyle().getPropertyValue('--color-rail-active-border')).toBe('#336699');
    expect(rootStyle().getPropertyValue('--color-brand-foreground')).toBe('#ffffff');
  });

  it('applyBrandTheme_ShouldLeaveTheDefaults_WhenTheBrandSetsNeitherFaviconNorColour', () => {
    applyBrandTheme(brand({ displayName: 'Acme' }));

    expect(icon().getAttribute('href')).toBe('/favicon.svg');
    expect(icon().getAttribute('type')).toBe('image/svg+xml');
    for (const property of BRAND_CSS_PROPERTIES) {
      expect(rootStyle().getPropertyValue(property)).toBe('');
    }
  });

  it('applyBrandTheme_ShouldRestoreTheDefaultFavicon_WhenANewBrandHasNone', () => {
    applyBrandTheme(brand({ faviconUrl: '/acme.svg', primaryColor: '#336699' }));
    applyBrandTheme(brand({ displayName: 'Globex' }));

    expect(icon().getAttribute('href')).toBe('/favicon.svg');
    expect(icon().getAttribute('type')).toBe('image/svg+xml');
    expect(rootStyle().getPropertyValue('--color-brand')).toBe('');
  });
});

describe('brandForeground', () => {
  it('brandForeground_ShouldPickWhite_WhenThePrimaryIsBlack', () => {
    expect(brandForeground('#000000')).toBe('#ffffff');
  });

  it('brandForeground_ShouldPickSlate_WhenThePrimaryIsWhite', () => {
    expect(brandForeground('#ffffff')).toBe('#0f172a');
  });

  it('brandForeground_ShouldReadShortAndAlphaForms_WhenGivenThem', () => {
    expect(brandForeground('#fff')).toBe('#0f172a');
    expect(brandForeground('#000f')).toBe('#ffffff');
    expect(brandForeground('#FFFFFF80')).toBe('#0f172a');
  });
});

describe('resetBrandTheme', () => {
  it('resetBrandTheme_ShouldRestoreTheOriginalFaviconAndRemoveTheFiveProperties_WhenABrandWasApplied', () => {
    applyBrandTheme(brand({ faviconUrl: '/acme.svg', primaryColor: '#ffffff' }));
    expect(rootStyle().getPropertyValue('--color-brand-foreground')).toBe('#0f172a');

    resetBrandTheme();

    expect(icon().getAttribute('href')).toBe('/favicon.svg');
    expect(icon().getAttribute('type')).toBe('image/svg+xml');
    expect(BRAND_CSS_PROPERTIES).toHaveLength(5);
    for (const property of BRAND_CSS_PROPERTIES) {
      expect(rootStyle().getPropertyValue(property)).toBe('');
    }
  });

  it('resetBrandTheme_ShouldRestoreAMissingType_WhenTheOriginalIconHadNone', () => {
    document.head.innerHTML = '<link rel="icon" href="/favicon.ico" />';

    applyBrandTheme(brand({ faviconUrl: '/acme.svg' }));
    resetBrandTheme();

    expect(icon().getAttribute('href')).toBe('/favicon.ico');
    expect(icon().hasAttribute('type')).toBe(false);
  });

  it('resetBrandTheme_ShouldDoNothing_WhenNoBrandWasApplied', () => {
    resetBrandTheme();

    expect(icon().getAttribute('href')).toBe('/favicon.svg');
    expect(icon().getAttribute('type')).toBe('image/svg+xml');
  });
});
