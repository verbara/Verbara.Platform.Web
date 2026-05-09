import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { useState, type ReactNode } from 'react';
import { PhoneInput } from './phone-input';

vi.mock('@/core/i18n/phone-engine', () => ({
  AsYouType: class FakeAsYouType {
    constructor(_country: string) {}
    input(s: string) {
      return s;
    }
  },
  parsePhoneNumber: (raw: string) => ({
    formatInternational: () => raw,
    formatNational: () => raw,
    country: 'US',
    format: () => raw,
  }),
  isValidPhoneNumber: (raw: string) => /^\+\d{10,}$/.test(raw),
}));

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      resources: {
        'en-US': {
          common: {
            phone: {
              placeholder: '+1 (555) 555-0100',
              ariaLabel: 'Phone number',
              invalidFormat: 'Invalid phone number',
            },
          },
        },
      },
    });
  }
});

function wrap(ui: ReactNode) {
  return <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;
}

function Harness({ initial = '' }: { initial?: string }) {
  const [val, setVal] = useState(initial);
  return <PhoneInput value={val} onChange={setVal} data-testid="phone" />;
}

describe('PhoneInput', () => {
  it('Renders_InputTypeTel_WithI18nPlaceholder', () => {
    render(wrap(<Harness />));
    const input = screen.getByTestId('phone') as HTMLInputElement;
    expect(input.type).toBe('tel');
    expect(input.placeholder).toBe('+1 (555) 555-0100');
  });

  it('CallsOnChange_WhenUserTypes', async () => {
    const onChange = vi.fn();
    function Wrapped() {
      const [val, setVal] = useState('');
      return (
        <PhoneInput
          value={val}
          onChange={(v) => {
            setVal(v);
            onChange(v);
          }}
          data-testid="phone"
        />
      );
    }
    render(wrap(<Wrapped />));
    const input = screen.getByTestId('phone') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '+19255550100' } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('+19255550100'));
  });

  it('HasI18nAriaLabel', () => {
    render(wrap(<Harness />));
    const input = screen.getByLabelText(/phone number/i);
    expect(input).toBeInTheDocument();
  });

  it('Honors_DefaultCountry_Prop', () => {
    function H() {
      const [val, setVal] = useState('');
      return <PhoneInput value={val} onChange={setVal} defaultCountry="MX" data-testid="phone" />;
    }
    render(wrap(<H />));
    expect(screen.getByTestId('phone')).toHaveAttribute('data-default-country', 'MX');
  });
});
