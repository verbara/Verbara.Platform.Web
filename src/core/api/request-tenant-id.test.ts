/**
 * The tenant every authenticated request names in `X-Tenant-Id` (H17, design D4 of
 * `licensee-branding-in-the-console`): the request client and the console's brand both read it from
 * {@link requestTenantId}, so the brand follows the requests' tenant, an impersonation included.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { useAuthStore, type ImpersonationState } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { requestTenantId } from './client';

const IMPERSONATING_TENANT_9: ImpersonationState = {
  active: true,
  targetTenantId: 'tenant-9',
  targetTenantName: 'ACME',
  originalToken: 'operator-token',
  originalTokenExpiry: null,
  originalTenantId: 'tenant-1',
  expiresAt: Date.now() + 600_000,
  readOnly: false,
};

afterEach(() => {
  useAuthStore.setState({ tenantId: null, impersonation: null });
  useTenantStore.setState({ activeTenantId: null });
});

describe('requestTenantId', () => {
  it('requestTenantId_ShouldNameTheImpersonatedTenant_WhenAnImpersonationIsActive', () => {
    useAuthStore.setState({ tenantId: 'tenant-1', impersonation: IMPERSONATING_TENANT_9 });
    useTenantStore.setState({ activeTenantId: 'tenant-2' });

    expect(requestTenantId()).toBe('tenant-9');
  });

  it('requestTenantId_ShouldNameTheActiveTenant_WhenNoImpersonationIsActive', () => {
    useAuthStore.setState({
      tenantId: 'tenant-1',
      impersonation: { ...IMPERSONATING_TENANT_9, active: false },
    });
    useTenantStore.setState({ activeTenantId: 'tenant-2' });

    expect(requestTenantId()).toBe('tenant-2');
  });

  it('requestTenantId_ShouldNameThePersistedTenant_WhenNoTenantIsActive', () => {
    useAuthStore.setState({ tenantId: 'tenant-1', impersonation: null });
    useTenantStore.setState({ activeTenantId: null });

    expect(requestTenantId()).toBe('tenant-1');
  });

  it('requestTenantId_ShouldReturnNull_WhenNoStoreNamesATenant', () => {
    expect(requestTenantId()).toBeNull();
  });
});
