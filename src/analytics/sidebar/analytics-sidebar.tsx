import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  ChartColumn,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Table,
  Users,
  AudioWaveform,
  Disc3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SidebarItem {
  labelKey: string;
  to: string;
  icon: LucideIcon;
}

const items: SidebarItem[] = [
  { labelKey: 'sidebar.dashboard', to: '/analytics/dashboard', icon: ChartColumn },
  { labelKey: 'sidebar.cdr', to: '/analytics/cdr', icon: FileText },
  { labelKey: 'sidebar.qa', to: '/analytics/qa', icon: ClipboardCheck },
  { labelKey: 'sidebar.surveys', to: '/analytics/surveys', icon: ClipboardList },
  { labelKey: 'sidebar.intervals', to: '/analytics/intervals', icon: Table },
  { labelKey: 'sidebar.agent_intervals', to: '/analytics/agent-intervals', icon: Users },
  { labelKey: 'sidebar.speech', to: '/analytics/speech', icon: AudioWaveform },
  { labelKey: 'sidebar.recordings', to: '/analytics/recordings', icon: Disc3 },
];

export function AnalyticsSidebar() {
  const { t } = useTranslation('analytics');

  return (
    <nav className="flex h-full flex-col gap-1 py-3">
      <p className="px-4 pb-1 text-sm font-medium text-slate-500">{t('sidebar.dashboard')}</p>
      <ul className="space-y-0.5 px-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                // Locale-proof handle for E2E: the visible label is translated, the route is not.
                data-testid={`sidebar-link-${item.to.split('/').pop()}`}
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
