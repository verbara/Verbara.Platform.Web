import { Building2, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/core/ui/badge';
import { useAuthStore } from '@/core/auth/auth-store';
import { useTenantStore } from '@/core/tenant/tenant-store';
import { useTenant } from '@/core/api/hooks/use-tenants';
import { cn } from '@/lib/utils';

interface TenantBadgeProps {
  readonly size?: 'sm' | 'default';
  readonly className?: string;
}

export function TenantBadge({ size = 'default', className }: TenantBadgeProps) {
  const { t } = useTranslation('common');
  const impersonation = useAuthStore((s) => s.impersonation);
  const activeTenantId = useTenantStore((s) => s.activeTenantId);
  const { data: tenant } = useTenant(activeTenantId ?? '');

  const isImpersonating = impersonation?.active ?? false;
  const displayName = (isImpersonating ? impersonation?.targetTenantName : tenant?.name) ?? '';
  const tenantId = tenant?.tenantId ?? activeTenantId ?? '';

  if (!displayName) {
    return (
      <Badge variant="secondary" className={cn('gap-1 text-xs opacity-70', className)}>
        <Building2 className="size-3" aria-hidden="true" />
        {t('tenant.badge.loading')}
      </Badge>
    );
  }

  const ariaLabel = isImpersonating
    ? t('tenant.badge.impersonating', { name: displayName })
    : t('tenant.badge.tooltip', { name: displayName, id: tenantId });

  return (
    <Badge
      variant="secondary"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        'gap-1 max-w-[8rem] overflow-hidden',
        size === 'sm' && 'text-[0.65rem] h-4 px-1.5',
        isImpersonating && 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
        className,
      )}
    >
      {isImpersonating ? (
        <Shield className="size-3 shrink-0" aria-hidden="true" />
      ) : (
        <Building2 className="size-3 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{displayName}</span>
    </Badge>
  );
}
