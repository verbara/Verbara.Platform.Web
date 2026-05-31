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
  /** Epoch ms when the call was answered, for the in-call timer. */
  startedAt: number | null;
  /** Last softphone error surfaced to the UI. */
  error: string | null;

  setRegistration: (r: SoftphoneRegistration) => void;
  incoming: (callerId: string, callerNumber: string) => void;
  answered: () => void;
  ended: () => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

const idle = {
  phase: 'idle' as VoiceCallPhase,
  callerId: '',
  callerNumber: '',
  startedAt: null as number | null,
};

export const useVoiceCallStore = create<VoiceCallState>()((set) => ({
  registration: 'offline',
  error: null,
  ...idle,

  setRegistration: (registration) => set({ registration }),

  incoming: (callerId, callerNumber) =>
    set({ phase: 'ringing', callerId, callerNumber, startedAt: null, error: null }),

  answered: () => set({ phase: 'active', startedAt: Date.now() }),

  ended: () => set({ phase: 'ended' }),

  setError: (error) => set({ error }),

  reset: () => set({ ...idle }),
}));
