/**
 * The body of the anonymous branding routes, parsed (design D2) with the safety rules of design D5
 * (spec `console-tenant-branding`, "Blank brand values keep the defaults" and "A script address and
 * a style injection are dropped").
 */
import { describe, expect, it } from 'vitest';
import { parsePublicBranding, type PublicBrandingDto } from './public-branding';

const EMPTY: PublicBrandingDto = {
  displayName: null,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: null,
  secondaryColor: null,
  accentColor: null,
  locale: null,
  timezone: null,
};

describe('parsePublicBranding', () => {
  it('parsePublicBranding_ShouldKeepEveryField_WhenTheBodyIsAFullSafeBrand', () => {
    const body = {
      displayName: 'Acme',
      logoUrl: 'https://cdn.example/acme.png',
      faviconUrl: '/favicon-acme.svg',
      primaryColor: '#336699',
      secondaryColor: '#123',
      accentColor: '#abcdef80',
      locale: 'es-419',
      timezone: 'America/Bogota',
    };

    expect(parsePublicBranding(body)).toEqual(body);
  });

  it.each([null, undefined, 'Acme', 42, true, ['Acme']])(
    'parsePublicBranding_ShouldReturnNull_WhenTheBodyIsNotAnObject %s',
    (body) => {
      expect(parsePublicBranding(body)).toBeNull();
    },
  );

  /**
   * The generated `PublicBrandingDto` lists all eight fields as required, but the Platform omits a
   * field with no value (`WhenWritingNull`): a missing key reads exactly like `null`.
   */
  it('parsePublicBranding_ShouldReadEveryFieldAsNull_WhenTheBodyIsAnEmptyObject', () => {
    const parsed: PublicBrandingDto | null = parsePublicBranding({});

    expect(parsed).toEqual(EMPTY);
  });

  it('parsePublicBranding_ShouldReadTheOmittedFieldsAsNull_WhenTheBodyCarriesOnlyTheDisplayName', () => {
    const parsed: PublicBrandingDto | null = parsePublicBranding({ displayName: 'Acme' });

    expect(parsed).toEqual({ ...EMPTY, displayName: 'Acme' });
  });

  it('parsePublicBranding_ShouldDropAField_WhenItIsNotAString', () => {
    expect(
      parsePublicBranding({ displayName: 7, logoUrl: { href: 'https://x' }, primaryColor: null }),
    ).toEqual(EMPTY);
  });

  it('parsePublicBranding_ShouldIgnoreUnknownFields_WhenTheBodyCarriesThem', () => {
    expect(parsePublicBranding({ displayName: 'Acme', css: 'body{display:none}' })).toEqual({
      ...EMPTY,
      displayName: 'Acme',
    });
  });

  describe('blank values (spec "Blank brand values keep the defaults")', () => {
    it.each(['', '   ', '\t\n'])(
      'parsePublicBranding_ShouldDropTheLogo_WhenItIsBlank %j',
      (blank) => {
        expect(parsePublicBranding({ logoUrl: blank })?.logoUrl).toBeNull();
      },
    );

    it.each(['', '   ', '\t\n'])(
      'parsePublicBranding_ShouldDropTheFavicon_WhenItIsBlank %j',
      (blank) => {
        expect(parsePublicBranding({ faviconUrl: blank })?.faviconUrl).toBeNull();
      },
    );

    it.each(['', '   ', '\t\n'])(
      'parsePublicBranding_ShouldDropTheDisplayName_WhenItIsBlank %j',
      (blank) => {
        expect(parsePublicBranding({ displayName: blank })?.displayName).toBeNull();
      },
    );

    it.each(['', ' ', '\t\n'])(
      'parsePublicBranding_ShouldDropThePrimaryColour_WhenItIsBlank %j',
      (blank) => {
        expect(parsePublicBranding({ primaryColor: blank })?.primaryColor).toBeNull();
      },
    );
  });

  describe('unsafe values (spec "A script address and a style injection are dropped")', () => {
    it('parsePublicBranding_ShouldDropTheLogo_WhenItIsAJavascriptAddress', () => {
      expect(parsePublicBranding({ logoUrl: 'javascript:alert(1)' })?.logoUrl).toBeNull();
    });

    it('parsePublicBranding_ShouldDropTheLogo_WhenItIsPlainHttpOnAnotherOrigin', () => {
      expect(parsePublicBranding({ logoUrl: 'http://cdn.example/acme.png' })?.logoUrl).toBeNull();
    });

    it('parsePublicBranding_ShouldDropTheFavicon_WhenItIsADataAddress', () => {
      expect(
        parsePublicBranding({ faviconUrl: 'data:image/svg+xml,<svg/>' })?.faviconUrl,
      ).toBeNull();
    });

    it('parsePublicBranding_ShouldKeepTheLogo_WhenItIsASameOriginPath', () => {
      expect(parsePublicBranding({ logoUrl: '/icons.svg' })?.logoUrl).toBe('/icons.svg');
    });

    it('parsePublicBranding_ShouldKeepTheLogo_WhenItIsHttpsOnAnotherOrigin', () => {
      expect(parsePublicBranding({ logoUrl: 'https://cdn.example/acme.png' })?.logoUrl).toBe(
        'https://cdn.example/acme.png',
      );
    });

    it.each(['red;}body{display:none', 'rgb(0,0,0)', '#12', 'red', '#12345', '#ggg', ' #336699'])(
      'parsePublicBranding_ShouldDropThePrimaryColour_WhenItIsNotAHexColour %s',
      (colour) => {
        expect(parsePublicBranding({ primaryColor: colour })?.primaryColor).toBeNull();
      },
    );

    it.each(['#336699', '#369f', '#369', '#336699CC', '#ABCDEF'])(
      'parsePublicBranding_ShouldKeepThePrimaryColour_WhenItIsAHexColour %s',
      (colour) => {
        expect(parsePublicBranding({ primaryColor: colour })?.primaryColor).toBe(colour);
      },
    );

    it('parsePublicBranding_ShouldKeepTheDisplayNameVerbatim_WhenItHoldsMarkup', () => {
      expect(parsePublicBranding({ displayName: '<b>Acme</b>' })?.displayName).toBe('<b>Acme</b>');
    });
  });
});
