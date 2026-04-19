import { create } from 'zustand';

export type SignalRConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed';

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

export interface WhisperNotification {
  conversationId: string;
  text: string;
  arrivedAt: string;
}

interface RealtimeState {
  connectionState: SignalRConnectionState;
  agentPresences: Record<string, AgentPresenceSnapshot>;
  observedSupervision: SupervisionStartedNotification | null;
  lastWhisper: WhisperNotification | null;

  setConnectionState: (state: SignalRConnectionState) => void;
  upsertPresence: (snapshot: AgentPresenceSnapshot) => void;
  removePresence: (agentId: string) => void;
  setObservedSupervision: (evt: SupervisionStartedNotification | null) => void;
  pushWhisper: (evt: WhisperNotification) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connectionState: 'disconnected',
  agentPresences: {},
  observedSupervision: null,
  lastWhisper: null,

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

  pushWhisper: (evt) => set({ lastWhisper: evt }),

  reset: () =>
    set({
      connectionState: 'disconnected',
      agentPresences: {},
      observedSupervision: null,
      lastWhisper: null,
    }),
}));
