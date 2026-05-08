import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { Label } from './label';

void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: ['common'],
  resources: { en: { common: { a11y: { required: 'required' } } } },
});

describe('Label required prop', () => {
  it('DoesNotRender_Asterisk_WhenRequiredFalse', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <Label htmlFor="x">Email</Label>
      </I18nextProvider>,
    );
    expect(container.textContent).toBe('Email');
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it('Renders_VisibleAsterisk_AndSrOnlyRequired_WhenRequired', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <Label htmlFor="x" required>
          Email
        </Label>
      </I18nextProvider>,
    );
    const asterisk = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(asterisk).not.toBeNull();
    expect(asterisk.textContent).toBe('*');
    const srOnly = container.querySelector('.sr-only') as HTMLElement;
    expect(srOnly).not.toBeNull();
    expect(srOnly.textContent).toBe('required');
  });
});
