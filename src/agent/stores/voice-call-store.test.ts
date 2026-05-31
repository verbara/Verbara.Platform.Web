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
});
