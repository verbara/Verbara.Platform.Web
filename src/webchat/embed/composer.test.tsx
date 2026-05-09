import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { Composer } from './composer';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'webchat',
      ns: ['webchat'],
      resources: {
        'en-US': {
          webchat: {
            composer: { placeholder: 'Type…', send: 'Send', sendAriaLabel: 'Send message' },
          },
        },
      },
    });
  }
});

describe('Composer', () => {
  it('CallsOnSend_OnEnter', () => {
    const onSend = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <Composer onSend={onSend} />
      </I18nextProvider>,
    );
    const ta = screen.getByPlaceholderText(/type/i) as HTMLTextAreaElement;
    fireEvent.change(ta, { target: { value: 'hi' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('hi');
  });

  it('Enter_WithShift_DoesNotSend', () => {
    const onSend = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <Composer onSend={onSend} />
      </I18nextProvider>,
    );
    const ta = screen.getByPlaceholderText(/type/i);
    fireEvent.change(ta, { target: { value: 'hi' } });
    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('SendButton_Disabled_WhenEmpty', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <Composer onSend={vi.fn()} />
      </I18nextProvider>,
    );
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });
});
