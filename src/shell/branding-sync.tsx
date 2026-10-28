import { useEffect } from 'react';
import { requestTenantId } from '@/core/api/client';
import { useAuthStore } from '@/core/auth/auth-store';
import { useBrandingStore } from '@/core/branding';
import { useTenantStore } from '@/core/tenant/tenant-store';

/**
 * The signed-in console's brand (design D4 of `licensee-branding-in-the-console`): the brand of the
 * tenant the authenticated requests name in `X-Tenant-Id`, looked up again each time that tenant
 * changes, so an impersonation's start and end each repaint. A brand the sign-in page already
 * painted for the same tenant is kept without a refetch. Sign-out itself returns the brand to the
 * Verbara defaults (`useAuthStore.logout`, design D2), whether or not this component is still
 * mounted: `logout()` leaves the tenant store's active tenant set, so the requests' tenant alone
 * does not see it. When no tenant is left at all the brand is reset here as well. Renders nothing.
 */
export function BrandingSync(): null {
  useEffect(() => {
    // `undefined` until the first sync, so a mount with no tenant still resets.
    let current: string | null | undefined;

    function sync(): void {
      const tenant = requestTenantId();
      if (tenant === current) return;
      current = tenant;
      const branding = useBrandingStore.getState();
      if (tenant === null) {
        branding.reset();
        return;
      }
      if (branding.source === 'tenant' && branding.key === tenant) return;
      void branding.lookupTenant(tenant);
    }

    sync();
    const unsubscribeAuth = useAuthStore.subscribe(sync);
    const unsubscribeTenant = useTenantStore.subscribe(sync);
    return () => {
      unsubscribeAuth();
      unsubscribeTenant();
    };
  }, []);

  return null;
}
