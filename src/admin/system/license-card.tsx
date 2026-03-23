import { useTranslation } from 'react-i18next';
import { Check, Lock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/core/ui/badge';

export interface LicenseInfo {
  tier: string;
  maxAgents: number;
  expiresAt: string;
  features: Record<string, boolean>;
}

const TIER_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Community: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-200', border: 'border-slate-200 dark:border-slate-700' },
  Pro: { bg: 'bg-brand/5', text: 'text-brand', border: 'border-brand/20' },
  Enterprise: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
};

function featureLabel(key: string): string {
  // "pro.cluster" → "Cluster", "pro.callanalytics" → "Call Analytics"
  const name = key.replace(/^pro\./, '');
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .replace('callanalytics', 'Call Analytics')
    .replace('agentassist', 'Agent Assist')
    .replace('multitenant', 'Multi-Tenant')
    .replace('cluster', 'Cluster')
    .replace('dialer', 'Dialer')
    .replace('analytics', 'Analytics')
    .replace('routing', 'Routing');
}

export function LicenseCard({ license }: { license: LicenseInfo }) {
  const { t } = useTranslation(['admin']);
  const style = TIER_STYLES[license.tier] ?? { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-200', border: 'border-slate-200 dark:border-slate-700' };
  const expiresDate = new Date(license.expiresAt);
  const daysUntilExpiry = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isExpiringSoon = daysUntilExpiry > 0 && daysUntilExpiry <= 30;
  const isExpired = daysUntilExpiry <= 0;

  const enabledFeatures = Object.entries(license.features).filter(([, v]) => v);
  const disabledFeatures = Object.entries(license.features).filter(([, v]) => !v);

  return (
    <div className={`rounded-lg border-2 ${style.border} ${style.bg} p-6 space-y-5`}>
      {/* Tier badge + expiration */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t('admin:system.license_tier')}
          </p>
          <span className={`inline-block text-2xl font-bold ${style.text}`}>
            {license.tier}
          </span>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-muted-foreground">
            {t('admin:system.max_agents')}: <span className="font-semibold text-foreground">{license.maxAgents}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {t('admin:system.expires')}: <span className="font-semibold text-foreground">{expiresDate.toLocaleDateString()}</span>
          </p>
        </div>
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
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t('admin:system.features')}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {enabledFeatures.map(([key]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{featureLabel(key)}</span>
              <Badge variant="default" className="ml-auto text-[10px]">
                {t('admin:system.enabled')}
              </Badge>
            </div>
          ))}
          {disabledFeatures.map(([key]) => (
            <div key={key} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="h-4 w-4 shrink-0" />
              <span>{featureLabel(key)}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {t('admin:system.disabled')}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
