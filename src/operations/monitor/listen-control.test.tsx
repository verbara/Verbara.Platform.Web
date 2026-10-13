/**
 * The silent-listen control (design D3, D6; spec `supervisor-listen-console`, requirements 3-8),
 * against a mocked hook module: the control's state comes only from the listen store, which only a
 * 200 of the start or current route fills.
 */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ApiError } from '@/core/api/api-error';
import { useAuthStore } from '@/core/auth/auth-store';
import { useListenStore } from '@/core/voice/listen-store';
import enOperations from '../../../public/locales/en-US/operations.json';

const {
  startMutate,
  stopMutate,
  startState,
  currentListenMock,
  listenHereMock,
  resumeMock,
  configRef,
} = vi.hoisted(() => ({
  startMutate: vi.fn(),
  stopMutate: vi.fn(),
  startState: { current: { isPending: false, error: null as unknown } },
  currentListenMock: vi.fn(),
  listenHereMock: vi.fn(async () => undefined),
  resumeMock: vi.fn(),
  configRef: {
    current: { asteriskWssUrl: 'wss://pbx.example:8089/ws' } as { asteriskWssUrl?: string },
  },
}));

vi.mock('@/core/api/hooks/use-supervisor-listen', () => ({
  useStartListen: () => ({ mutate: startMutate, reset: vi.fn(), ...startState.current }),
  useStopListen: () => ({ mutate: stopMutate, isPending: false }),
  useCurrentListen: (enabled?: boolean) => currentListenMock(enabled),
}));
vi.mock('@/core/voice/listen-agent', () => ({
  listenHere: listenHereMock,
  resumeListenAudio: resumeMock,
}));
vi.mock('@/core/hooks/use-config', () => ({ getConfig: () => configRef.current }));

import { ActiveListenBar, ListenControl } from './listen-control';
import { canListenTo } from './listen-eligibility';

const readJson = <T,>(name: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8')) as T;
const startFx = readJson<{ start: { body: Record<string, unknown> } }>(
  'supervisor-listen-start.v1.json',
);
const refusals = readJson<Record<string, { status: number; body: Record<string, unknown> }>>(
  'supervisor-listen-refusals.json',
);

const CONV = '4f1d2b8c9a0e4d7f8c6b5a4e3d2c1b0a';
const OTHER = '9a8b7c6d5e4f40312a1b2c3d4e5f6071';
const MONITOR = 'contacts:conversation:monitor';
const SUP = { id: 'sup-1', email: 's@b.com', displayName: 'Sup', role: 'supervisor' } as const;

const listen = (over: Record<string, unknown> = {}) =>
  ({ ...startFx.start.body, ...over }) as never;

async function renderControl(conversationId: string | null) {
  const i18n = i18next.createInstance();
  await i18n.init({
    lng: 'en-US',
    fallbackLng: false,
    resources: { 'en-US': { operations: enOperations } },
    ns: ['operations'],
    defaultNS: 'operations',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <ListenControl conversationId={conversationId} />
      <ActiveListenBar />
    </I18nextProvider>,
  );
}

function signIn(permissions: string[] = [MONITOR]) {
  useAuthStore.getState().setAuth('T', Date.now() + 60_000, SUP, 'acme', permissions, {});
}

async function openMenu() {
  fireEvent.click(screen.getByTestId('listen-start'));
  await screen.findByTestId('listen-destination-phone');
}

beforeEach(() => {
  startMutate.mockReset();
  stopMutate.mockReset();
  listenHereMock.mockClear();
  resumeMock.mockClear();
  currentListenMock.mockReset();
  startState.current = { isPending: false, error: null };
  configRef.current = { asteriskWssUrl: 'wss://pbx.example:8089/ws' };
  useListenStore.getState().reset();
  useAuthStore.getState().logout();
  signIn();
});

describe('canListenTo', () => {
  it.each([
    ['Voice', 'active', true],
    ['Voice', 'on_hold', true],
    ['voice', 'active', true],
    ['Voice', 'wrap_up', false],
    ['WebChat', 'active', false],
    ['WhatsApp', 'on_hold', false],
  ])('CanListenTo_ShouldOfferListenOnlyOnALiveVoiceCall %s %s', (channel, state, expected) => {
    expect(canListenTo(channel, state)).toBe(expected);
  });
});

describe('ListenControl', () => {
  it('ListenControl_ShouldRenderNothing_WhenTheUserLacksTheMonitorPermission', async () => {
    useAuthStore.getState().logout();
    signIn(['reporting:realtime:view']);
    await renderControl(CONV);
    expect(screen.queryByTestId('listen-control')).toBeNull();
    expect(currentListenMock).toHaveBeenCalledWith(false);
  });

  it('ListenControl_ShouldReadTheCurrentListen_WhenItMounts', async () => {
    await renderControl(CONV);
    expect(currentListenMock).toHaveBeenCalledWith(true);
  });

  it('ListenControl_ShouldBeDisabledWithItsReasonAndCallNoRoute_WhenTheRowHasNoConversationId', async () => {
    useListenStore.getState().setRegistration('registered');
    await renderControl(null);
    const control = screen.getByTestId('listen-control');
    expect(control).toHaveAttribute('data-listen-state', 'idle');
    expect(screen.getByTestId('listen-start')).toBeDisabled();
    expect(screen.getByTestId('listen-no-conversation')).toHaveTextContent(
      enOperations.monitor.listen.no_conversation,
    );
    fireEvent.click(screen.getByTestId('listen-start'));
    expect(startMutate).not.toHaveBeenCalled();
  });

  it('ListenControl_ShouldStartInTheBrowserWithTheRowsConversationId_WhenRegistered', async () => {
    useListenStore.getState().setRegistration('registered');
    await renderControl(CONV);
    expect(screen.getByTestId('listen-control')).toHaveAttribute(
      'data-listen-default-destination',
      'endpoint',
    );
    await openMenu();
    const endpoint = screen.getByTestId('listen-destination-endpoint');
    expect(endpoint).not.toHaveAttribute('data-disabled');
    fireEvent.click(endpoint);
    expect(startMutate).toHaveBeenCalledWith({ conversationId: CONV, destination: 'endpoint' });
  });

  it('ListenControl_ShouldStartOnThePhone_WhenThePhoneIsChosen', async () => {
    await renderControl(CONV);
    await openMenu();
    fireEvent.click(screen.getByTestId('listen-destination-phone'));
    expect(startMutate).toHaveBeenCalledWith({ conversationId: CONV, destination: 'phone' });
  });

  it.each([
    ['offline', null, 'no-wss', ''],
    ['connecting', null, 'connecting', 'wss://pbx.example:8089/ws'],
    ['failed', null, 'failed', 'wss://pbx.example:8089/ws'],
    ['moved', null, 'moved', 'wss://pbx.example:8089/ws'],
    [
      'unavailable',
      'no-supervisor-endpoint',
      'no-supervisor-endpoint',
      'wss://pbx.example:8089/ws',
    ],
    ['unavailable', 'not-permitted', 'not-permitted', 'wss://pbx.example:8089/ws'],
  ] as const)(
    'ListenControl_ShouldDisableTheBrowserWithItsReasonAndDefaultToThePhone_WhenRegistrationIs %s %s',
    async (registration, reason, expectedReason, wss) => {
      configRef.current = { asteriskWssUrl: wss };
      if (registration === 'unavailable') useListenStore.getState().setUnavailable(reason!);
      else useListenStore.getState().setRegistration(registration);
      await renderControl(CONV);
      expect(screen.getByTestId('listen-control')).toHaveAttribute(
        'data-listen-default-destination',
        'phone',
      );
      await openMenu();
      const endpoint = screen.getByTestId('listen-destination-endpoint');
      expect(endpoint).toHaveAttribute('data-disabled');
      const why = screen.getByTestId('listen-endpoint-unavailable');
      expect(why).toHaveAttribute('data-reason', expectedReason);
      expect(why.textContent).not.toBe('');
      fireEvent.click(endpoint);
      expect(startMutate).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('listen-destination-phone'));
      expect(startMutate).toHaveBeenCalledWith({ conversationId: CONV, destination: 'phone' });
    },
  );

  it('ListenControl_ShouldStayIdle_WhenTheStartIsRefused', async () => {
    startState.current = {
      isPending: false,
      error: new ApiError(409, refusals.noVoiceCall.body),
    };
    await renderControl(CONV);
    expect(screen.getByTestId('listen-control')).toHaveAttribute('data-listen-state', 'idle');
    expect(screen.queryByTestId('listen-stop')).toBeNull();
  });

  it('ListenControl_ShouldShowDialingWithStop_WhenTheServerHoldsADialingListenHere', async () => {
    useListenStore.getState().setActiveListen(listen());
    await renderControl(CONV);
    const control = screen.getByTestId('listen-control');
    expect(control).toHaveAttribute('data-listen-state', 'dialing');
    expect(control).toHaveAttribute('data-listen-destination', 'endpoint');
    expect(screen.queryByTestId('listen-answer-phone')).toBeNull();
    fireEvent.click(within(control).getByTestId('listen-stop'));
    expect(stopMutate).toHaveBeenCalledWith(CONV);
  });

  it('ListenControl_ShouldAskToAnswerThePhoneAndShowNoNumber_WhenAPhoneListenIsDialing', async () => {
    useListenStore.getState().setActiveListen(listen({ destination: 'phone' }));
    const { container } = await renderControl(CONV);
    expect(screen.getByTestId('listen-answer-phone')).toHaveTextContent(
      enOperations.monitor.listen.answer_phone,
    );
    expect(container.textContent).not.toMatch(/\+\d{7,}/);
  });

  it('ListenControl_ShouldShowListening_OnlyWhenTheServerSaysListening', async () => {
    useListenStore
      .getState()
      .setActiveListen(
        listen({ state: 'listening', listeningSince: '2026-10-12T15:04:09.870+00:00' }),
      );
    await renderControl(CONV);
    expect(screen.getByTestId('listen-control')).toHaveAttribute('data-listen-state', 'listening');
  });

  it('ListenControl_ShouldStayIdle_WhenTheHeldListenIsOnAnotherConversation', async () => {
    useListenStore.getState().setActiveListen(listen({ conversationId: OTHER }));
    await renderControl(CONV);
    expect(screen.getByTestId('listen-control')).toHaveAttribute('data-listen-state', 'idle');
  });

  it('ListenControl_ShouldOfferToStopTheRunningListen_WhenTheStartAnswersAlreadyListening', async () => {
    startState.current = {
      isPending: false,
      error: new ApiError(409, refusals.alreadyListening.body),
    };
    await renderControl(CONV);
    const action = screen.getByTestId('listen-stop-existing');
    expect(action).toHaveAttribute('data-error-code', 'already-listening');
    fireEvent.click(action);
    expect(stopMutate).toHaveBeenCalledWith(refusals.alreadyListening.body.conversationId);
  });

  it('ListenControl_ShouldShowTheMovedStateWithListenHere_WhenAnotherWindowTookTheRegistration', async () => {
    useListenStore.getState().setRegistration('moved');
    await renderControl(CONV);
    expect(screen.getByTestId('listen-control')).toHaveAttribute(
      'data-listen-registration',
      'moved',
    );
    expect(screen.getByTestId('listen-moved')).toHaveTextContent(enOperations.monitor.listen.moved);
    await act(async () => {
      fireEvent.click(screen.getByTestId('listen-take-back'));
    });
    expect(listenHereMock).toHaveBeenCalledTimes(1);
  });

  it('ListenControl_ShouldOfferClickToHear_WhenTheBrowserBlockedPlayback', async () => {
    useListenStore.getState().setActiveListen(listen({ state: 'listening' }));
    useListenStore.getState().setAudioBlocked(true);
    await renderControl(CONV);
    fireEvent.click(screen.getByTestId('listen-click-to-hear'));
    expect(resumeMock).toHaveBeenCalledTimes(1);
  });
});

describe('ActiveListenBar', () => {
  it('ActiveListenBar_ShouldShowTheHeldListenWithStop_WhereverItWasStarted', async () => {
    useListenStore
      .getState()
      .setActiveListen(listen({ conversationId: OTHER, state: 'listening' }));
    await renderControl(null);
    const bar = screen.getByTestId('listen-active');
    expect(bar).toHaveAttribute('data-listen-state', 'listening');
    expect(bar).toHaveAttribute('data-listen-conversation', OTHER);
    fireEvent.click(within(bar).getByTestId('listen-active-stop'));
    expect(stopMutate).toHaveBeenCalledWith(OTHER);
  });

  it('ActiveListenBar_ShouldRenderNothing_WhenNoListenIsHeld', async () => {
    await renderControl(CONV);
    await waitFor(() => expect(screen.queryByTestId('listen-active')).toBeNull());
  });
});
