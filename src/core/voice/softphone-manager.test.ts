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
  isSoftphoneRunning,
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
});
