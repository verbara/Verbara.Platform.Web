import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

// --- Types ---

export interface Permission {
  permissionId: string;
  category: string;
  resource: string;
  action: string;
  description: string;
  implies: string[];
}

export interface PermissionCategory {
  category: string;
  permissions: Permission[];
}

export interface TenantRole {
  roleId: string;
  tenantId: string;
  name: string;
  description: string | null;
  sourceTemplateId: string | null;
  isDefault: boolean;
  permissions: string[];
  userCount?: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface RoleTemplate {
  templateId: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
}

export interface UserRoleAssignment {
  roleId: string;
  roleName: string;
  assignedAt: string;
  assignedBy: string | null;
}

// --- Permission Queries ---

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () =>
      customFetch<Permission[]>({ url: '/api/v1/admin/permissions', method: 'GET' }),
    staleTime: 60 * 60 * 1000, // 1 hour — permissions are immutable
  });
}

export function usePermissionCategories() {
  return useQuery({
    queryKey: ['permissions', 'categories'],
    queryFn: () =>
      customFetch<PermissionCategory[]>({
        url: '/api/v1/admin/permissions/categories',
        method: 'GET',
      }),
    staleTime: 60 * 60 * 1000,
  });
}

// --- Role Queries ---

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () =>
      customFetch<TenantRole[]>({ url: '/api/v1/admin/roles', method: 'GET' }),
  });
}

export function useRole(id: string | undefined) {
  return useQuery({
    queryKey: ['roles', id],
    queryFn: () =>
      customFetch<TenantRole>({ url: `/api/v1/admin/roles/${id}`, method: 'GET' }),
    enabled: !!id,
  });
}

export function useRoleTemplates() {
  return useQuery({
    queryKey: ['role-templates'],
    queryFn: () =>
      customFetch<RoleTemplate[]>({ url: '/api/v1/admin/role-templates', method: 'GET' }),
    staleTime: 60 * 60 * 1000,
  });
}

// --- Role Mutations ---

export function useCreateRole() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      sourceTemplateId?: string;
      permissions?: string[];
    }) => customFetch<TenantRole>({ url: '/api/v1/admin/roles', method: 'POST', data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success(t('toasts.rbac.roleCreated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      permissions?: string[];
    }) => customFetch<TenantRole>({ url: `/api/v1/admin/roles/${id}`, method: 'PUT', data }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['roles', variables.id] });
      toast.success(t('toasts.rbac.roleUpdated'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>({ url: `/api/v1/admin/roles/${id}`, method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success(t('toasts.rbac.roleDeleted'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCloneRole() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      customFetch<TenantRole>({
        url: `/api/v1/admin/roles/${id}/clone`,
        method: 'POST',
        data: { name },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success(t('toasts.rbac.roleCloned'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// --- User Role Queries ---

export function useUserRoles(userId: string | undefined) {
  return useQuery({
    queryKey: ['users', userId, 'roles'],
    queryFn: () =>
      customFetch<UserRoleAssignment[]>({
        url: `/api/v1/admin/users/${userId}/roles`,
        method: 'GET',
      }),
    enabled: !!userId,
  });
}

export function useUserPermissions(userId: string | undefined) {
  return useQuery({
    queryKey: ['users', userId, 'permissions'],
    queryFn: () =>
      customFetch<string[]>({
        url: `/api/v1/admin/users/${userId}/permissions`,
        method: 'GET',
      }),
    enabled: !!userId,
  });
}

// --- User Role Mutations ---

export function useAssignRole() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      customFetch<void>({
        url: `/api/v1/admin/users/${userId}/roles/${roleId}`,
        method: 'POST',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['users', variables.userId, 'roles'] });
      qc.invalidateQueries({ queryKey: ['users', variables.userId, 'permissions'] });
      toast.success(t('toasts.rbac.roleAssigned'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRemoveRole() {
  const qc = useQueryClient();
  const { t } = useTranslation('common');
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      customFetch<void>({
        url: `/api/v1/admin/users/${userId}/roles/${roleId}`,
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['users', variables.userId, 'roles'] });
      qc.invalidateQueries({ queryKey: ['users', variables.userId, 'permissions'] });
      toast.success(t('toasts.rbac.roleRemoved'));
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
