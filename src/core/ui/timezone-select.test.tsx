import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { useState, type ReactNode } from 'react';
import { TimezoneSelect } from './timezone-select';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      resources: {
        'en-US': {
          common: {
            timezone: {
              autoDetect: 'Auto-detected ({{zone}})',
              search: 'Search timezones',
              region: {
                Africa: 'Africa',
                America: 'Americas',
                Antarctica: 'Antarctica',
                Arctic: 'Arctic',
                Asia: 'Asia',
                Atlantic: 'Atlantic',
                Australia: 'Australia',
                Europe: 'Europe',
                Indian: 'Indian Ocean',
                Pacific: 'Pacific',
                UTC: 'UTC',
              },
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

describe('TimezoneSelect', () => {
  it('Renders_AsCombobox_WithIanaZones', () => {
    function H() {
      const [val, setVal] = useState('America/New_York');
      return <TimezoneSelect value={val} onChange={setVal} />;
    }
    render(wrap(<H />));
    const sel = screen.getByRole('combobox');
    expect(sel).toBeInTheDocument();
    expect(sel.innerHTML).toMatch(/America\//);
  });

  it('CallsOnChange_WithSelectedZone', () => {
    const onChange = vi.fn();
    function H() {
      const [val, setVal] = useState('America/New_York');
      return (
        <TimezoneSelect
          value={val}
          onChange={(z) => {
            setVal(z);
            onChange(z);
          }}
        />
      );
    }
    render(wrap(<H />));
    const sel = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'Europe/Madrid' } });
    expect(onChange).toHaveBeenCalledWith('Europe/Madrid');
  });

  it('AutoDetect_SetsBrowserZone_WhenValueEmpty_AndAutoDetectTrue', () => {
    const onChange = vi.fn();
    function H() {
      const [val, setVal] = useState('');
      return (
        <TimezoneSelect
          value={val}
          onChange={(z) => {
            setVal(z);
            onChange(z);
          }}
          autoDetect
        />
      );
    }
    render(wrap(<H />));
    expect(onChange).toHaveBeenCalled();
    const captured = onChange.mock.calls[0]?.[0];
    expect(typeof captured).toBe('string');
    expect((captured as string).length).toBeGreaterThan(0);
  });
});
