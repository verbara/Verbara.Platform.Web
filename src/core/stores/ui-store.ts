import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  sidebarCollapsed: boolean;
  setupDismissed: boolean;
  testCompleted: boolean;
  tourDismissed: boolean;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSetupDismissed: (v: boolean) => void;
  setTestCompleted: (v: boolean) => void;
  setTourDismissed: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
      setupDismissed: false,
      testCompleted: false,
      tourDismissed: false,
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSetupDismissed: (v) => set({ setupDismissed: v }),
      setTestCompleted: (v) => set({ testCompleted: v }),
      setTourDismissed: (v) => set({ tourDismissed: v }),
    }),
    { name: 'verbara-ui' },
  ),
);

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  ) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

// Apply theme on initial load
applyTheme(useUiStore.getState().theme);

// Listen for system preference changes when in 'system' mode
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (useUiStore.getState().theme === 'system') {
    applyTheme('system');
  }
});
