import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock SIP.js's Web.SimpleUser so we can assert how the softphone is wired
// without opening a real WebSocket / WebRTC stack.
const { SimpleUserMock, lastInstance } = vi.hoisted(() => {
  const lastInstance = {
    current: null as unknown as Record<string, ReturnType<typeof vi.fn>> & {
      delegate: Record<string, () => void>;
    },
  };
  const SimpleUserMock = vi.fn(function (server: string, options: unknown) {
    const instance = {
      server,
      options,
      delegate: {} as Record<string, () => void>,
      connect: vi.fn().mockResolvedValue(undefined),
      register: vi.fn().mockResolvedValue(undefined),
      answer: vi.fn().mockResolvedValue(undefined),
      decline: vi.fn().mockResolvedValue(undefined),
      hangup: vi.fn().mockResolvedValue(undefined),
      hold: vi.fn().mockResolvedValue(undefined),
      unhold: vi.fn().mockResolvedValue(undefined),
      mute: vi.fn(),
      unmute: vi.fn(),
      sendDTMF: vi.fn().mockResolvedValue(undefined),
      unregister: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
    };
    lastInstance.current = instance as never;
    return instance;
  });
  return { SimpleUserMock, lastInstance };
});

vi.mock('sip.js', () => ({ Web: { SimpleUser: SimpleUserMock } }));

import {
  startSoftphone,
  stopSoftphone,
  answerCall,
  hangupCall,
  holdCall,
  unholdCall,
  muteCall,
  unmuteCall,
  sendDtmf,
  isSoftphoneRunning,
  isAutoAnswerEffective,
  autoAnswerCall,
} from './softphone-manager';
import { useVoiceCallStore } from '@/agent/stores/voice-call-store';

const baseConfig = {
  wssUrl: 'wss://pbx.lab:8089/ws',
  tenantId: 'acme',
  agentId: 'agent-007',
  extension: '1001',
  sipPassword: 's3cr3t',
  displayName: 'Bond',
};

describe('softphone-manager', () => {
  afterEach(async () => {
    await stopSoftphone();
    SimpleUserMock.mockClear();
    useVoiceCallStore.getState().reset();
    useVoiceCallStore.setState({ registration: 'offline', error: null });
  });

  it('startSoftphone_ShouldConstructSimpleUser_WithTenantPrefixedIdentity', async () => {
    await startSoftphone(baseConfig);

    expect(SimpleUserMock).toHaveBeenCalledTimes(1);
    const [server, options] = SimpleUserMock.mock.calls[0] as [
      string,
      {
        aor: string;
        userAgentOptions: { authorizationUsername: string; authorizationPassword: string };
      },
    ];
    expect(server).toBe('wss://pbx.lab:8089/ws');
    expect(options.aor).toContain('acme-agent-agent-007');
    expect(options.userAgentOptions.authorizationUsername).toBe('acme-1001');
    expect(options.userAgentOptions.authorizationPassword).toBe('s3cr3t');
    expect(lastInstance.current.connect).toHaveBeenCalled();
    expect(lastInstance.current.register).toHaveBeenCalled();
    expect(isSoftphoneRunning()).toBe(true);
  });

  it('startSoftphone_ShouldNoOp_WhenSipPasswordMissing', async () => {
    await startSoftphone({ ...baseConfig, sipPassword: '' });
    expect(SimpleUserMock).not.toHaveBeenCalled();
    expect(isSoftphoneRunning()).toBe(false);
  });

  it('startSoftphone_ShouldNoOp_WhenExtensionMissing', async () => {
    await startSoftphone({ ...baseConfig, extension: '' });
    expect(SimpleUserMock).not.toHaveBeenCalled();
  });

  it('onCallReceived_ShouldSetStoreToRinging', async () => {
    await startSoftphone(baseConfig);
    lastInstance.current.delegate.onCallReceived();
    expect(useVoiceCallStore.getState().phase).toBe('ringing');
    expect(useVoiceCallStore.getState().direction).toBe('inbound');
  });

  it('onCallReceived_ShouldKeepOutboundContext_WhenDialing', async () => {
    // 3B.2d: an in-flight click-to-dial means the INVITE is the agent's own outbound leg — the delegate
    // must NOT reset it to a fresh inbound call (which would wipe direction/pendingDial).
    await startSoftphone(baseConfig);
    useVoiceCallStore
      .getState()
      .startOutbound({ number: '+15551234567', correlationId: 'conv-out' });
    lastInstance.current.delegate.onCallReceived();
    const s = useVoiceCallStore.getState();
    expect(s.direction).toBe('outbound');
    expect(s.pendingDial).toEqual({ number: '+15551234567', correlationId: 'conv-out' });
    expect(s.associatedConversationId).toBe('conv-out');
  });

  it('onRegistered_ShouldSetStoreRegistered', async () => {
    await startSoftphone(baseConfig);
    lastInstance.current.delegate.onRegistered();
    expect(useVoiceCallStore.getState().registration).toBe('registered');
  });

  it('answerCall_ShouldCallSimpleUserAnswer', async () => {
    await startSoftphone(baseConfig);
    await answerCall();
    expect(lastInstance.current.answer).toHaveBeenCalled();
  });

  it('hangupCall_ShouldCallSimpleUserHangup', async () => {
    await startSoftphone(baseConfig);
    await hangupCall();
    expect(lastInstance.current.hangup).toHaveBeenCalled();
  });

  it('stopSoftphone_ShouldUnregisterDisconnect_AndResetStore', async () => {
    await startSoftphone(baseConfig);
    const inst = lastInstance.current;
    useVoiceCallStore.getState().incoming('x', 'y');

    await stopSoftphone();

    expect(inst.unregister).toHaveBeenCalled();
    expect(inst.disconnect).toHaveBeenCalled();
    expect(useVoiceCallStore.getState().phase).toBe('idle');
    expect(isSoftphoneRunning()).toBe(false);
  });

  it('holdCall_ShouldCallSimpleUserHold_AndMirrorStore', async () => {
    await startSoftphone(baseConfig);
    await holdCall();
    expect(lastInstance.current.hold).toHaveBeenCalled();
    expect(useVoiceCallStore.getState().isHeld).toBe(true);
  });

  it('unholdCall_ShouldCallSimpleUserUnhold_AndMirrorStore', async () => {
    await startSoftphone(baseConfig);
    await holdCall();
    await unholdCall();
    expect(lastInstance.current.unhold).toHaveBeenCalled();
    expect(useVoiceCallStore.getState().isHeld).toBe(false);
  });

  it('muteCall_ShouldCallSimpleUserMute_AndMirrorStore', async () => {
    await startSoftphone(baseConfig);
    muteCall();
    expect(lastInstance.current.mute).toHaveBeenCalled();
    expect(useVoiceCallStore.getState().isMuted).toBe(true);
  });

  it('unmuteCall_ShouldCallSimpleUserUnmute_AndMirrorStore', async () => {
    await startSoftphone(baseConfig);
    muteCall();
    unmuteCall();
    expect(lastInstance.current.unmute).toHaveBeenCalled();
    expect(useVoiceCallStore.getState().isMuted).toBe(false);
  });

  it('sendDtmf_ShouldCallSimpleUserSendDTMF_WithTone', async () => {
    await startSoftphone(baseConfig);
    await sendDtmf('5');
    expect(lastInstance.current.sendDTMF).toHaveBeenCalledWith('5');
  });

  it('callControl_ShouldNoOp_WhenNoSoftphone', async () => {
    // No startSoftphone — every control is a guarded no-op (no throw, store untouched).
    await holdCall();
    muteCall();
    await sendDtmf('1');
    expect(useVoiceCallStore.getState().isHeld).toBe(false);
    expect(useVoiceCallStore.getState().isMuted).toBe(false);
  });
});

describe('isAutoAnswerEffective', () => {
  it('isAutoAnswerEffective_ShouldHonorAgentOverride_OverQueueDefault', () => {
    // Explicit agent override always wins over the queue default.
    expect(isAutoAnswerEffective(true, false)).toBe(true);
    expect(isAutoAnswerEffective(false, true)).toBe(false);
  });

  it('isAutoAnswerEffective_ShouldInheritQueueDefault_WhenAgentUnset', () => {
    expect(isAutoAnswerEffective(null, true)).toBe(true);
    expect(isAutoAnswerEffective(undefined, true)).toBe(true);
    expect(isAutoAnswerEffective(null, false)).toBe(false);
    expect(isAutoAnswerEffective(undefined, false)).toBe(false);
  });
});

describe('autoAnswerCall (gating)', () => {
  const originalSecure = Object.getOwnPropertyDescriptor(window, 'isSecureContext');

  function setSecureContext(value: boolean) {
    Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
  }

  function setMicPermission(state: PermissionState | null) {
    Object.defineProperty(navigator, 'permissions', {
      value: state === null ? undefined : { query: vi.fn().mockResolvedValue({ state }) },
      configurable: true,
    });
  }

  afterEach(async () => {
    await stopSoftphone();
    SimpleUserMock.mockClear();
    if (originalSecure) Object.defineProperty(window, 'isSecureContext', originalSecure);
  });

  it('autoAnswerCall_ShouldReturnNoSoftphone_WhenNotRunning', async () => {
    setSecureContext(true);
    setMicPermission('granted');
    expect(await autoAnswerCall()).toBe('no-softphone');
  });

  it('autoAnswerCall_ShouldReturnInsecureContext_WhenNotSecure', async () => {
    await startSoftphone(baseConfig);
    setSecureContext(false);
    setMicPermission('granted');
    expect(await autoAnswerCall()).toBe('insecure-context');
    expect(lastInstance.current.answer).not.toHaveBeenCalled();
  });

  it('autoAnswerCall_ShouldReturnMicNotGranted_WhenPermissionDenied', async () => {
    await startSoftphone(baseConfig);
    setSecureContext(true);
    setMicPermission('denied');
    expect(await autoAnswerCall()).toBe('mic-not-granted');
    expect(lastInstance.current.answer).not.toHaveBeenCalled();
  });

  it('autoAnswerCall_ShouldAnswer_WhenSecureAndMicGranted', async () => {
    await startSoftphone(baseConfig);
    setSecureContext(true);
    setMicPermission('granted');
    expect(await autoAnswerCall()).toBe('answered');
    expect(lastInstance.current.answer).toHaveBeenCalled();
  });
});
