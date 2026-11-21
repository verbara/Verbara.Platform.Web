import { create } from 'zustand';

/**
 * The realtime hub's state as the console exposes it (`data-realtime-state` on the app shell).
 * `ended` means the server closed an established connection without allowing a reconnect and the
 * console did not ask for it — the close the session check resolves (realtime-connection-lifecycle).
 */
export type SignalRConnectionState =
  'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'ended';

export type PresenceStateValue =
  | 'available'
  | 'busy'
  | 'away'
  | 'offline'
  | 'wrap_up'
  | 'on_break'
  | 'in_meeting'
  | 'training'
  | 'unknown';

export interface AgentPresenceSnapshot {
  agentId: string;
  state: PresenceStateValue;
  lastHeartbeat: string;
  sourceNodeId?: string;
}

export interface SupervisionStartedNotification {
  conversationId: string;
  supervisorId: string;
  mode: string;
  startedAt: string;
}

interface RealtimeState {
  connectionState: SignalRConnectionState;
  agentPresences: Record<string, AgentPresenceSnapshot>;
  observedSupervision: SupervisionStartedNotification | null;

  setConnectionState: (state: SignalRConnectionState) => void;
  upsertPresence: (snapshot: AgentPresenceSnapshot) => void;
  removePresence: (agentId: string) => void;
  setObservedSupervision: (evt: SupervisionStartedNotification | null) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connectionState: 'disconnected',
  agentPresences: {},
  observedSupervision: null,

  setConnectionState: (state) => set({ connectionState: state }),

  upsertPresence: (snapshot) =>
    set((prev) => ({
      agentPresences: { ...prev.agentPresences, [snapshot.agentId]: snapshot },
    })),

  removePresence: (agentId) =>
    set((prev) => {
      if (!(agentId in prev.agentPresences)) return prev;
      const rest = { ...prev.agentPresences };
      delete rest[agentId];
      return { agentPresences: rest };
    }),

  setObservedSupervision: (evt) => set({ observedSupervision: evt }),

  reset: () =>
    set({
      connectionState: 'disconnected',
      agentPresences: {},
      observedSupervision: null,
    }),
}));
