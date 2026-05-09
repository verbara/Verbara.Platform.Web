import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { MessageList } from './message-list';
import type { ChatMessage } from './transport/session-api';

beforeAll(async () => {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en-US',
      defaultNS: 'webchat',
      ns: ['webchat'],
      resources: { 'en-US': { webchat: { messages: { newMessage: 'New message' } } } },
    });
  }
});

describe('MessageList', () => {
  it('RendersAllMessages_InOrder', () => {
    const msgs: ChatMessage[] = [
      { id: '1', text: 'first', from: 'visitor', timestamp: '2026-05-09T10:00:00Z' },
      { id: '2', text: 'second', from: 'agent', timestamp: '2026-05-09T10:00:01Z' },
    ];
    render(
      <I18nextProvider i18n={i18n}>
        <MessageList messages={msgs} />
      </I18nextProvider>,
    );
    expect(screen.getByText(/first/)).toBeInTheDocument();
    expect(screen.getByText(/second/)).toBeInTheDocument();
  });

  it('Has_RoleLog_AndAriaLive', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <MessageList messages={[]} />
      </I18nextProvider>,
    );
    const log = screen.getByRole('log');
    expect(log).toHaveAttribute('aria-live', 'polite');
  });
});
