import { create } from 'zustand';

function startOfMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AnalyticsFilterState {
  from: string;
  to: string;
  queue: string;
  channel: string;
  setFilters: (filters: Partial<Pick<AnalyticsFilterState, 'from' | 'to' | 'queue' | 'channel'>>) => void;
  reset: () => void;
}

export const useAnalyticsFilterStore = create<AnalyticsFilterState>()((set) => ({
  from: startOfMonth(),
  to: todayStr(),
  queue: '',
  channel: '',
  setFilters: (filters) => set(filters),
  reset: () => set({ from: startOfMonth(), to: todayStr(), queue: '', channel: '' }),
}));
