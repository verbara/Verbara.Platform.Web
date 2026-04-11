import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface OverlayChartPoint {
  label: string;
  volume: number;
  slaPercent: number;
}

interface OverlayChartProps {
  title: string;
  data: OverlayChartPoint[];
  volumeLabel?: string;
  slaLabel?: string;
  emptyLabel?: string;
}

export function OverlayChart({
  title,
  data,
  volumeLabel = 'Volume',
  slaLabel = 'SLA %',
  emptyLabel = 'No data available',
}: OverlayChartProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <p className="mb-4 text-sm font-medium text-slate-700 dark:text-slate-300">{title}</p>
      {data.length === 0 ? (
        <div className="flex h-[300px] items-center justify-center text-sm text-slate-400 dark:text-slate-500">
          {emptyLabel}
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                unit="%"
              />
              <Tooltip
                formatter={(value, name) => {
                  const num = typeof value === 'number' ? value : Number(value);
                  return String(name) === slaLabel
                    ? [`${num.toFixed(1)}%`, name]
                    : [num, name];
                }}
              />
              <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="left"
                dataKey="volume"
                name={volumeLabel}
                fill="hsl(var(--chart-1))"
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="slaPercent"
                name={slaLabel}
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--chart-2))' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
