import { Navigate } from 'react-router-dom';
import { useAuthStore } from './auth-store';

export function RoleGuard({ children, allowedRoles }: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !allowedRoles.includes(role))
    return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
