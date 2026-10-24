import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { plural } from '@/features/ux-kit/format/plural';
import { SeriesValuesTable } from './series-values-table';

export interface SeriesRow {
  label: string;
  /** server decimal strings per series (null = not available, drawn as a gap) */
  values: Record<string, string | null>;
}

export interface SeriesChartProps {
  rows: readonly SeriesRow[];
  /** `colour` (a theme-token colour) overrides the palette position */
  series: ReadonlyArray<{ key: string; label: string; colour?: string }>;
  kind: 'line' | 'bar';
  /** values are ratios 0..1 shown as percentages on the axis */
  ratio?: boolean;
  /** offer the drawn values as a table ("View values") under the chart */
  valuesTable?: boolean;
  /** the chart's own legend (default on); off when the caller draws its own */
  legend?: boolean;
}

const COLOURS = ['hsl(var(--chart-1))', 'hsl(var(--chart-5))', 'hsl(var(--chart-3))', 'hsl(var(--chart-2))'];

/** Tooltip text in the foreground colour on the popover surface (axe colour-contrast: series colours are too light as text). */
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' },
  labelStyle: { color: 'hsl(var(--popover-foreground))' },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
} as const;

/**
 * Time series of server values (lazy chunk, plan 3.6): each point is a server figure converted to a number
 * for drawing only; nothing is summed or averaged here.
 */
export function SeriesChart({ rows, series, kind, ratio, valuesTable = false, legend = true }: SeriesChartProps) {
  const points = rows.map((row) => ({
    label: row.label,
    ...Object.fromEntries(series.map((s) => [s.key, row.values[s.key] === null || row.values[s.key] === undefined ? null : Number(row.values[s.key])])),
  }));
  const { axis: tick, number, percent } = useNumberFormat();
  // ticks and tooltips in the plant's digits; ratios as percentages (drawing only, nothing derived)
  const axis = (value: number) => (ratio ? percent(value * 100) : tick(value));
  const Chart = kind === 'line' ? LineChart : BarChart;
  const caption = `${kind === 'line' ? 'Line' : 'Bar'} chart of ${series.map((s) => s.label).join(', ')} over ${plural(rows.length, 'period', 'periods')}.`;
  return (
    <ChartFigure
      caption={caption}
      chartClassName="h-64 w-full"
      testId="series-chart"
      tableLabel="View values"
      table={valuesTable ? <SeriesValuesTable rows={rows} series={series} ratio={ratio} caption={`Values of the ${series.map((s) => s.label).join(', ')} chart`} /> : undefined}
    >
      <ResponsiveContainer>
        <Chart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value: unknown) => (typeof value === 'number' ? (ratio ? percent(value * 100, 1) : number(value, 2)) : String(value))} />
          {legend && <Legend />}
          {series.map((s, index) =>
            kind === 'line' ? (
              <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.colour ?? COLOURS[index % COLOURS.length]} connectNulls={false} isAnimationActive={false} />
            ) : (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.colour ?? COLOURS[index % COLOURS.length]} isAnimationActive={false} />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
