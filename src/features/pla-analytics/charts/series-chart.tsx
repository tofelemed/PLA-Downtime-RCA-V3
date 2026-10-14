import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface SeriesRow {
  label: string;
  /** server decimal strings per series (null = not available, drawn as a gap) */
  values: Record<string, string | null>;
}

export interface SeriesChartProps {
  rows: readonly SeriesRow[];
  series: ReadonlyArray<{ key: string; label: string }>;
  kind: 'line' | 'bar';
  /** values are ratios 0..1 shown as percentages on the axis */
  ratio?: boolean;
}

const COLOURS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142 70% 40%)', 'hsl(38 92% 50%)'];

/**
 * Time series of server values (lazy chunk, plan 3.6): each point is a server figure converted to a number
 * for drawing only; nothing is summed or averaged here.
 */
export function SeriesChart({ rows, series, kind, ratio }: SeriesChartProps) {
  const points = rows.map((row) => ({
    label: row.label,
    ...Object.fromEntries(series.map((s) => [s.key, row.values[s.key] === null || row.values[s.key] === undefined ? null : Number(row.values[s.key])])),
  }));
  const { axis: tick, number, percent } = useNumberFormat();
  // ticks and tooltips in the plant's digits; ratios as percentages (drawing only, nothing derived)
  const axis = (value: number) => (ratio ? percent(value * 100) : tick(value));
  const Chart = kind === 'line' ? LineChart : BarChart;
  return (
    <div className="h-64 w-full" aria-hidden>
      <ResponsiveContainer>
        <Chart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} />
          <Tooltip formatter={(value: unknown) => (typeof value === 'number' ? (ratio ? percent(value * 100, 1) : number(value, 2)) : String(value))} />
          <Legend />
          {series.map((s, index) =>
            kind === 'line' ? (
              <Line key={s.key} dataKey={s.key} name={s.label} stroke={COLOURS[index % COLOURS.length]} connectNulls={false} isAnimationActive={false} />
            ) : (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={COLOURS[index % COLOURS.length]} isAnimationActive={false} />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}
