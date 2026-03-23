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
}

const mockAgents: AgentState[] = [
  { agentId: 'a-1', name: 'Maria Lopez', team: 'Soporte', state: 'available', stateChangedAt: '2026-03-22T14:10:00Z', conversationCount: 0 },
  { agentId: 'a-2', name: 'Carlos Ruiz', team: 'Soporte', state: 'busy', stateChangedAt: '2026-03-22T14:05:00Z', conversationCount: 3 },
  { agentId: 'a-3', name: 'Ana Torres', team: 'Ventas', state: 'away', stateChangedAt: '2026-03-22T13:50:00Z', conversationCount: 0 },
  { agentId: 'a-4', name: 'Pedro Garcia', team: 'Ventas', state: 'busy', stateChangedAt: '2026-03-22T14:02:00Z', conversationCount: 2 },
  { agentId: 'a-5', name: 'Laura Mendez', team: 'Facturacion', state: 'wrap_up', stateChangedAt: '2026-03-22T14:12:00Z', conversationCount: 1 },
  { agentId: 'a-6', name: 'Diego Herrera', team: 'Soporte Tecnico', state: 'on_break', stateChangedAt: '2026-03-22T13:45:00Z', conversationCount: 0 },
  { agentId: 'a-7', name: 'Sofia Vargas', team: 'Retencion', state: 'available', stateChangedAt: '2026-03-22T14:08:00Z', conversationCount: 1 },
  { agentId: 'a-8', name: 'Andres Castro', team: 'Soporte', state: 'in_meeting', stateChangedAt: '2026-03-22T13:30:00Z', conversationCount: 0 },
  { agentId: 'a-9', name: 'Valentina Rios', team: 'Ventas', state: 'training', stateChangedAt: '2026-03-22T12:00:00Z', conversationCount: 0 },
  { agentId: 'a-10', name: 'Felipe Moreno', team: 'Facturacion', state: 'busy', stateChangedAt: '2026-03-22T14:11:00Z', conversationCount: 4 },
];

export const useAgentStateStore = create<AgentStateStoreState>()(() => ({
  agents: mockAgents,
}));
