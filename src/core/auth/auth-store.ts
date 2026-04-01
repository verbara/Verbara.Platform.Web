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

export interface ImpersonationState {
  active: boolean;
  targetTenantId: string;
  targetTenantName: string;
  originalToken: string;
  originalTenantId: string;
  expiresAt: number;
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
  impersonation: ImpersonationState | null;

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
  startImpersonation: (
    response: {
      accessToken: string;
      expiresAt: string;
      targetTenantId: string;
      targetTenantName: string;
    },
    originalToken: string,
    originalTenantId: string,
  ) => void;
  endImpersonation: () => void;
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
      impersonation: null,

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
          impersonation: null,
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
      startImpersonation: (response, originalToken, originalTenantId) =>
        set({
          accessToken: response.accessToken,
          tokenExpiry: new Date(response.expiresAt).getTime(),
          tenantId: response.targetTenantId,
          impersonation: {
            active: true,
            targetTenantId: response.targetTenantId,
            targetTenantName: response.targetTenantName,
            originalToken,
            originalTenantId,
            expiresAt: new Date(response.expiresAt).getTime(),
          },
        }),
      endImpersonation: () => {
        const imp = get().impersonation;
        if (imp) {
          set({
            accessToken: imp.originalToken,
            tenantId: imp.originalTenantId,
            impersonation: null,
          });
        }
      },
    }),
    {
      name: 'asterisk-auth',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
