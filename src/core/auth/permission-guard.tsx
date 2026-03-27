import { Navigate } from 'react-router-dom';
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

  let allowed = false;

  if (requires) {
    allowed = permissions.includes(requires);
  } else if (requiresAny && requiresAny.length > 0) {
    allowed = requiresAny.some((p) => permissions.includes(p));
  } else {
    // No permission specified = allow
    allowed = true;
  }

  if (!allowed) {
    if (redirect) {
      return <Navigate to="/unauthorized" replace />;
    }
    return null;
  }

  return <>{children}</>;
}
