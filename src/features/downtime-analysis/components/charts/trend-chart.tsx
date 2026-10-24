import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { useCalendarPreference } from '@/lib/dates';
import type { ScheduleClass } from '../../model/downtime-filters';
import { formatCount } from '../../model/kpi-display';
import type { TrendRow } from '../../model/trend-rows';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { CHART_TOOLTIP_STYLE, unbreakable } from '@/features/ux-kit/chart-text';
import { plural } from '@/features/ux-kit/format/plural';
import { labelOf, SCHEDULE_CLASS_LABELS } from '@/features/ux-kit/labels';
import { legendText } from '@/features/pla-analytics/charts/downtime-trend-bars';
import { CLASS_COLOURS } from '../../model/class-colours';


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
  const names = classes.map((scheduleClass) => labelOf(SCHEDULE_CLASS_LABELS, scheduleClass));
  const caption = `Stacked ${unit === 's' ? 'downtime' : 'stop counts'} for ${plural(rows.length, 'period', 'periods')}, split by schedule class (${names.join(', ')}).`;
  return (
    <ChartFigure caption={caption} chartClassName="h-64 w-full" testId="trend-chart">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={(value: unknown) => unbreakable(format(value))} allowDecimals={unit === 's'} tick={{ fontSize: 11 }} width={unit === 's' ? 80 : 48} />
          <Tooltip formatter={(value: unknown) => format(value)} {...CHART_TOOLTIP_STYLE} />
          <Legend formatter={legendText} />
          {classes.map((scheduleClass) => (
            <Bar key={scheduleClass} dataKey={scheduleClass} name={labelOf(SCHEDULE_CLASS_LABELS, scheduleClass)} stackId="class" fill={CLASS_COLOURS[scheduleClass].chart} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
