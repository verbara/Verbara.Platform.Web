import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './auth-store';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const apiKey = useAuthStore((s) => s.apiKey);
  const location = useLocation();

  if (!apiKey) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
