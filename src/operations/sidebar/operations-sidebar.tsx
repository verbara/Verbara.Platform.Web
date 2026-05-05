import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Users, Megaphone, Radio, HardDrive } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarItem {
  labelKey: string;
  to: string;
  icon: LucideIcon;
}

const items: SidebarItem[] = [
  { labelKey: 'operations:sidebar.wallboard', to: '/operations/wallboard', icon: LayoutDashboard },
  { labelKey: 'operations:sidebar.monitor', to: '/operations/monitor', icon: Radio },
  { labelKey: 'operations:sidebar.agent_states', to: '/operations/agents', icon: Users },
  { labelKey: 'operations:sidebar.campaigns', to: '/operations/campaigns', icon: Megaphone },
  {
    labelKey: 'operations:sidebar.media_diagnostic',
    to: '/operations/media-diagnostic',
    icon: HardDrive,
  },
];

export function OperationsSidebar() {
  const { t } = useTranslation('operations');

  return (
    <nav className="flex h-full flex-col gap-1 py-3">
      <p className="px-4 pb-1 text-sm font-medium text-slate-500">{t('sidebar.wallboard')}</p>
      <ul className="space-y-0.5 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-brand/10 font-medium text-brand'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t(item.labelKey)}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
