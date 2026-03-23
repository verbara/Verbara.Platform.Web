import { useTranslation } from 'react-i18next';
import { RailIcon } from './rail-icon';
import { UserMenu } from './user-menu';
import { useAuthStore } from '@/core/auth/auth-store';
import { Settings, Activity, BarChart3, MessageSquare, Hexagon } from 'lucide-react';

export function Rail() {
  const { t } = useTranslation();
  const hasFeature = useAuthStore((s) => s.hasFeature);

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
        <UserMenu />
      </div>
    </nav>
  );
}
