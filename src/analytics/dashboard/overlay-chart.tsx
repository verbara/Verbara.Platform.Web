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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis
                yAxisId="left"
                orientation="left"
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                stroke="#94a3b8"
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
                fill="#3b82f6"
                radius={[3, 3, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="slaPercent"
                name={slaLabel}
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#10b981' }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
