import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useAuthStore } from '@/core/auth/auth-store';

interface DraftState {
  /** The user who typed these drafts; `null` for drafts saved before they named one. */
  owner: string | null;
  drafts: Record<string, string>;
  setDraft: (convId: string, text: string) => void;
  clearDraft: (convId: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
      owner: null,
      drafts: {},
      setDraft: (convId, text) =>
        set((s) => ({
          drafts: { ...s.drafts, [convId]: text },
        })),
      clearDraft: (convId) =>
        set((s) => {
          const { [convId]: _, ...rest } = s.drafts;
          return { drafts: rest };
        }),
    }),
    {
      name: 'verbara-drafts',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * A draft belongs to the user who typed it. It survives their sign-out (a session that expires must not
 * cost them a half-written reply) and is gone, from memory and disk, as soon as someone else signs in.
 * Checked when this module loads too: the agent console is a lazy route, so the sign-in may come first.
 */
function keepDraftsOf(userId: string | undefined): void {
  if (!userId || useDraftStore.getState().owner === userId) return;
  useDraftStore.setState({ owner: userId, drafts: {} });
}

keepDraftsOf(useAuthStore.getState().user?.id);
useAuthStore.subscribe((state) => keepDraftsOf(state.user?.id));
