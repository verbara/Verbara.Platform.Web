import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export interface Features {
  [key: string]: boolean;
}

interface AuthState {
  apiKey: string | null;
  user: UserProfile | null;
  tenantId: string | null;
  features: Features;
  rememberMe: boolean;
  setAuth: (apiKey: string, user: UserProfile, tenantId: string, features: Features) => void;
  setRememberMe: (value: boolean) => void;
  logout: () => void;
  hasFeature: (feature: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      apiKey: null,
      user: null,
      tenantId: null,
      features: {},
      rememberMe: false,
      setAuth: (apiKey, user, tenantId, features) => set({ apiKey, user, tenantId, features }),
      setRememberMe: (value) => set({ rememberMe: value }),
      logout: () => set({ apiKey: null, user: null, tenantId: null, features: {} }),
      hasFeature: (feature) => get().features[feature] === true,
    }),
    {
      name: 'asterisk-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
