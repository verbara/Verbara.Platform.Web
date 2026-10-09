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
  /**
   * The operator's own token expiry, restored with {@link originalToken} when the impersonation
   * ends, so a request after a long impersonation refreshes first instead of presenting an expired
   * token. In memory only, like the token itself (ADR-0011).
   */
  originalTokenExpiry: number | null;
  originalTenantId: string;
  expiresAt: number;
  readOnly: boolean;
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
  sessionIdleTimeoutMinutes: number | null;

  setAuth: (
    accessToken: string,
    tokenExpiry: number,
    user: UserProfile,
    tenantId: string,
    permissions: string[],
    features: Features,
    sessionIdleTimeoutMinutes?: number | null,
  ) => void;
  setMfaPending: (mfaToken: string, email: string) => void;
  clearMfaPending: () => void;
  setRememberMe: (value: boolean) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isTokenExpired: () => boolean;
  hasSession: () => boolean;
  startImpersonation: (
    response: {
      accessToken: string;
      expiresAt: string;
      targetTenantId: string;
      targetTenantName: string;
      readOnly?: boolean;
    },
    originalToken: string,
    originalTenantId: string,
  ) => void;
  endImpersonation: () => void;
}

/**
 * The slice written to `sessionStorage` — non-secret session facts only. Deriving it from
 * {@link AuthState} means a new credential-bearing field cannot be persisted by accident: it has to
 * be added here explicitly.
 */
export type PersistedAuthState = Pick<
  AuthState,
  'user' | 'tenantId' | 'permissions' | 'features' | 'rememberMe' | 'sessionIdleTimeoutMinutes'
>;

/** Bumped to 1 when credentials stopped being persisted, so {@link LEGACY_SECRET_KEYS} get stripped. */
const PERSIST_VERSION = 1;

/** Fields a v0 entry may carry that must never survive into a v1 entry. */
const LEGACY_SECRET_KEYS = [
  'accessToken',
  'tokenExpiry',
  'mfaPending',
  'impersonation',
] as const satisfies readonly (keyof AuthState)[];

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
      sessionIdleTimeoutMinutes: null,

      setAuth: (
        accessToken,
        tokenExpiry,
        user,
        tenantId,
        permissions,
        features,
        sessionIdleTimeoutMinutes,
      ) =>
        set((state) => ({
          accessToken,
          tokenExpiry,
          user,
          tenantId,
          permissions,
          features,
          mfaPending: null,
          // `undefined` means "not provided" — preserve the current value so a
          // refresh that omits the field never wipes it. An explicit `null`
          // (or a number) is applied as-is.
          sessionIdleTimeoutMinutes:
            sessionIdleTimeoutMinutes === undefined
              ? state.sessionIdleTimeoutMinutes
              : sessionIdleTimeoutMinutes,
        })),
      setMfaPending: (mfaToken, email) => set({ mfaPending: { mfaToken, email } }),
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
          sessionIdleTimeoutMinutes: null,
        }),
      hasPermission: (permission) => get().permissions.includes(permission),
      // "There is a session worth restoring." With credentials no longer persisted, the rehydrated
      // `user` is the only discriminator between a fresh browser and a reloaded authenticated tab.
      // Single source of truth for AuthGuard and the customFetch pre-flight so they cannot drift.
      hasSession: () => get().user !== null,
      isTokenExpired: () => {
        const expiry = get().tokenExpiry;
        if (!expiry) return true;
        return Date.now() >= expiry - 30_000; // 30s buffer
      },
      startImpersonation: (response, originalToken, originalTenantId) =>
        set((state) => ({
          accessToken: response.accessToken,
          tokenExpiry: new Date(response.expiresAt).getTime(),
          tenantId: response.targetTenantId,
          impersonation: {
            active: true,
            targetTenantId: response.targetTenantId,
            targetTenantName: response.targetTenantName,
            originalToken,
            originalTokenExpiry: state.tokenExpiry,
            originalTenantId,
            expiresAt: new Date(response.expiresAt).getTime(),
            readOnly: response.readOnly ?? false,
          },
        })),
      // The one way an impersonation ends in this tab, whatever ended it: the banner's End, its
      // expiry, or Platform refusing its token (design D3). Restores the operator's token, its expiry
      // and tenant; a no-op when no impersonation is active.
      endImpersonation: () => {
        const imp = get().impersonation;
        if (imp) {
          set({
            accessToken: imp.originalToken,
            tokenExpiry: imp.originalTokenExpiry,
            tenantId: imp.originalTenantId,
            impersonation: null,
          });
        }
      },
    }),
    {
      name: 'verbara-auth',
      storage: createJSONStorage(() => sessionStorage),
      version: PERSIST_VERSION,
      // Credentials are NEVER written to browser storage — they are readable by any script on the
      // origin. The durable credential is the httpOnly refresh cookie (ADR-0009 W1), which JS cannot
      // read; on reload `session-restore` exchanges it for a fresh access token.
      //
      // `features` and `permissions` stay persisted deliberately: the refresh response does not
      // return features, so dropping them would leave a rehydrated session with none until the next
      // full login.
      //
      // While an impersonation is active the live `tenantId` is the target's, but a reload restores
      // the operator's own session (the refresh cookie is theirs), so the operator's tenant is what
      // gets written (H18, design D4). The persisted shape does not change.
      partialize: (state): PersistedAuthState => ({
        user: state.user,
        tenantId: state.impersonation?.active
          ? state.impersonation.originalTenantId
          : state.tenantId,
        permissions: state.permissions,
        features: state.features,
        rememberMe: state.rememberMe,
        sessionIdleTimeoutMinutes: state.sessionIdleTimeoutMinutes,
      }),
      // `partialize` only governs writes. An entry written by the previous build still holds a token,
      // and would be merged back into memory and left on disk until something triggered a write.
      // Stripping it on read is what makes the upgrade actively clean. The migrated state still names
      // the user, so the restore mints a fresh token and the upgrade is invisible.
      migrate: (persisted, version) => {
        if (version < PERSIST_VERSION && persisted !== null && typeof persisted === 'object') {
          const legacy: Record<string, unknown> = { ...(persisted as Record<string, unknown>) };
          for (const secret of LEGACY_SECRET_KEYS) delete legacy[secret];
          return legacy as unknown as PersistedAuthState;
        }
        return persisted as PersistedAuthState;
      },
    },
  ),
);
