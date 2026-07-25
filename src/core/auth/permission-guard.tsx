import { Navigate } from 'react-router';
import { useAuthStore } from './auth-store';

interface PermissionGuardProps {
  children: React.ReactNode;
  /** Single permission required */
  requires?: string;
  /** Any of these permissions required */
  requiresAny?: string[];
  /** If true, redirects to /unauthorized instead of rendering nothing */
  redirect?: boolean;
}

export function PermissionGuard({
  children,
  requires,
  requiresAny,
  redirect = false,
}: PermissionGuardProps) {
  const permissions = useAuthStore((s) => s.permissions);

  const allowed = requires
    ? permissions.includes(requires)
    : requiresAny && requiresAny.length > 0
      ? requiresAny.some((p) => permissions.includes(p))
      : true; // No permission specified = allow

  if (!allowed) {
    if (redirect) {
      return <Navigate to="/unauthorized" replace />;
    }
    return null;
  }

  return <>{children}</>;
}
