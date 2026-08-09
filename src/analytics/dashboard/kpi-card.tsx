import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
}

export function KpiCard({ label, value, delta, deltaLabel }: KpiCardProps) {
  const isPositive = delta != null && delta >= 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      {delta != null && (
        <div className="mt-2 flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          )}
          <span
            className={`text-xs font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}
          >
            {isPositive ? '+' : ''}
            {delta}%
          </span>
          {deltaLabel && <span className="text-xs text-slate-500">{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
}
