import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useRef } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { PrintButton } from './print-button';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      fallbackLng: 'en-US',
      defaultNS: 'common',
      ns: ['common'],
      resources: {
        'en-US': {
          common: {
            print: { button: 'Print', buttonAriaLabel: 'Print this page' },
          },
        },
      },
    });
  }
});

function Harness({
  onBeforePrint,
  onAfterPrint,
}: {
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <I18nextProvider i18n={i18n}>
      <div ref={ref}>content</div>
      <PrintButton
        contentRef={ref}
        documentTitle="test-doc"
        onBeforePrint={onBeforePrint}
        onAfterPrint={onAfterPrint}
      />
    </I18nextProvider>
  );
}

describe('PrintButton', () => {
  it('Renders_ButtonWithI18nLabel', () => {
    render(<Harness />);
    const btn = screen.getByRole('button', { name: /print this page/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent('Print');
  });

  it('CallsOnBeforePrint_OnClick', async () => {
    const onBefore = vi.fn();
    vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<Harness onBeforePrint={onBefore} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(onBefore).toHaveBeenCalled());
  });

  it('Has_DataPrintHide_Attribute', () => {
    render(<Harness />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-print', 'hide');
  });
});
