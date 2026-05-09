import { vi } from 'vitest';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 80,
        size: 80,
      })),
    getTotalSize: () => count * 80,
    scrollToIndex: () => {},
    measureElement: () => {},
  }),
}));

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

  it('Renders1000Messages_WithoutJank', () => {
    const big: ChatMessage[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `m${i}`,
      text: `Message ${i}`,
      from: i % 2 === 0 ? ('visitor' as const) : ('agent' as const),
      timestamp: '2026-05-09T10:00:00Z',
    }));
    const start = performance.now();
    render(
      <I18nextProvider i18n={i18n}>
        <MessageList messages={big} />
      </I18nextProvider>,
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(2000); // generous; real virtualizer handles this much faster
  });
});
