import { describe, it, expect, beforeEach } from 'vitest';
import { useRealtimeStore, type SignalRConnectionState } from './realtime-store';

describe('realtime-store', () => {
  beforeEach(() => {
    useRealtimeStore.getState().reset();
  });

  it('setConnectionState_ShouldStoreEnded_WhenServerEndedTheConnection', () => {
    useRealtimeStore.getState().setConnectionState('ended');

    expect(useRealtimeStore.getState().connectionState).toBe('ended');
  });

  it.each<SignalRConnectionState>(['connecting', 'connected', 'reconnecting', 'failed', 'ended'])(
    'reset_ShouldYieldDisconnected_WhenStateWas %s',
    (state) => {
      useRealtimeStore.getState().setConnectionState(state);
      useRealtimeStore.getState().upsertPresence({
        agentId: 'agent-1',
        state: 'available',
        lastHeartbeat: '2026-10-02T12:00:00Z',
      });
      useRealtimeStore.getState().setObservedSupervision({
        conversationId: 'conv-1',
        supervisorId: 'sup-1',
        mode: 'listen',
        startedAt: '2026-10-02T12:00:00Z',
      });

      useRealtimeStore.getState().reset();

      const after = useRealtimeStore.getState();
      expect(after.connectionState).toBe('disconnected');
      expect(after.agentPresences).toEqual({});
      expect(after.observedSupervision).toBeNull();
      expect(after.lastWhisper).toBeNull();
    },
  );
});
