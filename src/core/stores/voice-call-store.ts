import { create } from 'zustand';

/** SIP registration state of the browser softphone (transport + REGISTER). */
export type SoftphoneRegistration = 'offline' | 'connecting' | 'registered' | 'disconnected';

/** Lifecycle of the single in-browser voice call (Phase 3A — one call at a time). */
export type VoiceCallPhase = 'idle' | 'ringing' | 'active' | 'ended';

/** Who initiated the call (3B.2d). Inbound = a customer rang in; outbound = the agent clicked-to-dial. */
export type VoiceCallDirection = 'inbound' | 'outbound';

/** Optimistic outbound state set the moment the dial POST returns, before the SIP leg rings (3B.2d). */
export interface PendingDial {
  /** The dialed number (shown as "Dialing …" until the agent leg connects). */
  number: string;
  /** The tracked outbound Conversation id returned by POST /voice/dial — used to correlate the SIP leg. */
  correlationId: string;
}

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
  /**
   * UI mirror of the SIP.js hold state (SimpleUser is the source of truth). Hold is a sub-state of
   * the `active` phase — NOT a lifecycle phase — so the 3B.1 wrap-up/association logic is untouched.
   * Re-armed to false on every fresh call (`incoming`/`reset`).
   */
  isHeld: boolean;
  /** UI mirror of the SIP.js local-mute state. Independent of hold. Re-armed on `incoming`/`reset`. */
  isMuted: boolean;
  /**
   * The call's queue auto-answer default (3B.2b), delivered by the `voice.screenpop` event. Combined
   * with the agent's own override to decide auto-answer (effective = agent ?? queueDefault). Defaults
   * false and is re-armed on each fresh call.
   */
  queueAutoAnswerDefault: boolean;
  /** One-shot guard so auto-answer fires at most once per call. Re-armed on `incoming`/`reset`. */
  autoAnswered: boolean;
  /**
   * Direction of the live call (3B.2d). Inbound is the default (a customer rang in); set to outbound by
   * {@link startOutbound} when the agent clicks-to-dial. Re-armed to inbound on every fresh call.
   */
  direction: VoiceCallDirection;
  /**
   * Outbound dial in flight (3B.2d): set optimistically when POST /voice/dial returns, before the SIP
   * leg rings, so the card can show "Dialing {number}" immediately. The softphone delegate reads it to
   * recognise the inbound INVITE as the agent's own outbound leg and auto-answer it. Cleared on a fresh
   * inbound call / reset.
   */
  pendingDial: PendingDial | null;
  /** Last softphone error surfaced to the UI. */
  error: string | null;

  setRegistration: (r: SoftphoneRegistration) => void;
  incoming: (callerId: string, callerNumber: string) => void;
  /**
   * Begin an agent-initiated outbound call (3B.2d): goes straight to a ringing/"Dialing" card and links
   * the tracked outbound Conversation (its id is the dial's correlation id) up front — the screen-pop is
   * not needed on the initiating client. The softphone auto-answers the agent leg when the INVITE lands.
   */
  startOutbound: (args: { number: string; correlationId: string }) => void;
  answered: () => void;
  ended: () => void;
  /** Mirror the SIP.js hold state into the store (the softphone-manager wrapper drives this). */
  setHeld: (held: boolean) => void;
  /** Mirror the SIP.js local-mute state into the store. */
  setMuted: (muted: boolean) => void;
  /**
   * Correlate the live call with its tracked voice Conversation + populate the caller identity
   * (from the screen-pop event). Does NOT change `phase` — the event may arrive just after the
   * answer transition, so association is independent of the call lifecycle.
   */
  associateConversation: (args: {
    conversationId: string;
    callerName: string;
    callerNumber: string;
    queueAutoAnswerDefault?: boolean;
  }) => void;
  /** Records that the hangup wrap-up dialog was auto-opened for a conversation (one-shot guard). */
  markWrapUpPrompted: (conversationId: string) => void;
  /** Records that auto-answer has been triggered for the current call (one-shot guard). */
  markAutoAnswered: () => void;
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
  isHeld: false,
  isMuted: false,
  queueAutoAnswerDefault: false,
  autoAnswered: false,
  direction: 'inbound' as VoiceCallDirection,
  pendingDial: null as PendingDial | null,
};

export const useVoiceCallStore = create<VoiceCallState>()((set) => ({
  registration: 'offline',
  error: null,
  ...idle,

  setRegistration: (registration) => set({ registration }),

  incoming: (callerId, callerNumber) =>
    set({
      phase: 'ringing',
      direction: 'inbound',
      pendingDial: null,
      callerId,
      callerNumber,
      associatedConversationId: null,
      wrapUpPromptedFor: null,
      startedAt: null,
      isHeld: false,
      isMuted: false,
      queueAutoAnswerDefault: false,
      autoAnswered: false,
      error: null,
    }),

  startOutbound: ({ number, correlationId }) =>
    set({
      phase: 'ringing',
      direction: 'outbound',
      pendingDial: { number, correlationId },
      // The dial response carries the tracked Conversation id, so the initiating client correlates up
      // front — no server screen-pop needed for re-entry/transfer affordances on this call.
      associatedConversationId: correlationId,
      callerId: number,
      callerNumber: number,
      wrapUpPromptedFor: null,
      startedAt: null,
      isHeld: false,
      isMuted: false,
      queueAutoAnswerDefault: false,
      autoAnswered: false,
      error: null,
    }),

  answered: () => set({ phase: 'active', startedAt: Date.now() }),

  setHeld: (isHeld) => set({ isHeld }),

  setMuted: (isMuted) => set({ isMuted }),

  markAutoAnswered: () => set({ autoAnswered: true }),

  ended: () => set({ phase: 'ended' }),

  associateConversation: ({ conversationId, callerName, callerNumber, queueAutoAnswerDefault }) =>
    set({
      associatedConversationId: conversationId,
      callerId: callerName,
      callerNumber,
      ...(queueAutoAnswerDefault !== undefined ? { queueAutoAnswerDefault } : {}),
    }),

  markWrapUpPrompted: (conversationId) => set({ wrapUpPromptedFor: conversationId }),

  setError: (error) => set({ error }),

  reset: () => set({ ...idle }),
}));
