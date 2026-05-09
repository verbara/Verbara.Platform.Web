import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import type { ReactNode } from 'react';
import { PreChatForm } from './pre-chat-form';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'webchat',
      ns: ['webchat'],
      resources: {
        'en-US': {
          webchat: {
            preChat: {
              title: 'Start a conversation',
              subtitle: 'Tell us…',
              name: 'Your name',
              namePlaceholder: 'Jane',
              email: 'Email',
              emailPlaceholder: 'you@x',
              submit: 'Start chat',
              validation: {
                nameRequired: 'Name required',
                emailRequired: 'Email required',
                emailInvalid: 'Invalid email',
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

describe('PreChatForm', () => {
  it('Renders_NameAndEmailFields', () => {
    render(wrap(<PreChatForm onSubmit={vi.fn()} />));
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('Submit_BlankFields_ShowsValidationErrors', async () => {
    render(wrap(<PreChatForm onSubmit={vi.fn()} />));
    fireEvent.click(screen.getByRole('button', { name: /start chat/i }));
    await waitFor(() => {
      expect(screen.getByText(/name required/i)).toBeInTheDocument();
      expect(screen.getByText(/email required/i)).toBeInTheDocument();
    });
  });

  it('Submit_ValidValues_CallsOnSubmit', async () => {
    const onSubmit = vi.fn();
    render(wrap(<PreChatForm onSubmit={onSubmit} />));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: /start chat/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Jane', email: 'jane@x.com' }),
    );
  });

  it('Submit_InvalidEmail_ShowsValidationError', async () => {
    render(wrap(<PreChatForm onSubmit={vi.fn()} />));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /start chat/i }));
    await waitFor(() => expect(screen.getByText(/invalid email/i)).toBeInTheDocument());
  });
});
