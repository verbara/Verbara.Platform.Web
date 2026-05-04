import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import * as client from '@/core/api/client';
import {
  usePermissions,
  usePermissionCategories,
  useRoles,
  useRole,
  useRoleTemplates,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useCloneRole,
  useUserRoles,
  useUserPermissions,
  useAssignRole,
  useRemoveRole,
} from './use-rbac';
import type {
  Permission,
  PermissionCategory,
  TenantRole,
  RoleTemplate,
  UserRoleAssignment,
} from './use-rbac';

vi.mock('@/core/api/client', () => ({ customFetch: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockPermission: Permission = {
  permissionId: 'p1',
  category: 'users',
  resource: 'user',
  action: 'view',
  description: 'View users',
  implies: [],
};

const mockCategory: PermissionCategory = {
  category: 'users',
  permissions: [mockPermission],
};

const mockRole: TenantRole = {
  roleId: 'r1',
  tenantId: 't1',
  name: 'Admin',
  description: 'Admin role',
  sourceTemplateId: null,
  isDefault: false,
  permissions: ['users:user:view'],
  userCount: 3,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null,
};

const mockTemplate: RoleTemplate = {
  templateId: 'rt1',
  name: 'Default Admin',
  description: 'Default admin template',
  isSystem: true,
  permissions: ['users:user:view'],
  createdAt: '2026-01-01T00:00:00Z',
};

const mockUserRoleAssignment: UserRoleAssignment = {
  roleId: 'r1',
  roleName: 'Admin',
  assignedAt: '2026-01-01T00:00:00Z',
  assignedBy: null,
};

describe('usePermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch permissions', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockPermission]);
    const { result } = renderHook(() => usePermissions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockPermission]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/permissions',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => usePermissions(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('usePermissionCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch permission categories', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockCategory]);
    const { result } = renderHook(() => usePermissionCategories(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockCategory]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/permissions/categories',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => usePermissionCategories(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch roles', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockRole]);
    const { result } = renderHook(() => useRoles(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockRole]);
    expect(client.customFetch).toHaveBeenCalledWith({ url: '/api/v1/admin/roles', method: 'GET' });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRoles(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch a single role by id', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockRole);
    const { result } = renderHook(() => useRole('r1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockRole);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/roles/r1',
      method: 'GET',
    });
  });

  it('should not fetch when id is undefined', () => {
    const { result } = renderHook(() => useRole(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRole('r1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRoleTemplates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch role templates', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockTemplate]);
    const { result } = renderHook(() => useRoleTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockTemplate]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/role-templates',
      method: 'GET',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRoleTemplates(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a role', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockRole);
    const { result } = renderHook(() => useCreateRole(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'Admin', permissions: ['users:user:view'] });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/roles',
      method: 'POST',
      data: { name: 'Admin', permissions: ['users:user:view'] },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useCreateRole(), { wrapper });
    act(() => {
      result.current.mutate({ name: 'Admin' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update a role', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockRole);
    const { result } = renderHook(() => useUpdateRole(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'r1', name: 'Super Admin' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/roles/r1',
      method: 'PUT',
      data: { name: 'Super Admin' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUpdateRole(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'r1', name: 'X' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete a role', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useDeleteRole(), { wrapper });
    act(() => {
      result.current.mutate('r1');
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/roles/r1',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useDeleteRole(), { wrapper });
    act(() => {
      result.current.mutate('r1');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCloneRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should clone a role', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(mockRole);
    const { result } = renderHook(() => useCloneRole(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'r1', name: 'Admin Clone' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/roles/r1/clone',
      method: 'POST',
      data: { name: 'Admin Clone' },
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useCloneRole(), { wrapper });
    act(() => {
      result.current.mutate({ id: 'r1', name: 'Clone' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUserRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch roles for a user', async () => {
    vi.mocked(client.customFetch).mockResolvedValue([mockUserRoleAssignment]);
    const { result } = renderHook(() => useUserRoles('u1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockUserRoleAssignment]);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1/roles',
      method: 'GET',
    });
  });

  it('should not fetch when userId is undefined', () => {
    const { result } = renderHook(() => useUserRoles(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUserRoles('u1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUserPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch permissions for a user', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(['users:user:view']);
    const { result } = renderHook(() => useUserPermissions('u1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(['users:user:view']);
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1/permissions',
      method: 'GET',
    });
  });

  it('should not fetch when userId is undefined', () => {
    const { result } = renderHook(() => useUserPermissions(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.customFetch).not.toHaveBeenCalled();
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useUserPermissions('u1'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAssignRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should assign a role to a user', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssignRole(), { wrapper });
    act(() => {
      result.current.mutate({ userId: 'u1', roleId: 'r1' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1/roles/r1',
      method: 'POST',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useAssignRole(), { wrapper });
    act(() => {
      result.current.mutate({ userId: 'u1', roleId: 'r1' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRemoveRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should remove a role from a user', async () => {
    vi.mocked(client.customFetch).mockResolvedValue(undefined);
    const { result } = renderHook(() => useRemoveRole(), { wrapper });
    act(() => {
      result.current.mutate({ userId: 'u1', roleId: 'r1' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.customFetch).toHaveBeenCalledWith({
      url: '/api/v1/admin/users/u1/roles/r1',
      method: 'DELETE',
    });
  });

  it('should handle error', async () => {
    vi.mocked(client.customFetch).mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useRemoveRole(), { wrapper });
    act(() => {
      result.current.mutate({ userId: 'u1', roleId: 'r1' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
