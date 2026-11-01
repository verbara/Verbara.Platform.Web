import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConversationStore } from '@/agent/stores/conversation-store';
import type { Conversation } from '@/core/api/hooks/use-conversations';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import { ConversationPanel } from './conversation-panel';

/**
 * The header badge names the channel through the one keyed set `common:channels.*` (change
 * `agent-console-contract-debt`, spec `agent-console-localization`, "Channel names SHALL come from
 * one keyed set"). Its own file because the panel's other tests run without a locale.
 */

const { scene } = vi.hoisted(() => ({ scene: { lng: 'es-419' as 'es-419' | 'pt-BR' } }));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('es-419');
  return {
    ...actual,
    useTranslation: (ns?: string | string[]) => ({
      t: i18n.getFixedT(scene.lng, Array.isArray(ns) ? ns[0] : (ns ?? 'common')),
      i18n,
    }),
  };
});
vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./message-thread', () => ({ MessageThread: () => null }));
vi.mock('./reply-composer', () => ({ ReplyComposer: () => null }));
vi.mock('./transfer-dialog', () => ({ TransferDialog: () => null }));
vi.mock('./suggestion-banner', () => ({ SuggestionBanner: () => null }));
vi.mock('./sentiment-gauge', () => ({ SentimentGauge: () => null }));
vi.mock('./compliance-alert', () => ({ ComplianceAlert: () => null }));
vi.mock('./wrap-up-dialog', () => ({ WrapUpDialog: () => null }));

function conversation(channel: string): Conversation {
  return {
    id: 'conv-1',
    contactId: 'contact-1',
    contactName: 'Ana',
    channel,
    queueName: 'Support',
    state: 'active',
    lastMessage: '',
    lastMessageAt: '2026-10-12T10:00:00Z',
    unread: false,
    assignedAt: '2026-10-12T10:00:00Z',
  };
}

function renderPanel(channel: string) {
  useConversationStore.setState({
    conversations: { 'conv-1': conversation(channel) },
    messages: {},
  });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(<ConversationPanel conversationId="conv-1" />, { wrapper });
}

describe('ConversationPanel channel badge', () => {
  afterEach(() => {
    cleanup();
    scene.lng = 'es-419';
  });

  it.each([
    ['webchat', esCommon.channels.webchat],
    ['email', esCommon.channels.email],
  ])('ConversationPanel_ShouldNameTheChannelThroughTheKeyedSet_InEs419 %s', (channel, label) => {
    renderPanel(channel);

    expect(screen.getByTestId('conversation-channel-badge')).toHaveTextContent(label);
  });

  it('ConversationPanel_ShouldNameTheChannelThroughTheKeyedSet_InPtBr', () => {
    scene.lng = 'pt-BR';
    renderPanel('email');

    expect(screen.getByTestId('conversation-channel-badge')).toHaveTextContent(
      ptCommon.channels.email,
    );
  });

  it('ConversationPanel_ShouldShowTheChannelAsItCame_WhenItHasNoKey', () => {
    renderPanel('pigeon');

    expect(screen.getByTestId('conversation-channel-badge')).toHaveTextContent('pigeon');
  });
});
