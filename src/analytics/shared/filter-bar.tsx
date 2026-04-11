import { useTranslation } from 'react-i18next';
import { DateRangePicker, type DateRange } from './date-range-picker';
import { ExportButton } from './export-button';
import { useQueues } from '@/core/api/hooks/use-queues';
import { useAnalyticsFilterStore } from '@/core/stores/analytics-filter-store';

const CHANNELS = ['voice', 'whatsapp', 'webchat', 'email'];

// Kept for external consumers that destructure FilterState
export interface FilterState {
  from: string;
  to: string;
  queue: string;
  channel: string;
}

export function FilterBar() {
  const { t } = useTranslation('analytics');
  const { data: queues = [] } = useQueues();
  const { from, to, queue, channel, setFilters } = useAnalyticsFilterStore();

  const handleDateChange = (range: DateRange) => {
    setFilters({ from: range.from, to: range.to });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-2.5 dark:border-slate-700 dark:bg-slate-800">
      <DateRangePicker value={{ from, to }} onChange={handleDateChange} />

      <select
        value={queue}
        onChange={(e) => setFilters({ queue: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      >
        <option value="">{t('filters.queue')}</option>
        {queues.map((q) => (
          <option key={q.id} value={q.name}>
            {q.name}
          </option>
        ))}
      </select>

      <select
        value={channel}
        onChange={(e) => setFilters({ channel: e.target.value })}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      >
        <option value="">{t('filters.channel')}</option>
        {CHANNELS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="ml-auto">
        <ExportButton />
      </div>
    </div>
  );
}
