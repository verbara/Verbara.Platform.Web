import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from './auth-store';
import { restoreSession } from '@/core/session/session-restore';
import { PageSkeleton } from '@/core/ui/page-skeleton';

type SessionPhase = 'restoring' | 'authenticated' | 'unauthenticated';

/**
 * Resolves whether the current page load has a usable session.
 *
 * Credentials are no longer persisted, so a reloaded tab arrives with a `user` but no token. Rather
 * than reading that as signed out, we hold the route in `restoring` while `restoreSession` exchanges
 * the httpOnly refresh cookie for a fresh one. `restoreSession` is memoised per page load, so the
 * several guards a route tree mounts share a single refresh.
 */
function useSessionPhase(): SessionPhase {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isTokenExpired = useAuthStore((s) => s.isTokenExpired);
  const hasSession = useAuthStore((s) => s.hasSession);

  // Checked before the memo so a sign-in later in the same page load is judged on its own merits.
  const tokenUsable = Boolean(accessToken) && !isTokenExpired();
  const restorable = hasSession();

  const [restoreFailed, setRestoreFailed] = useState(false);

  useEffect(() => {
    if (tokenUsable || !restorable) return;

    let cancelled = false;
    void restoreSession().then((restored) => {
      if (!cancelled && !restored) setRestoreFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [tokenUsable, restorable]);

  if (tokenUsable) return 'authenticated';
  if (!restorable || restoreFailed) return 'unauthenticated';
  return 'restoring';
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const phase = useSessionPhase();
  const location = useLocation();

  if (phase === 'restoring') {
    // No copy on purpose: a string here would need EN-US/ES-419/PT-BR entries to satisfy the i18n
    // parity gate, for a state that is normally visible for a few hundred milliseconds.
    return (
      <div data-session-restoring="true">
        <PageSkeleton variant="cards" rows={3} />
      </div>
    );
  }

  if (phase === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
