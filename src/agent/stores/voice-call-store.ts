import { create } from 'zustand';

/** SIP registration state of the browser softphone (transport + REGISTER). */
export type SoftphoneRegistration = 'offline' | 'connecting' | 'registered' | 'disconnected';

/** Lifecycle of the single in-browser voice call (Phase 3A — one call at a time). */
export type VoiceCallPhase = 'idle' | 'ringing' | 'active' | 'ended';

interface VoiceCallState {
  /** Softphone REGISTER state, driven by the SIP.js delegate. */
  registration: SoftphoneRegistration;
  /** Current call lifecycle phase. The call card renders only for ringing/active. */
  phase: VoiceCallPhase;
  /** Human-readable caller label (may be empty in 3A; populated from the Conversation in 3B). */
  callerId: string;
  /** Caller number when known (empty in 3A). */
  callerNumber: string;
  /**
   * Id of the tracked voice Conversation this call maps to (3B.1). Set by the server-driven
   * `voice.screenpop` SSE event (the browser SimpleUser can't read the SIP caller/headers, so the
   * correlation is server-side). Persists through `ended` so the wrap-up dialog can use it; cleared
   * on `reset`/`incoming` (a fresh call starts unassociated).
   */
  associatedConversationId: string | null;
  /**
   * Conversation id whose hangup wrap-up dialog has already been auto-opened, so revisiting the
   * panel (remount) or returning to it does not re-open the dialog the agent dismissed. A store-level
   * (not per-mount) flag so it survives navigation; re-armed on the next call's `incoming`.
   */
  wrapUpPromptedFor: string | null;
  /** Epoch ms when the call was answered, for the in-call timer. */
  startedAt: number | null;
  /** Last softphone error surfaced to the UI. */
  error: string | null;

  setRegistration: (r: SoftphoneRegistration) => void;
  incoming: (callerId: string, callerNumber: string) => void;
  answered: () => void;
  ended: () => void;
  /**
   * Correlate the live call with its tracked voice Conversation + populate the caller identity
   * (from the screen-pop event). Does NOT change `phase` — the event may arrive just after the
   * answer transition, so association is independent of the call lifecycle.
   */
  associateConversation: (args: {
    conversationId: string;
    callerName: string;
    callerNumber: string;
  }) => void;
  /** Records that the hangup wrap-up dialog was auto-opened for a conversation (one-shot guard). */
  markWrapUpPrompted: (conversationId: string) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const idle = {
  phase: 'idle' as VoiceCallPhase,
  callerId: '',
  callerNumber: '',
  associatedConversationId: null as string | null,
  wrapUpPromptedFor: null as string | null,
  startedAt: null as number | null,
};

export const useVoiceCallStore = create<VoiceCallState>()((set) => ({
  registration: 'offline',
  error: null,
  ...idle,

  setRegistration: (registration) => set({ registration }),

  incoming: (callerId, callerNumber) =>
    set({
      phase: 'ringing',
      callerId,
      callerNumber,
      associatedConversationId: null,
      wrapUpPromptedFor: null,
      startedAt: null,
      error: null,
    }),

  answered: () => set({ phase: 'active', startedAt: Date.now() }),

  ended: () => set({ phase: 'ended' }),

  associateConversation: ({ conversationId, callerName, callerNumber }) =>
    set({ associatedConversationId: conversationId, callerId: callerName, callerNumber }),

  markWrapUpPrompted: (conversationId) => set({ wrapUpPromptedFor: conversationId }),

  setError: (error) => set({ error }),

  reset: () => set({ ...idle }),
}));
