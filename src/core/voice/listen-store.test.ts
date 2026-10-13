import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useListenStore, type SupervisorListen } from './listen-store';

/**
 * The supervisor's listen state (design D2): the listen user agent's registration, the pending
 * start and the active listen, never persisted and never holding the SIP secret.
 */

const readJson = (name: string) =>
  JSON.parse(
    readFileSync(resolve(process.cwd(), 'tests/fixtures/contracts', name), 'utf-8'),
  ) as Record<string, { body: unknown }>;

const start = readJson('supervisor-listen-start.v1.json');
const creds = readJson('supervisor-sip-credentials.v1.json') as unknown as {
  body: { sipPassword: string };
};
const startBody = start.start!.body as SupervisorListen;
const currentBody = start.current!.body as SupervisorListen;

describe('useListenStore', () => {
  beforeEach(() => useListenStore.getState().reset());

  it('ListenStore_ShouldStartOfflineAndIdle_WhenFresh', () => {
    const s = useListenStore.getState();
    expect(s.registration).toBe('offline');
    expect(s.unavailableReason).toBeNull();
    expect(s.pendingConversationId).toBeNull();
    expect(s.activeListen).toBeNull();
  });

  it.each(['connecting', 'registered', 'failed', 'moved', 'offline'] as const)(
    'ListenStore_ShouldTrackRegistration_WhenSetTo %s',
    (state) => {
      useListenStore.getState().setRegistration(state);
      expect(useListenStore.getState().registration).toBe(state);
    },
  );

  it('ListenStore_ShouldRecordTheReason_WhenTheBrowserIsUnavailable', () => {
    useListenStore.getState().setUnavailable('no-supervisor-endpoint');
    const s = useListenStore.getState();
    expect(s.registration).toBe('unavailable');
    expect(s.unavailableReason).toBe('no-supervisor-endpoint');
  });

  it('ListenStore_ShouldClearTheReason_WhenTheRegistrationMovesOn', () => {
    useListenStore.getState().setUnavailable('not-permitted');
    useListenStore.getState().setRegistration('offline');
    expect(useListenStore.getState().unavailableReason).toBeNull();
  });

  it('ListenStore_ShouldHoldThePendingConversation_UntilTheStartIsAnswered', () => {
    useListenStore.getState().setPending(startBody.conversationId);
    expect(useListenStore.getState().pendingConversationId).toBe(startBody.conversationId);
    useListenStore.getState().setActiveListen(startBody);
    const s = useListenStore.getState();
    expect(s.pendingConversationId).toBeNull();
    expect(s.activeListen).toEqual(startBody);
  });

  it('ListenStore_ShouldDropThePending_WhenTheStartFails', () => {
    useListenStore.getState().setPending('conv-x');
    useListenStore.getState().clearPending();
    expect(useListenStore.getState().pendingConversationId).toBeNull();
  });

  it('ListenStore_ShouldKeepTheFixtureShape_WhenTheCurrentListenIsSet', () => {
    useListenStore.getState().setActiveListen(currentBody);
    expect(Object.keys(useListenStore.getState().activeListen ?? {})).toEqual([
      'listenId',
      'conversationId',
      'destination',
      'state',
      'startedAt',
      'listeningSince',
    ]);
    useListenStore.getState().setActiveListen(null);
    expect(useListenStore.getState().activeListen).toBeNull();
  });

  it('ListenStore_ShouldTrackBlockedAudio_WhenAutoplayIsRefused', () => {
    useListenStore.getState().setAudioBlocked(true);
    expect(useListenStore.getState().audioBlocked).toBe(true);
    useListenStore.getState().reset();
    expect(useListenStore.getState().audioBlocked).toBe(false);
  });

  it('ListenStore_ShouldKeepThePending_WhenTheCurrentListenAnswersNone', () => {
    useListenStore.getState().setPending('conv-x');
    useListenStore.getState().setActiveListen(null);
    expect(useListenStore.getState().pendingConversationId).toBe('conv-x');
  });

  it('ListenStore_ShouldHaveNoPersistMiddleware_WhenCreated', () => {
    expect((useListenStore as unknown as { persist?: unknown }).persist).toBeUndefined();
    useListenStore.getState().setActiveListen(startBody);
    expect(JSON.stringify(localStorage)).not.toContain(startBody.listenId);
    expect(JSON.stringify(sessionStorage)).not.toContain(startBody.listenId);
  });

  it('ListenStore_ShouldNeverHoldTheSipPassword_WhenEveryActionHasRun', () => {
    const s = useListenStore.getState();
    s.setRegistration('registered');
    s.setPending(startBody.conversationId);
    s.setActiveListen(startBody);
    s.setUnavailable('not-permitted');
    const state = useListenStore.getState() as unknown as Record<string, unknown>;
    expect(Object.keys(state)).not.toContain('sipPassword');
    expect(JSON.stringify(state)).not.toContain(creds.body.sipPassword);
  });
});
