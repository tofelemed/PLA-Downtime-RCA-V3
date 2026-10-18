import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { useCalendarPreference } from '@/lib/dates';
import type { ScheduleClass } from '../../model/downtime-filters';
import { formatCount } from '../../model/kpi-display';
import type { TrendRow } from '../../model/trend-rows';
import { ChartFigure } from '@/features/ux-kit/chart-figure';

/** Same schedule-class colours as the stop timeline (shared unit-state tokens, UX_AUDIT C-7). */
const COLORS: Record<ScheduleClass, string> = {
  planned: 'hsl(var(--state-planned))',
  unplanned: 'hsl(var(--state-stopped))',
  external: 'hsl(var(--state-starved))',
  unknown: 'hsl(var(--state-not-scheduled))',
};

export interface TrendChartProps {
  rows: readonly TrendRow[];
  classes: readonly ScheduleClass[];
  unit: 's' | 'count';
}

/** Stacked bars per site-local bucket and schedule class (lazy chunk with Recharts). */
export function TrendChart({ rows, classes, unit }: TrendChartProps) {
  const data = rows.map((row) => ({
    label: row.label,
    ...Object.fromEntries(classes.map((scheduleClass) => [scheduleClass, Number(row.values[scheduleClass] ?? 0)])),
  }));
  const { digits } = useCalendarPreference();
  const format = (value: unknown) => (unit === 's' ? formatDuration(Number(value), 'long', digits) : formatCount(String(value), digits));
  const caption = `Stacked ${unit === 's' ? 'downtime' : 'stop counts'} for ${rows.length} periods, split by schedule class (${classes.join(', ')}).`;
  return (
    <ChartFigure caption={caption} chartClassName="h-64 w-full" testId="trend-chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={format} allowDecimals={unit === 's'} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: unknown) => format(value)} />
          <Legend />
          {classes.map((scheduleClass) => (
            <Bar key={scheduleClass} dataKey={scheduleClass} stackId="class" fill={COLORS[scheduleClass]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
