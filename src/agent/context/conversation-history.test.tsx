import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useConversationStore } from '@/agent/stores/conversation-store';
import type { ContactConversation } from '@/core/api/hooks/use-contacts';
import type { Conversation } from '@/core/api/hooks/use-conversations';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import { ConversationHistory } from './conversation-history';

/**
 * The contact's past conversations name each channel through the one keyed set
 * `common:channels.*` (change `agent-console-contract-debt`, spec `agent-console-localization`,
 * "Channel names SHALL come from one keyed set"). `GET /api/v1/contacts/{id}/conversations` is read
 * as sent, so the channel arrives PascalCase.
 */

const { scene } = vi.hoisted(() => ({
  scene: { lng: 'es-419' as 'en-US' | 'es-419', history: [] as ContactConversation[] },
}));

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  const { createLocaleI18n } = await import('@/test/locale-i18n');
  const i18n = await createLocaleI18n('es-419');
  return {
    ...actual,
    useTranslation: () => ({
      t: i18n.getFixedT(scene.lng, 'agent'),
      i18n: { ...i18n, language: scene.lng },
    }),
  };
});
vi.mock('@/core/api/hooks/use-contacts', () => ({
  useContactConversations: () => ({ data: scene.history }),
}));

function item(id: string, channel: string): ContactConversation {
  return { id, channel, queueName: 'Support', createdAt: '2026-10-12T10:00:00Z' };
}

function renderHistory(...items: ContactConversation[]) {
  scene.history = items;
  const selected = { id: 'conv-1', contactId: 'contact-1' } as Conversation;
  useConversationStore.setState({ selectedId: 'conv-1', conversations: { 'conv-1': selected } });
  render(<ConversationHistory />);
}

describe('ConversationHistory channel names', () => {
  afterEach(() => {
    cleanup();
    scene.lng = 'es-419';
  });

  it('ConversationHistory_ShouldNameEachChannelThroughTheKeyedSet_InEs419', () => {
    renderHistory(item('h-1', 'WebChat'), item('h-2', 'Voice'), item('h-3', 'Instagram'));

    expect(screen.getByText(esCommon.channels.webchat)).toBeInTheDocument();
    expect(screen.getByText(esCommon.channels.voice)).toBeInTheDocument();
    expect(screen.getByText(esCommon.channels.instagram)).toBeInTheDocument();
  });

  it('ConversationHistory_ShouldUseTheSameLabelAsTheRestOfTheConsole_InEnUs', () => {
    scene.lng = 'en-US';
    renderHistory(item('h-1', 'WebChat'));

    expect(screen.getByText(enCommon.channels.webchat)).toBeInTheDocument();
  });

  it('ConversationHistory_ShouldShowTheChannelAsItCame_WhenItHasNoKey', () => {
    renderHistory(item('h-1', 'Pigeon'));

    expect(screen.getByText('Pigeon')).toBeInTheDocument();
  });
});
