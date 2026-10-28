import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RailIcon } from './rail-icon';
import { NotificationBell } from './notification-bell';
import { UserMenu } from './user-menu';
import { useAuthStore } from '@/core/auth/auth-store';
import { useAgentAlertsStore } from '@/agent/stores/agent-alerts-store';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/core/ui/tooltip';
import { TenantBadge } from '@/core/ui/tenant-badge';
import { useBrandingStore } from '@/core/branding';
import { Settings, Activity, ChartColumn, MessageSquare, Hexagon, Command } from 'lucide-react';

/**
 * The rail's brand mark (design D5 of `licensee-branding-in-the-console`): the tenant's logo, else
 * the first letter of its display name, else the Verbara `Hexagon`, labelled with the display name.
 * The name is only ever a text node or an attribute; the logo was checked by `parsePublicBranding`.
 */
function BrandMark() {
  const brand = useBrandingStore((s) => s.brand);
  const name = brand?.displayName ?? null;
  const logo = brand?.logoUrl ?? null;
  // The logo address that failed to load, so a broken image falls back until the logo changes.
  const [failedLogo, setFailedLogo] = useState<string | null>(null);
  const initial = name === null ? null : Array.from(name.trim())[0]?.toUpperCase();

  return (
    <div
      className="mb-6 flex h-8 w-8 items-center justify-center text-brand"
      data-testid="rail-brand-mark"
      role={name === null ? undefined : 'img'}
      aria-label={name ?? undefined}
      title={name ?? undefined}
    >
      {logo !== null && logo !== failedLogo ? (
        <img
          src={logo}
          alt=""
          onError={() => setFailedLogo(logo)}
          className="max-h-8 max-w-8 object-contain"
        />
      ) : initial ? (
        <span className="text-lg font-bold leading-none" aria-hidden="true">
          {initial}
        </span>
      ) : (
        <Hexagon className="h-6 w-6" />
      )}
    </div>
  );
}

export function Rail() {
  const { t } = useTranslation();
  const permissions = useAuthStore((s) => s.permissions);
  const agentAlerts = useAgentAlertsStore((s) => s.pendingCount);

  function hasAny(...perms: string[]) {
    return perms.some((p) => permissions.includes(p));
  }

  const showAdmin = hasAny(
    'users:user:view',
    'queues:queue:view',
    'campaigns:campaign:view',
    'system:tenant:configure',
    'routing:flow:view',
  );
  const showOperations = hasAny('reporting:realtime:view', 'contacts:conversation:monitor');
  const showAnalytics = hasAny('analytics:cdr:view', 'reporting:historical:view');

  function openCommandPalette() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }

  return (
    <nav data-print="hide" className="flex h-full w-12 flex-col items-center bg-rail-bg py-3">
      <BrandMark />

      <div className="flex flex-1 flex-col items-center gap-1">
        {showAdmin && <RailIcon to="/admin" icon={Settings} label={t('nav.admin')} />}
        {showOperations && (
          <RailIcon to="/operations" icon={Activity} label={t('nav.operations')} />
        )}
        {showAnalytics && (
          <RailIcon to="/analytics" icon={ChartColumn} label={t('nav.analytics')} />
        )}
        <div className="relative">
          <RailIcon to="/agent" icon={MessageSquare} label={t('nav.agent')} />
          {agentAlerts > 0 && (
            <span
              className="pointer-events-none absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white"
              data-testid="agent-rail-badge"
            >
              {agentAlerts > 9 ? '9+' : agentAlerts}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-1">
        <TenantBadge size="sm" />
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <button
                  {...props}
                  onClick={openCommandPalette}
                  // Icon-only trigger: the tooltip is not an accessible name, so axe flags this as
                  // `button-name`. Reuses the existing label key — no new string, no i18n parity churn.
                  aria-label={t('actions.search')}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-rail-icon hover:bg-slate-800 hover:text-rail-icon-active"
                />
              )}
            >
              <Command className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent side="right">{t('actions.search')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <NotificationBell />
        <UserMenu />
      </div>
    </nav>
  );
}
