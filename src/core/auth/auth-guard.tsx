import { Navigate, useLocation } from 'react-router';
import { useAuthStore } from './auth-store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isTokenExpired = useAuthStore((s) => s.isTokenExpired);
  const location = useLocation();

  if (!accessToken || isTokenExpired()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
