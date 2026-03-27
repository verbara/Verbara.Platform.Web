import { useAuthStore } from './auth-store';

export function useHasPermission(permission: string): boolean {
  return useAuthStore((s) => s.permissions.includes(permission));
}

export function useHasAnyPermission(...permissions: string[]): boolean {
  return useAuthStore((s) => permissions.some((p) => s.permissions.includes(p)));
}
