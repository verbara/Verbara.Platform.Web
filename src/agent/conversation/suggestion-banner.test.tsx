import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { SuggestionBanner } from './suggestion-banner';
import { useAgentAiStore, AgentSuggestion } from '@/core/stores/agent-ai-store';

const makeSuggestion = (overrides: Partial<AgentSuggestion> = {}): AgentSuggestion => ({
  id: 'sug-1',
  text: 'Offer the retention discount',
  priority: 'Important',
  source: 'KnowledgeBase',
  timestamp: '2026-05-31T10:00:00Z',
  ...overrides,
});

describe('SuggestionBanner (per-conversation)', () => {
  afterEach(() => {
    useAgentAiStore.setState({ sessions: {} });
  });

  it('SuggestionBanner_ShouldRenderNothing_WhenConversationHasNoSuggestions', () => {
    useAgentAiStore.getState().addSuggestion('conv-other', makeSuggestion({ text: 'Elsewhere' }));
    render(<SuggestionBanner conversationId="conv-A" />);
    expect(screen.queryByText('Elsewhere')).toBeNull();
  });

  it('SuggestionBanner_ShouldShowOnlyOwnConversationSuggestions_WhenMultipleConversations', () => {
    useAgentAiStore.getState().addSuggestion('conv-A', makeSuggestion({ id: 'a', text: 'For A' }));
    useAgentAiStore.getState().addSuggestion('conv-B', makeSuggestion({ id: 'b', text: 'For B' }));
    render(<SuggestionBanner conversationId="conv-A" />);
    expect(screen.getByText('For A')).toBeInTheDocument();
    expect(screen.queryByText('For B')).toBeNull();
  });
});
