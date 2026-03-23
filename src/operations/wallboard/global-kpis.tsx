import { useTranslation } from 'react-i18next';
import { MessageSquare, Users, Target } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}

function KpiCard({ label, value, icon: Icon, color }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

interface GlobalKpisProps {
  totalActive: number;
  totalAgents: number;
  globalSla: number;
}

export function GlobalKpis({ totalActive, totalAgents, globalSla }: GlobalKpisProps) {
  const { t } = useTranslation('operations');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label={t('wallboard.total_active')}
        value={totalActive}
        icon={MessageSquare}
        color="bg-blue-500"
      />
      <KpiCard
        label={t('wallboard.total_agents')}
        value={totalAgents}
        icon={Users}
        color="bg-emerald-500"
      />
      <KpiCard
        label={t('wallboard.global_sla')}
        value={`${globalSla}%`}
        icon={Target}
        color={globalSla >= 80 ? 'bg-emerald-500' : globalSla >= 60 ? 'bg-amber-500' : 'bg-red-500'}
      />
    </div>
  );
}
