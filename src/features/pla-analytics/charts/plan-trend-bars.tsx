import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

export interface PlanBar {
  label: string;
  actual: string | null;
  explained: string | null;
  unexplained: string | null;
}

export const PLAN_BAR_SERIES = [
  { key: 'actual', label: 'Actual', colour: 'hsl(var(--chart-8))' },
  { key: 'explained', label: 'Explained loss', colour: 'hsl(var(--chart-2))' },
  { key: 'unexplained', label: 'Unexplained', colour: 'hsl(var(--danger))' },
] as const;

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' },
  labelStyle: { color: 'hsl(var(--popover-foreground))' },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
} as const;

const toNumber = (value: string | null) => (value === null ? null : Number(value));

/** Per bucket one stacked bar: actual, explained loss and unexplained loss as the server states them (drawn, never summed here). */
export function PlanTrendBars({ rows, uom }: { rows: readonly PlanBar[]; uom: string }) {
  const { axis, number } = useNumberFormat();
  const points = rows.map((row) => ({ label: row.label, actual: toNumber(row.actual), explained: toNumber(row.explained), unexplained: toNumber(row.unexplained) }));
  return (
    <ChartFigure caption={`Stacked bar chart in ${uom} of actual output, explained loss and unexplained loss over ${rows.length} periods.`} chartClassName="h-64 w-full" testId="plan-trend-chart">
      <ResponsiveContainer>
        <BarChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value: unknown) => (typeof value === 'number' ? `${number(value, 2)} ${uom}` : String(value))} />
          <Legend />
          {PLAN_BAR_SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="plan" fill={s.colour} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
