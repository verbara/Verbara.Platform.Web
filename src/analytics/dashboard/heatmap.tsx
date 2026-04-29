import { useTranslation } from 'react-i18next';

export interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  value: number;
}

interface HeatmapProps {
  readonly title: string;
  readonly data: HeatmapCell[];
  readonly dayLabels?: string[];
  readonly emptyLabel?: string;
}

const DAY_KEYS = [
  'dashboard.day_mon',
  'dashboard.day_tue',
  'dashboard.day_wed',
  'dashboard.day_thu',
  'dashboard.day_fri',
  'dashboard.day_sat',
  'dashboard.day_sun',
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function interpolateBlue(ratio: number): string {
  return `hsl(var(--primary) / ${Math.round(ratio * 90 + 5)}%)`;
}

export function Heatmap({
  title,
  data,
  dayLabels,
  emptyLabel,
}: HeatmapProps) {
  const { t } = useTranslation('analytics');
  const resolvedDayLabels = dayLabels ?? DAY_KEYS.map((k) => t(k));
  const resolvedEmptyLabel = emptyLabel ?? t('dashboard.no_data');
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;

  const lookup = new Map<number, Map<number, number>>();
  for (const cell of data) {
    if (!lookup.has(cell.dayOfWeek)) lookup.set(cell.dayOfWeek, new Map());
    lookup.get(cell.dayOfWeek)!.set(cell.hour, cell.value);
  }

  const isEmpty = data.length === 0 || maxValue === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>

      {isEmpty ? (
        <div className="flex h-44 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          {resolvedEmptyLabel}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px] text-xs">
            <thead>
              <tr>
                <th className="w-10" />
                {HOURS.map((h) => (
                  <th
                    key={h}
                    className="w-6 text-center font-normal text-slate-500 dark:text-slate-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resolvedDayLabels.map((dayLabel, dayIndex) => (
                <tr key={dayIndex}>
                  <td className="pr-2 text-right font-normal text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {dayLabel}
                  </td>
                  {HOURS.map((hour) => {
                    const val = lookup.get(dayIndex)?.get(hour) ?? 0;
                    const ratio = maxValue > 0 ? val / maxValue : 0;
                    const bg = interpolateBlue(ratio);
                    const textColor = ratio > 0.55 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))';
                    return (
                      <td
                        key={hour}
                        title={`${dayLabel} ${hour}:00 — ${val}`}
                        style={{ backgroundColor: bg, color: textColor }}
                        className="h-6 w-6 cursor-default rounded text-center align-middle leading-6 transition-opacity hover:opacity-80"
                      >
                        {val > 0 ? val : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
