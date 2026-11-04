import { create } from 'zustand';
import { registerSessionWorkReset } from '@/core/session/session-work';

interface AgentAlertsState {
  pendingCount: number;
  increment: () => void;
  reset: () => void;
}

export const useAgentAlertsStore = create<AgentAlertsState>()((set) => ({
  pendingCount: 0,
  increment: () => set((s) => ({ pendingCount: s.pendingCount + 1 })),
  reset: () => set({ pendingCount: 0 }),
}));

registerSessionWorkReset(() => useAgentAlertsStore.getState().reset());
