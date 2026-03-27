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
  accessToken: string | null;
  tokenExpiry: number | null;
  user: UserProfile | null;
  tenantId: string | null;
  permissions: string[];
  features: Features;
  rememberMe: boolean;
  mfaPending: { mfaToken: string; email: string } | null;

  setAuth: (
    accessToken: string,
    tokenExpiry: number,
    user: UserProfile,
    tenantId: string,
    permissions: string[],
    features: Features,
  ) => void;
  setMfaPending: (mfaToken: string, email: string) => void;
  clearMfaPending: () => void;
  setRememberMe: (value: boolean) => void;
  logout: () => void;
  hasFeature: (feature: string) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  isTokenExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      tokenExpiry: null,
      user: null,
      tenantId: null,
      permissions: [],
      features: {},
      rememberMe: false,
      mfaPending: null,

      setAuth: (accessToken, tokenExpiry, user, tenantId, permissions, features) =>
        set({ accessToken, tokenExpiry, user, tenantId, permissions, features, mfaPending: null }),
      setMfaPending: (mfaToken, email) =>
        set({ mfaPending: { mfaToken, email } }),
      clearMfaPending: () => set({ mfaPending: null }),
      setRememberMe: (value) => set({ rememberMe: value }),
      logout: () =>
        set({
          accessToken: null,
          tokenExpiry: null,
          user: null,
          tenantId: null,
          permissions: [],
          features: {},
          mfaPending: null,
        }),
      hasFeature: (feature) => get().features[feature] === true,
      hasPermission: (permission) => get().permissions.includes(permission),
      hasAnyPermission: (...permissions) =>
        permissions.some((p) => get().permissions.includes(p)),
      isTokenExpired: () => {
        const expiry = get().tokenExpiry;
        if (!expiry) return true;
        return Date.now() >= expiry - 30_000; // 30s buffer
      },
    }),
    {
      name: 'asterisk-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
