import { useVoiceCallStore } from './voice-call-store';

describe('VoiceCallStore', () => {
  beforeEach(() => {
    useVoiceCallStore.getState().reset();
    useVoiceCallStore.setState({ registration: 'offline', error: null });
  });

  it('incoming_ShouldEnterRinging_WithCaller', () => {
    useVoiceCallStore.getState().incoming('Acme Corp', '18005551234');
    const s = useVoiceCallStore.getState();
    expect(s.phase).toBe('ringing');
    expect(s.callerId).toBe('Acme Corp');
    expect(s.callerNumber).toBe('18005551234');
  });

  it('incoming_ShouldClearPreviousError', () => {
    useVoiceCallStore.getState().setError('boom');
    useVoiceCallStore.getState().incoming('', '');
    expect(useVoiceCallStore.getState().error).toBeNull();
  });

  it('answered_ShouldEnterActive_AndStampStartedAt', () => {
    useVoiceCallStore.getState().incoming('caller', '123');
    useVoiceCallStore.getState().answered();
    const s = useVoiceCallStore.getState();
    expect(s.phase).toBe('active');
    expect(typeof s.startedAt).toBe('number');
  });

  it('ended_ShouldEnterEnded', () => {
    useVoiceCallStore.getState().incoming('caller', '123');
    useVoiceCallStore.getState().answered();
    useVoiceCallStore.getState().ended();
    expect(useVoiceCallStore.getState().phase).toBe('ended');
  });

  it('reset_ShouldReturnToIdle', () => {
    useVoiceCallStore.getState().incoming('caller', '123');
    useVoiceCallStore.getState().answered();
    useVoiceCallStore.getState().reset();
    const s = useVoiceCallStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.callerId).toBe('');
    expect(s.startedAt).toBeNull();
  });

  it('setRegistration_ShouldUpdateRegistration', () => {
    useVoiceCallStore.getState().setRegistration('registered');
    expect(useVoiceCallStore.getState().registration).toBe('registered');
  });

  it('associateConversation_ShouldSetConversationAndCaller_WithoutChangingPhase', () => {
    useVoiceCallStore.getState().incoming('', '');
    useVoiceCallStore.getState().associateConversation({
      conversationId: 'conv-9',
      callerName: 'Ada Lovelace',
      callerNumber: '+15551234',
    });
    const s = useVoiceCallStore.getState();
    expect(s.associatedConversationId).toBe('conv-9');
    expect(s.callerId).toBe('Ada Lovelace');
    expect(s.callerNumber).toBe('+15551234');
    expect(s.phase).toBe('ringing'); // association does not change the call lifecycle
  });

  it('associatedConversationId_ShouldSurviveEnded_ForWrapUp', () => {
    useVoiceCallStore.getState().incoming('', '');
    useVoiceCallStore.getState().associateConversation({
      conversationId: 'conv-9',
      callerName: 'Ada',
      callerNumber: '+1',
    });
    useVoiceCallStore.getState().answered();
    useVoiceCallStore.getState().ended();
    // Persists through `ended` so the wrap-up dialog can use it.
    expect(useVoiceCallStore.getState().associatedConversationId).toBe('conv-9');
  });

  it('incoming_ShouldClearStaleAssociation_ForFreshCall', () => {
    useVoiceCallStore.getState().associateConversation({
      conversationId: 'old-conv',
      callerName: 'Old',
      callerNumber: '+0',
    });
    useVoiceCallStore.getState().incoming('', '');
    expect(useVoiceCallStore.getState().associatedConversationId).toBeNull();
  });

  it('reset_ShouldClearAssociation', () => {
    useVoiceCallStore.getState().associateConversation({
      conversationId: 'conv-9',
      callerName: 'Ada',
      callerNumber: '+1',
    });
    useVoiceCallStore.getState().reset();
    expect(useVoiceCallStore.getState().associatedConversationId).toBeNull();
  });

  it('markWrapUpPrompted_ShouldRecordConversation_AndIncomingReArms', () => {
    useVoiceCallStore.getState().markWrapUpPrompted('conv-9');
    expect(useVoiceCallStore.getState().wrapUpPromptedFor).toBe('conv-9');
    // A fresh call re-arms the one-shot wrap-up auto-open.
    useVoiceCallStore.getState().incoming('', '');
    expect(useVoiceCallStore.getState().wrapUpPromptedFor).toBeNull();
  });

  it('setHeld_ShouldMirrorHoldState', () => {
    useVoiceCallStore.getState().setHeld(true);
    expect(useVoiceCallStore.getState().isHeld).toBe(true);
    useVoiceCallStore.getState().setHeld(false);
    expect(useVoiceCallStore.getState().isHeld).toBe(false);
  });

  it('setMuted_ShouldMirrorMuteState', () => {
    useVoiceCallStore.getState().setMuted(true);
    expect(useVoiceCallStore.getState().isMuted).toBe(true);
  });

  it('incoming_ShouldReArmHoldAndMute_ForFreshCall', () => {
    useVoiceCallStore.getState().setHeld(true);
    useVoiceCallStore.getState().setMuted(true);
    useVoiceCallStore.getState().incoming('', '');
    expect(useVoiceCallStore.getState().isHeld).toBe(false);
    expect(useVoiceCallStore.getState().isMuted).toBe(false);
  });

  it('reset_ShouldClearHoldAndMute', () => {
    useVoiceCallStore.getState().setHeld(true);
    useVoiceCallStore.getState().setMuted(true);
    useVoiceCallStore.getState().reset();
    expect(useVoiceCallStore.getState().isHeld).toBe(false);
    expect(useVoiceCallStore.getState().isMuted).toBe(false);
  });
});
