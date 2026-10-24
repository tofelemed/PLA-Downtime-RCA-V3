import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatRatio } from '@/features/downtime-analysis/model/kpi-display';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { CHART_TOOLTIP_STYLE, unbreakable } from '@/features/ux-kit/chart-text';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { localizeNumber, useCalendarPreference } from '@/lib/dates';

export interface ParetoBar {
  name: string;
  /** seconds, as the server states them */
  value: string;
  /** the server's cumulative share, 0..1 */
  cumulativeShare: string | null;
}

/** "CODE · Name" → "CODE" for the axis (the tooltip keeps the full label); a label without " · " is kept whole. */
export function reasonCodeOf(label: string): string {
  const cut = label.indexOf(' · ');
  return cut > 0 ? label.slice(0, cut) : label;
}

interface TooltipItem {
  payload?: { cumulativeShare: string | null };
}

/** Bars = the server's downtime per reason; line = the server's cumulative share (scaled to 0–100 for drawing only). */
export function DowntimeParetoBars({ rows }: { rows: readonly ParetoBar[] }) {
  const { digits } = useCalendarPreference();
  const points = rows.map((row) => ({ ...row, seconds: Number(row.value), cumulative: row.cumulativeShare === null ? null : Number(row.cumulativeShare) * 100 }));
  const seconds = (value: unknown) => formatDuration(Number(value), 'long', digits);
  const top = points[0];
  const caption = top ? `Pareto of the ${rows.length} largest unplanned stop reasons by downtime; the largest is ${top.name} (${seconds(top.seconds)}).` : 'Pareto with no reasons.';
  return (
    <ChartFigure caption={caption} chartClassName="h-64 w-full" testId="downtime-pareto-chart">
      <ResponsiveContainer>
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 16, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={64} tickMargin={4} tickFormatter={reasonCodeOf} />
          <YAxis yAxisId="time" tick={{ fontSize: 11 }} width={80} tickFormatter={(value: unknown) => unbreakable(seconds(value))} />
          <YAxis yAxisId="share" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => localizeNumber(`${v} %`, digits)} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value: unknown, name: string, item: TooltipItem) => (name === 'Cumulative share' ? formatRatio(item.payload?.cumulativeShare, 1, digits) : seconds(value))} />
          <Bar yAxisId="time" dataKey="seconds" name="Unplanned downtime" fill="hsl(var(--danger))" isAnimationActive={false} />
          <Line yAxisId="share" dataKey="cumulative" name="Cumulative share" stroke="hsl(var(--heading))" dot isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
