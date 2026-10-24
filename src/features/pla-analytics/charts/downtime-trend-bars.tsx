import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ScheduleClass } from '@/features/downtime-analysis/model/downtime-filters';
import { formatCount } from '@/features/downtime-analysis/model/kpi-display';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { CHART_TOOLTIP_STYLE, unbreakable } from '@/features/ux-kit/chart-text';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { SCHEDULE_CLASS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { useCalendarPreference } from '@/lib/dates';

export interface DowntimeBar {
  label: string;
  durations: Partial<Record<ScheduleClass, string>>;
  stops: string | null;
}

/** Unplanned = danger, planned = neutral slate, external and unknown = muted greys, stops = the heading colour. */
const DOWNTIME_CLASS_COLOURS: Readonly<Record<ScheduleClass, string>> = {
  unplanned: 'hsl(var(--danger))',
  planned: 'hsl(var(--chart-8))',
  external: 'hsl(var(--state-not-scheduled))',
  unknown: 'hsl(var(--state-unknown))',
};
const STOPS_COLOUR = 'hsl(var(--heading))';

const toNumber = (value: string | null | undefined) => (value === null || value === undefined ? null : Number(value));

/** Stacked downtime per step by schedule class (server values, drawn not summed) with the stop count as a line on its own axis. */
export function DowntimeTrendBars({ rows, classes }: { rows: readonly DowntimeBar[]; classes: readonly ScheduleClass[] }) {
  const { digits } = useCalendarPreference();
  const points = rows.map((row) => ({ label: row.label, stops: toNumber(row.stops), ...Object.fromEntries(classes.map((c) => [c, toNumber(row.durations[c])])) }));
  const seconds = (value: unknown) => formatDuration(Number(value), 'long', digits);
  const names = classes.map((c) => labelOf(SCHEDULE_CLASS_LABELS, c)).join(', ');
  return (
    <ChartFigure caption={`Stacked downtime over ${rows.length} periods by schedule class (${names}), with the number of stops as a line.`} chartClassName="h-64 w-full" testId="downtime-trend-chart">
      <ResponsiveContainer>
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="time" tick={{ fontSize: 11 }} width={80} tickFormatter={(value: unknown) => unbreakable(seconds(value))} />
          <YAxis yAxisId="stops" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} width={40} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value: unknown, name: string) => (name === 'Stops' ? formatCount(String(value), digits) : seconds(value))} />
          <Legend />
          {classes.map((c) => (
            <Bar key={c} yAxisId="time" dataKey={c} name={labelOf(SCHEDULE_CLASS_LABELS, c)} stackId="class" fill={DOWNTIME_CLASS_COLOURS[c]} isAnimationActive={false} />
          ))}
          <Line yAxisId="stops" dataKey="stops" name="Stops" stroke={STOPS_COLOUR} strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
