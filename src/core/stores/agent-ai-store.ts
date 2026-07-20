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

/** Live agent-assist data for a single conversation (3B.1 Phase C: keyed per conversation). */
export interface AgentAiSession {
  suggestions: AgentSuggestion[];
  sentiment: SentimentReading | null;
  complianceAlerts: ComplianceAlert[];
  transcript: TranscriptSegment[];
}

/**
 * Stable empty-session reference. Selectors fall back to this when a conversation has no
 * agent-assist data yet, so a missing slice returns the SAME reference every render (no zustand
 * re-render loop from a fresh `{}`/`[]` literal each call).
 */
export const EMPTY_SESSION: AgentAiSession = {
  suggestions: [],
  sentiment: null,
  complianceAlerts: [],
  transcript: [],
};

interface AgentAiState {
  /**
   * Agent-assist data keyed by conversationId. Voice + digital conversations each get their own
   * isolated slice (the global store bled suggestions/sentiment across concurrent conversations —
   * 3B.1 Phase C). The server now stamps every `agentassist.*` SSE event with its `conversationId`.
   */
  sessions: Record<string, AgentAiSession>;
  addSuggestion: (conversationId: string, s: AgentSuggestion) => void;
  dismissSuggestion: (conversationId: string, id: string) => void;
  updateSentiment: (conversationId: string, s: SentimentReading) => void;
  addComplianceAlert: (conversationId: string, a: ComplianceAlert) => void;
  acknowledgeAlert: (conversationId: string, ruleId: string) => void;
  addTranscript: (conversationId: string, t: TranscriptSegment) => void;
  clearSession: (conversationId: string) => void;
}

/** Immutably replace one conversation's session via a patch fn, leaving the others untouched. */
function patchSession(
  sessions: Record<string, AgentAiSession>,
  conversationId: string,
  patch: (sess: AgentAiSession) => AgentAiSession,
): Record<string, AgentAiSession> {
  const current = sessions[conversationId] ?? EMPTY_SESSION;
  return { ...sessions, [conversationId]: patch(current) };
}

export const useAgentAiStore = create<AgentAiState>()((set) => ({
  sessions: {},

  addSuggestion: (conversationId, s) =>
    set((state) => ({
      sessions: patchSession(state.sessions, conversationId, (sess) => ({
        ...sess,
        suggestions: [s, ...sess.suggestions].slice(0, 10),
      })),
    })),

  dismissSuggestion: (conversationId, id) =>
    set((state) => ({
      sessions: patchSession(state.sessions, conversationId, (sess) => ({
        ...sess,
        suggestions: sess.suggestions.filter((x) => x.id !== id),
      })),
    })),

  updateSentiment: (conversationId, s) =>
    set((state) => ({
      sessions: patchSession(state.sessions, conversationId, (sess) => ({ ...sess, sentiment: s })),
    })),

  addComplianceAlert: (conversationId, a) =>
    set((state) => ({
      sessions: patchSession(state.sessions, conversationId, (sess) => ({
        ...sess,
        complianceAlerts: [a, ...sess.complianceAlerts].slice(0, 20),
      })),
    })),

  acknowledgeAlert: (conversationId, ruleId) =>
    set((state) => ({
      sessions: patchSession(state.sessions, conversationId, (sess) => ({
        ...sess,
        complianceAlerts: sess.complianceAlerts.filter((a) => a.ruleId !== ruleId),
      })),
    })),

  addTranscript: (conversationId, t) =>
    set((state) => ({
      sessions: patchSession(state.sessions, conversationId, (sess) => ({
        ...sess,
        transcript: [...sess.transcript, t],
      })),
    })),

  clearSession: (conversationId) =>
    set((state) => {
      if (!state.sessions[conversationId]) return state;
      const { [conversationId]: _drop, ...rest } = state.sessions;
      return { sessions: rest };
    }),
}));

/** True when a session carries any agent-assist data (drives the ContextPanel transcript tab). */
export function sessionHasData(session: AgentAiSession | undefined): boolean {
  return (
    !!session &&
    (session.suggestions.length > 0 ||
      session.sentiment !== null ||
      session.complianceAlerts.length > 0 ||
      session.transcript.length > 0)
  );
}

/**
 * Collapses every conversation's session into one aggregate view. Used only by the supervisor
 * Operations monitor (`SessionDetail`), which has no per-conversation scoping. With a single local
 * session (the common case in any one browser) this returns that session verbatim; with multiple it
 * concatenates the lists and picks the most-recent sentiment by timestamp.
 *
 * NOTE: a supervisor's browser does not actually receive the *monitored* agent's `agentassist.*`
 * events (they are filtered to the supervisor's own agentId), so this live-mirror is a known-
 * incomplete feature — wiring server-side fan-out of the monitored session is future work. Flatten
 * preserves the prior global-store behavior without regressing.
 */
export function flattenAiSessions(sessions: Record<string, AgentAiSession>): AgentAiSession {
  const all = Object.values(sessions);
  if (all.length === 0) return EMPTY_SESSION;
  if (all.length === 1) return all[0]!;

  const sentiments = all.map((s) => s.sentiment).filter((x): x is SentimentReading => x !== null);
  const sentiment = sentiments.length
    ? sentiments.reduce((latest, cur) => (cur.timestamp > latest.timestamp ? cur : latest))
    : null;

  return {
    suggestions: all.flatMap((s) => s.suggestions),
    complianceAlerts: all.flatMap((s) => s.complianceAlerts),
    transcript: all.flatMap((s) => s.transcript),
    sentiment,
  };
}
