import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangePicker, type DateRange } from './date-range-picker';
import { ExportButton } from './export-button';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const QUEUES = ['support', 'sales', 'billing'];
const CHANNELS = ['voice', 'whatsapp', 'webchat', 'email'];

export function FilterBar() {
  const { t } = useTranslation('analytics');

  const [dateRange, setDateRange] = useState<DateRange>({
    from: daysAgo(7),
    to: todayStr(),
  });
  const [queue, setQueue] = useState('');
  const [channel, setChannel] = useState('');

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-2.5 dark:border-slate-700 dark:bg-slate-800">
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      <select
        value={queue}
        onChange={(e) => setQueue(e.target.value)}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
      >
        <option value="">{t('filters.queue')}</option>
        {QUEUES.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
      </select>

      <select
        value={channel}
        onChange={(e) => setChannel(e.target.value)}
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
