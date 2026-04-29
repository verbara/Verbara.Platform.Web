import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LanguageSwitcher } from './language-switcher';

const changeLanguageMock = vi.fn();
let mockResolvedLanguage = 'es-419';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const table: Record<string, string> = {
        'language.label': 'Idioma',
        'language.es-419': 'Español (Latinoamérica)',
        'language.en-US': 'Inglés (EE.UU.)',
        'language.pt-BR': 'Portugués (Brasil)',
      };
      return table[key] ?? fallback ?? key;
    },
    i18n: {
      get resolvedLanguage() {
        return mockResolvedLanguage;
      },
      get language() {
        return mockResolvedLanguage;
      },
      changeLanguage: changeLanguageMock,
    },
  }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    changeLanguageMock.mockReset();
    mockResolvedLanguage = 'es-419';
  });

  it('Renders_InlineVariant_WithCurrentLanguageShortCode', () => {
    render(<LanguageSwitcher variant="inline" />);
    const trigger = screen.getByTestId('language-switcher-inline');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('ES');
  });

  it('Renders_IconVariant_WithLanguageAriaLabel', () => {
    render(<LanguageSwitcher variant="icon" />);
    const trigger = screen.getByTestId('language-switcher-icon');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-label', 'Idioma');
  });

  it('Defaults_ToInlineVariant_WhenVariantOmitted', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByTestId('language-switcher-inline')).toBeInTheDocument();
  });

  it('FallsBack_ToFirstOption_WhenLanguageUnknown', () => {
    mockResolvedLanguage = 'fr-FR';
    render(<LanguageSwitcher variant="inline" />);
    expect(screen.getByTestId('language-switcher-inline')).toHaveTextContent('ES');
  });

  it('Resolves_ToOption_WhenLanguageMatchesPrefix', () => {
    mockResolvedLanguage = 'en';
    render(<LanguageSwitcher variant="inline" />);
    expect(screen.getByTestId('language-switcher-inline')).toHaveTextContent('EN');
  });

  it('CallsChangeLanguage_WhenOptionClicked', () => {
    render(<LanguageSwitcher variant="icon" />);
    fireEvent.click(screen.getByTestId('language-switcher-icon'));
    const enOption = screen.getByTestId('language-option-en-US');
    fireEvent.click(enOption);
    expect(changeLanguageMock).toHaveBeenCalledWith('en-US');
  });
});
