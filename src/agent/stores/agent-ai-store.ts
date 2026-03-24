import { create } from 'zustand';

export interface AgentSuggestion {
  id: string;
  text: string;
  priority: string; // Informational, Important, Urgent, Critical
  source: string;
  triggerPhrase?: string;
  timestamp: string;
}

export interface SentimentReading {
  speaker: string; // Caller, Agent
  score: number; // -1.0 to 1.0
  label: string; // Positive, Neutral, Negative, Frustrated, Escalating
  triggerWords: string[];
  timestamp: string;
}

export interface ComplianceAlert {
  ruleId: string;
  phrase?: string;
  severity: string; // Info, Warning, Critical
  timestamp: string;
}

export interface TranscriptSegment {
  speaker: string; // Caller, Agent
  text: string;
  isFinal: boolean;
  timestamp: string;
}

interface AgentAiState {
  suggestions: AgentSuggestion[];
  sentiment: SentimentReading | null;
  complianceAlerts: ComplianceAlert[];
  transcript: TranscriptSegment[];
  isActive: boolean;
  addSuggestion: (s: AgentSuggestion) => void;
  dismissSuggestion: (id: string) => void;
  updateSentiment: (s: SentimentReading) => void;
  addComplianceAlert: (a: ComplianceAlert) => void;
  acknowledgeAlert: (ruleId: string) => void;
  addTranscript: (t: TranscriptSegment) => void;
  clearSession: () => void;
}

export const useAgentAiStore = create<AgentAiState>()((set) => ({
  suggestions: [],
  sentiment: null,
  complianceAlerts: [],
  transcript: [],
  isActive: false,
  addSuggestion: (s) =>
    set((state) => ({
      suggestions: [s, ...state.suggestions].slice(0, 10),
      isActive: true,
    })),
  dismissSuggestion: (id) =>
    set((state) => ({
      suggestions: state.suggestions.filter((s) => s.id !== id),
    })),
  updateSentiment: (s) => set({ sentiment: s, isActive: true }),
  addComplianceAlert: (a) =>
    set((state) => ({
      complianceAlerts: [a, ...state.complianceAlerts].slice(0, 20),
      isActive: true,
    })),
  acknowledgeAlert: (ruleId) =>
    set((state) => ({
      complianceAlerts: state.complianceAlerts.filter((a) => a.ruleId !== ruleId),
    })),
  addTranscript: (t) =>
    set((state) => ({
      transcript: [...state.transcript, t],
      isActive: true,
    })),
  clearSession: () =>
    set({ suggestions: [], sentiment: null, complianceAlerts: [], transcript: [], isActive: false }),
}));
