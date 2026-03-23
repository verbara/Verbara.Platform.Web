import { useTranslation } from 'react-i18next';
import { KpiCard } from './kpi-card';
import { TrendChart } from './trend-chart';

// Mock data — volume by hour (today)
const volumeData = Array.from({ length: 24 }, (_, i) => ({
  name: `${String(i).padStart(2, '0')}:00`,
  value: Math.floor(Math.random() * 40 + (i >= 8 && i <= 18 ? 30 : 5)),
}));

// Mock data — SLA trend (7 days)
const slaTrendData = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map((d) => ({
  name: d,
  value: Math.floor(Math.random() * 15 + 80),
}));

// Mock data — channel distribution
const channelData = [
  { name: 'Voice', value: 420 },
  { name: 'WhatsApp', value: 310 },
  { name: 'Webchat', value: 180 },
  { name: 'Email', value: 90 },
];

export default function DashboardPage() {
  const { t } = useTranslation('analytics');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t('dashboard.title')}
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('dashboard.conversations_handled')}
          value="1,247"
          delta={12}
          deltaLabel="vs ayer"
        />
        <KpiCard
          label={t('dashboard.avg_wait')}
          value="28s"
          delta={-5}
          deltaLabel="vs ayer"
        />
        <KpiCard
          label={t('dashboard.avg_handle')}
          value="4m 12s"
          delta={3}
          deltaLabel="vs ayer"
        />
        <KpiCard
          label={t('dashboard.sla_percent')}
          value="87%"
          delta={2}
          deltaLabel="vs ayer"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendChart
          title={t('dashboard.volume_trend')}
          type="area"
          data={volumeData}
          dataKey="value"
        />
        <TrendChart
          title={t('dashboard.sla_trend')}
          type="line"
          data={slaTrendData}
          dataKey="value"
          color="#22c55e"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TrendChart
          title={t('dashboard.channel_distribution')}
          type="pie"
          data={channelData}
          dataKey="value"
        />
      </div>
    </div>
  );
}
