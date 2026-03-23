import { create } from 'zustand';

export type AgentPresence =
  | 'available'
  | 'busy'
  | 'away'
  | 'offline'
  | 'wrap_up'
  | 'on_break'
  | 'in_meeting'
  | 'training';

export interface AgentState {
  agentId: string;
  name: string;
  team: string;
  state: AgentPresence;
  stateChangedAt: string;
  conversationCount: number;
}

interface AgentStateStoreState {
  agents: AgentState[];
  setAgents: (agents: AgentState[]) => void;
  updateAgentState: (agentId: string, newState: AgentPresence) => void;
}

export const useAgentStateStore = create<AgentStateStoreState>()((set) => ({
  agents: [],

  setAgents: (agents) => set({ agents }),

  updateAgentState: (agentId, newState) =>
    set((state) => ({
      agents: state.agents.map((a) =>
        a.agentId === agentId
          ? { ...a, state: newState, stateChangedAt: new Date().toISOString() }
          : a,
      ),
    })),
}));
