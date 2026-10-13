import type { components } from '@/core/api/generated/openapi';
import { create } from 'zustand';

/**
 * A supervisor's active silent listen, field for field as the host's start and current routes
 * answer it (`supervisor-listen-start.v1.json`, entries `start` and `current`).
 */
export type SupervisorListen = components['schemas']['SupervisorListenDto'];

/**
 * The listen user agent's registration (design D2). `unavailable`: the listen-endpoint route
 * refused (403 `not-permitted`, the role gate's bare 403, or 409 `no-supervisor-endpoint`) and the
 * browser is not offered for this principal. `moved`: another window of this browser took the registration (design D1).
 */
export type ListenRegistration =
  'offline' | 'connecting' | 'registered' | 'failed' | 'unavailable' | 'moved';

/** Why the browser destination is unavailable, when the listen-endpoint route said so. */
export type ListenUnavailableReason = 'not-permitted' | 'no-supervisor-endpoint';

interface ListenState {
  registration: ListenRegistration;
  unavailableReason: ListenUnavailableReason | null;
  /** The conversation a start was sent for and not yet answered (the INVITE can beat the 200). */
  pendingConversationId: string | null;
  /** The listen the server reports, from a 200 of the start or current route only. */
  activeListen: SupervisorListen | null;
  /** The browser leg is up but the page may not autoplay it: the control offers "click to hear". */
  audioBlocked: boolean;

  setRegistration: (registration: Exclude<ListenRegistration, 'unavailable'>) => void;
  setUnavailable: (reason: ListenUnavailableReason) => void;
  setPending: (conversationId: string) => void;
  clearPending: () => void;
  setActiveListen: (listen: SupervisorListen | null) => void;
  setAudioBlocked: (blocked: boolean) => void;
  reset: () => void;
}

const INITIAL = {
  registration: 'offline' as ListenRegistration,
  unavailableReason: null,
  pendingConversationId: null,
  activeListen: null,
  audioBlocked: false,
};

/**
 * Non-persisted on purpose: nothing about a listen survives a reload except what the current-listen
 * route answers, and the SIP secret never enters this store (it lives only in the listen agent's
 * closure, Verbara.Platform.Web/ADR-0011).
 */
export const useListenStore = create<ListenState>()((set) => ({
  ...INITIAL,
  setRegistration: (registration) => set({ registration, unavailableReason: null }),
  setUnavailable: (reason) => set({ registration: 'unavailable', unavailableReason: reason }),
  setPending: (conversationId) => set({ pendingConversationId: conversationId }),
  clearPending: () => set({ pendingConversationId: null }),
  setActiveListen: (listen) =>
    set(listen ? { activeListen: listen, pendingConversationId: null } : { activeListen: null }),
  setAudioBlocked: (blocked) => set({ audioBlocked: blocked }),
  reset: () => set(INITIAL),
}));
