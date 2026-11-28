import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18n } from 'i18next';
import { TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import { SuggestionBanner } from './suggestion-banner';
import { useAgentAiStore, type AgentSuggestion } from '@/core/stores/agent-ai-store';

const makeSuggestion = (overrides: Partial<AgentSuggestion> = {}): AgentSuggestion => ({
  id: 'sug-1',
  text: 'Offer the retention discount',
  priority: 'Important',
  source: 'KnowledgeBase',
  timestamp: '2026-05-31T10:00:00Z',
  ...overrides,
});

const whisper = (id: string, text = `whisper ${id}`) =>
  makeSuggestion({ id, text, source: 'Supervisor', priority: 'Critical' });
const keyword = (id: string) => makeSuggestion({ id, text: `keyword ${id}`, source: 'Keyword' });

const CONV = 'conv-A';
const add = (s: AgentSuggestion) => act(() => useAgentAiStore.getState().addSuggestion(CONV, s));

async function renderBanner(lng: TestLocale = 'en-US', conversationId = CONV): Promise<I18n> {
  const i18n = await createLocaleI18n(lng);
  render(
    <I18nextProvider i18n={i18n}>
      <SuggestionBanner conversationId={conversationId} />
    </I18nextProvider>,
  );
  return i18n;
}

const shownIds = () =>
  screen.queryAllByTestId('suggestion-item').map((el) => el.getAttribute('data-suggestion-id'));
const item = (id: string) =>
  screen
    .queryAllByTestId('suggestion-item')
    .find((el) => el.getAttribute('data-suggestion-id') === id);
const hiddenLine = () => screen.queryByTestId('suggestion-hidden-count');
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const dismiss = (id: string) => fireEvent.click(within(item(id)!).getByRole('button'));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useAgentAiStore.setState({ sessions: {} });
});

describe('SuggestionBanner (per-conversation)', () => {
  it('SuggestionBanner_ShouldRenderNothing_WhenConversationHasNoSuggestions', async () => {
    useAgentAiStore.getState().addSuggestion('conv-other', makeSuggestion({ text: 'Elsewhere' }));
    await renderBanner();
    expect(screen.queryByText('Elsewhere')).toBeNull();
  });

  it('SuggestionBanner_ShouldShowOnlyOwnConversationSuggestions_WhenMultipleConversations', async () => {
    useAgentAiStore.getState().addSuggestion('conv-A', makeSuggestion({ id: 'a', text: 'For A' }));
    useAgentAiStore.getState().addSuggestion('conv-B', makeSuggestion({ id: 'b', text: 'For B' }));
    await renderBanner();
    expect(screen.getByText('For A')).toBeInTheDocument();
    expect(screen.queryByText('For B')).toBeNull();
  });
});

describe('SuggestionBanner — supervisor whispers (design D4/D5)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false, toFake: ['setTimeout', 'clearTimeout'] });
  });

  it('Banner_ShouldKeepOnlyTheWhisper_When15SecondsPassWithAKeywordItem', async () => {
    await renderBanner();
    add(whisper('w1'));
    add(keyword('k1'));
    expect(shownIds()).toEqual(['w1', 'k1']);

    advance(15_000);

    expect(shownIds()).toEqual(['w1']);
  });

  it('Banner_ShouldShowTheWhisperFirst_WhenThreeNewerKeywordItemsArrive', async () => {
    await renderBanner();
    add(whisper('w1'));
    add(keyword('k1'));
    add(keyword('k2'));
    add(keyword('k3'));

    expect(shownIds()).toEqual(['w1', 'k3', 'k2']);
  });

  it('Banner_ShouldDismissWhispersOneAtATimeBySuggestionId_WhenTwoArePending', async () => {
    await renderBanner();
    add(whisper('w1'));
    add(whisper('w2'));

    dismiss('w2');
    expect(shownIds()).toEqual(['w1']);
    dismiss('w1');
    expect(shownIds()).toEqual([]);
  });

  it('Banner_ShouldShowTheNewestThreeAndCountOne_WhenFourWhispersArePending', async () => {
    await renderBanner();
    for (const id of ['w1', 'w2', 'w3', 'w4']) add(whisper(id));

    expect(shownIds()).toEqual(['w4', 'w3', 'w2']);
    expect(hiddenLine()).toHaveAttribute('data-hidden-supervisor-count', '1');

    dismiss('w3');

    expect(shownIds()).toEqual(['w4', 'w2', 'w1']);
    expect(hiddenLine()).toBeNull();
  });

  it('Banner_ShouldShowThreeAndCountEight_WhenElevenWhispersArePending', async () => {
    await renderBanner();
    for (let i = 0; i < 11; i++) add(whisper(`w${i}`));

    expect(shownIds()).toEqual(['w10', 'w9', 'w8']);
    expect(hiddenLine()).toHaveAttribute('data-hidden-supervisor-count', '8');
  });

  it('Banner_ShouldNeverExpireAWhisper_WhenAMinutePasses', async () => {
    await renderBanner();
    add(whisper('w1'));

    advance(60_000);

    expect(shownIds()).toEqual(['w1']);
  });

  it('Banner_ShouldExpireAHiddenKeywordItem_WhenThreeWhispersHideIt', async () => {
    // Spec scenario "A suggestion hidden behind three whispers still expires".
    await renderBanner();
    add(keyword('k1'));
    for (const id of ['w1', 'w2', 'w3']) add(whisper(id));
    expect(shownIds()).toEqual(['w3', 'w2', 'w1']);

    advance(15_000);
    dismiss('w2');

    expect(shownIds()).toEqual(['w3', 'w1']);
    expect(item('k1')).toBeUndefined();
  });

  it('Banner_ShouldKeepTodaysFirstThreeTimers_WhenNoWhisperIsPending', async () => {
    await renderBanner();
    for (const id of ['k1', 'k2', 'k3', 'k4']) add(keyword(id));
    expect(shownIds()).toEqual(['k4', 'k3', 'k2']);

    advance(15_000);
    // k4, k3, k2 expired; k1 entered the first three only now, so its timer starts now.
    expect(shownIds()).toEqual(['k1']);
    advance(14_999);
    expect(shownIds()).toEqual(['k1']);
    advance(1);
    expect(shownIds()).toEqual([]);
  });

  it('Banner_ShouldExposeSourceAndPriorityAndTheTextAlone_WhenAWhisperIsShown', async () => {
    await renderBanner();
    add(whisper('w1', 'Offer the retention discount now.'));

    const el = item('w1')!;
    expect(el).toHaveAttribute('data-suggestion-source', 'Supervisor');
    expect(el).toHaveAttribute('data-suggestion-priority', 'Critical');
    expect(within(el).getByTestId('suggestion-text')).toHaveTextContent(
      /^Offer the retention discount now\.$/,
    );
    expect(within(el).getByTestId('suggestion-source-label')).toBeVisible();
  });

  it('Banner_ShouldKeepTheRawSourceText_WhenTheSourceIsNotSupervisor', async () => {
    await renderBanner();
    add(keyword('k1'));

    expect(within(item('k1')!).getByTestId('suggestion-source-label')).toHaveTextContent(
      /^Keyword$/,
    );
  });
});

describe.each(TEST_LOCALES)('SuggestionBanner labels in %s', (lng) => {
  it('Banner_ShouldTranslateTheSupervisorLabelAndTheHiddenLine_WhenTheLocaleIs', async () => {
    const i18n = await renderBanner(lng);
    for (const id of ['w1', 'w2', 'w3', 'w4']) add(whisper(id));

    const label = within(item('w4')!).getByTestId('suggestion-source-label');
    expect(label.textContent).toBe(i18n.t('agent:ai.source_supervisor'));
    expect(label.textContent).not.toBe('ai.source_supervisor');
    const line = hiddenLine()!;
    expect(line.textContent).toBe(i18n.t('agent:ai.more_from_supervisor', { count: 1 }));
    expect(line.textContent).toContain('1');
    expect(line.textContent).not.toContain('more_from_supervisor');
  });
});
