import { useTranslation } from 'react-i18next';
import { Check, AlertTriangle, Shield, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge } from '@/core/ui/badge';
import { useFormatDate } from '@/core/i18n/use-format';
import { differenceInDays, parseISO } from 'date-fns';
import type { LicenseInfo } from '@/core/api/hooks/use-system';

const STATUS_STYLES: Record<string, { variant: 'default' | 'destructive' | 'outline'; icon: typeof ShieldCheck }> = {
  Valid: { variant: 'default', icon: ShieldCheck },
  Expired: { variant: 'destructive', icon: ShieldX },
  Invalid: { variant: 'destructive', icon: ShieldX },
  NotFound: { variant: 'outline', icon: Shield },
};

function statusBgClass(status: string): string {
  switch (status) {
    case 'Valid':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    case 'Expired':
    case 'Invalid':
      return 'bg-destructive/10 text-destructive';
    case 'NotFound':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function featureLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

export function LicenseCard({ license }: { license: LicenseInfo }) {
  const { t } = useTranslation(['admin']);
  const { formatDate, formatRelative } = useFormatDate();

  const defaultStyle = { variant: 'outline' as const, icon: Shield };
  const style = STATUS_STYLES[license.status] ?? defaultStyle;
  const StatusIcon = style.icon;

  const expiresDate = license.expiresAt ? parseISO(license.expiresAt) : null;
  const daysUntilExpiry = expiresDate ? differenceInDays(expiresDate, new Date()) : null;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;

  return (
    <div className="rounded-lg border bg-card p-6 space-y-5">
      {/* Top row: Status badge + Licensee */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge
            data-testid="license-status-badge"
            variant={style.variant}
            className={`gap-1.5 px-3 py-1 text-xs font-semibold ${statusBgClass(license.status)}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            {t('admin:system.license_status')}: {license.status}
          </Badge>
        </div>
        {license.licensee && (
          <span className="text-sm font-medium text-foreground">
            {license.licensee}
          </span>
        )}
      </div>

      {/* Info row: License ID, Max Nodes, Last Validated */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            License ID
          </p>
          <p className="truncate font-mono text-sm text-foreground" title={license.licenseId ?? undefined}>
            {license.licenseId ?? '--'}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Max Nodes
          </p>
          <p className="text-sm font-semibold text-foreground">
            {license.maxNodes}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Last Validated
          </p>
          <p className="text-sm text-foreground" title={formatDate(license.lastValidatedAt)}>
            {formatRelative(license.lastValidatedAt)}
          </p>
        </div>
      </div>

      {/* Expiration */}
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:system.expires')}
        </p>
        {expiresDate ? (
          <p className={`text-sm font-medium ${isExpired ? 'text-destructive' : isExpiringSoon ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {formatDate(license.expiresAt!)}
            {isExpiringSoon && (
              <span className="ml-2 text-xs">
                ({daysUntilExpiry} {daysUntilExpiry === 1 ? 'day' : 'days'})
              </span>
            )}
          </p>
        ) : (
          <p className="text-sm font-medium text-foreground">Perpetual</p>
        )}
      </div>

      {/* Expiration warning */}
      {(isExpiringSoon || isExpired) && (
        <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
          isExpired
            ? 'bg-destructive/10 text-destructive'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
        }`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {isExpired
            ? t('admin:system.license_expired')
            : t('admin:system.license_expiring_soon', { days: daysUntilExpiry })}
        </div>
      )}

      {/* Features */}
      {license.licensedFeatures.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('admin:system.features')}
          </p>
          <div
            data-testid="license-features-grid"
            className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            {license.licensedFeatures.map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{featureLabel(feature)}</span>
                <Badge variant="default" className="ml-auto text-[10px]">
                  {t('admin:system.enabled')}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
