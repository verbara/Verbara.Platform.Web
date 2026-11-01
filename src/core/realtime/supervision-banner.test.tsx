import { act, cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRealtimeStore } from '@/core/stores/realtime-store';
import { createLocaleI18n } from '@/test/locale-i18n';
import { registerHandlers } from './platform-hub';
import { SupervisionBanner } from './supervision-banner';

/** The push of host fixture `supervision-started.v1.json`; its `mode` has no established wire form. */
const PUSH = {
  conversationId: '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a',
  supervisorId: '5a6b7c8d9e0f41a2b3c4d5e6f7a8b9c0',
  startedAt: '2026-10-30T15:04:05.123+00:00',
};

/** The hub's real handler over the real store: the banner reads what `OnSupervisionStarted` stored. */
function pushSupervisionStarted(mode: string) {
  const handlers = new Map<string, (payload: unknown) => void>();
  const conn = {
    on: (method: string, handler: (payload: unknown) => void) => handlers.set(method, handler),
    onreconnecting: vi.fn(),
    onreconnected: vi.fn(),
    onclose: vi.fn(),
  };
  registerHandlers(conn as never);
  act(() => handlers.get('OnSupervisionStarted')?.({ ...PUSH, mode }));
}

async function renderBanner() {
  const i18n = await createLocaleI18n('pt-BR');
  render(
    <I18nextProvider i18n={i18n}>
      <SupervisionBanner />
    </I18nextProvider>,
  );
}

describe('SupervisionBanner', () => {
  beforeEach(() => useRealtimeStore.getState().setObservedSupervision(null));

  afterEach(() => {
    cleanup();
    useRealtimeStore.getState().setObservedSupervision(null);
  });

  it('ShouldPutTheLowerCasedModeInThePtBrSentence_WhenASupervisorObserves', async () => {
    await renderBanner();

    pushSupervisionStarted('WhisperTts');

    expect(screen.getByTestId('supervision-banner').textContent).toBe(
      'Um supervisor está observando esta conversa (whispertts).',
    );
  });

  it('ShouldKeepAModeItDoesNotKnow_WhenItArrives', async () => {
    await renderBanner();

    pushSupervisionStarted('7');

    expect(screen.getByTestId('supervision-banner').textContent).toContain('(7)');
  });

  it('ShouldStoreTheFourMembersAndShowOnlyTheMode_WhenThePushArrives', async () => {
    await renderBanner();

    pushSupervisionStarted('Listen');

    expect(useRealtimeStore.getState().observedSupervision).toEqual({ ...PUSH, mode: 'Listen' });
    const text = screen.getByTestId('supervision-banner').textContent;
    expect(text).not.toContain(PUSH.conversationId);
    expect(text).not.toContain(PUSH.supervisorId);
    expect(text).not.toContain(PUSH.startedAt);
  });

  it('ShouldRenderNothing_WhenNobodyObserves', async () => {
    await renderBanner();

    expect(screen.queryByTestId('supervision-banner')).toBeNull();
  });
});
