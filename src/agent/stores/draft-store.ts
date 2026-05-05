import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface DraftState {
  drafts: Record<string, string>;
  setDraft: (convId: string, text: string) => void;
  clearDraft: (convId: string) => void;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set) => ({
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
