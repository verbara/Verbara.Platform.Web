export interface HeatmapCell {
  dayOfWeek: number; // 0 = Monday … 6 = Sunday
  hour: number;      // 0 – 23
  value: number;
}

interface HeatmapProps {
  title: string;
  data: HeatmapCell[];
  dayLabels?: string[];
  emptyLabel?: string;
}

const DEFAULT_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function interpolateBlue(ratio: number): string {
  // White (255,255,255) → light blue (219,234,254) → brand blue (59,130,246)
  const r = Math.round(255 - ratio * (255 - 59));
  const g = Math.round(255 - ratio * (255 - 130));
  const b = Math.round(255 - ratio * (255 - 246));
  return `rgb(${r},${g},${b})`;
}

export function Heatmap({
  title,
  data,
  dayLabels = DEFAULT_DAY_LABELS,
  emptyLabel = 'No data available',
}: HeatmapProps) {
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;

  // Build lookup: dayOfWeek → hour → value
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
          {emptyLabel}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px] text-xs">
            <thead>
              <tr>
                {/* Corner spacer */}
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
              {dayLabels.map((dayLabel, dayIndex) => (
                <tr key={dayIndex}>
                  <td className="pr-2 text-right font-normal text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {dayLabel}
                  </td>
                  {HOURS.map((hour) => {
                    const val = lookup.get(dayIndex)?.get(hour) ?? 0;
                    const ratio = maxValue > 0 ? val / maxValue : 0;
                    const bg = interpolateBlue(ratio);
                    const textColor = ratio > 0.55 ? '#ffffff' : '#1e293b';
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
