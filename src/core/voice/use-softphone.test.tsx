import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const { startSoftphoneMock, stopSoftphoneMock, agentRef, configRef } = vi.hoisted(() => ({
  startSoftphoneMock: vi.fn(),
  stopSoftphoneMock: vi.fn(),
  agentRef: { current: undefined as unknown },
  configRef: { current: { asteriskWssUrl: 'wss://pbx:8089/ws' } as { asteriskWssUrl?: string } },
}));

vi.mock('./softphone-manager', () => ({
  startSoftphone: startSoftphoneMock,
  stopSoftphone: stopSoftphoneMock,
}));
vi.mock('@/core/api/hooks/use-agents', () => ({ useAgentMe: () => ({ data: agentRef.current }) }));
vi.mock('@/core/hooks/use-config', () => ({ getConfig: () => configRef.current }));

import { useSoftphone } from './use-softphone';

const fullAgent = {
  agentId: 'a1',
  tenantId: 'acme',
  extension: '1001',
  sipPassword: 's3cr3t',
  displayName: 'Bond',
  capacity: { maxVoice: 1, maxChat: 0, maxEmail: 0, maxSms: 0, maxTotal: 1 },
};

describe('useSoftphone', () => {
  beforeEach(() => {
    startSoftphoneMock.mockClear();
    stopSoftphoneMock.mockClear();
    agentRef.current = undefined;
    configRef.current = { asteriskWssUrl: 'wss://pbx:8089/ws' };
  });

  it('useSoftphone_ShouldStart_WhenAgentHasVoiceAndCreds', () => {
    agentRef.current = fullAgent;
    renderHook(() => useSoftphone());
    expect(startSoftphoneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        wssUrl: 'wss://pbx:8089/ws',
        tenantId: 'acme',
        agentId: 'a1',
        extension: '1001',
        sipPassword: 's3cr3t',
      }),
    );
  });

  it('useSoftphone_ShouldNotStart_WhenNoVoiceCapacity', () => {
    agentRef.current = { ...fullAgent, capacity: { ...fullAgent.capacity, maxVoice: 0 } };
    renderHook(() => useSoftphone());
    expect(startSoftphoneMock).not.toHaveBeenCalled();
  });

  it('useSoftphone_ShouldNotStart_WhenSipPasswordMissing', () => {
    agentRef.current = { ...fullAgent, sipPassword: undefined };
    renderHook(() => useSoftphone());
    expect(startSoftphoneMock).not.toHaveBeenCalled();
  });

  it('useSoftphone_ShouldNotStart_WhenWssUrlEmpty', () => {
    agentRef.current = fullAgent;
    configRef.current = { asteriskWssUrl: '' };
    renderHook(() => useSoftphone());
    expect(startSoftphoneMock).not.toHaveBeenCalled();
  });

  it('useSoftphone_ShouldStop_OnUnmount', () => {
    agentRef.current = fullAgent;
    const { unmount } = renderHook(() => useSoftphone());
    unmount();
    expect(stopSoftphoneMock).toHaveBeenCalled();
  });
});
