import { useTranslation } from 'react-i18next';
import { RailIcon } from './rail-icon';
import { UserMenu } from './user-menu';
import { useAuthStore } from '@/core/auth/auth-store';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/core/ui/tooltip';
import { Settings, Activity, BarChart3, MessageSquare, Hexagon, Command } from 'lucide-react';

export function Rail() {
  const { t } = useTranslation();
  const hasFeature = useAuthStore((s) => s.hasFeature);

  function openCommandPalette() {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  }

  return (
    <nav className="flex h-full w-12 flex-col items-center bg-rail-bg py-3">
      <div className="mb-6 text-brand">
        <Hexagon className="h-6 w-6" />
      </div>

      <div className="flex flex-1 flex-col items-center gap-1">
        <RailIcon to="/admin" icon={Settings} label={t('nav.admin')} />
        <RailIcon to="/operations" icon={Activity} label={t('nav.operations')} />
        {hasFeature('analytics') && (
          <RailIcon to="/analytics" icon={BarChart3} label={t('nav.analytics')} />
        )}
        <RailIcon to="/agent" icon={MessageSquare} label={t('nav.agent')} />
      </div>

      <div className="flex flex-col items-center gap-1">
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <button
                  {...props}
                  onClick={openCommandPalette}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-rail-icon hover:bg-slate-800 hover:text-rail-icon-active"
                />
              )}
            >
              <Command className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent side="right">{t('actions.search')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <UserMenu />
      </div>
    </nav>
  );
}
