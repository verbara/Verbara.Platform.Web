import { useTranslation } from 'react-i18next';

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t } = useTranslation('analytics');

  const presets: { label: string; from: string; to: string }[] = [
    { label: t('filters.today'), from: todayStr(), to: todayStr() },
    { label: t('filters.last_7d'), from: daysAgo(7), to: todayStr() },
    { label: t('filters.last_30d'), from: daysAgo(30), to: todayStr() },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange({ from: p.from, to: p.to })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              value.from === p.from && value.to === p.to
                ? 'bg-brand text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        />
        <span className="text-xs text-slate-400">–</span>
        <input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
        />
      </div>
    </div>
  );
}
