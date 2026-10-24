import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DowntimeGroupView } from '@/api/v2/types/reports';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { localizeNumber, useCalendarPreference } from '@/lib/dates';
import { formatCount, formatRatio } from '../../model/kpi-display';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { plural } from '@/features/ux-kit/format/plural';
import { CHART_TOOLTIP_STYLE, unbreakable } from '@/features/ux-kit/chart-text';
import { paretoAxisLabel } from '../../model/reason-drill';

export interface ParetoChartProps {
  groups: readonly DowntimeGroupView[];
  unit: 's' | 'count';
  labelOf: (group: DowntimeGroupView) => string;
  onBar: (group: DowntimeGroupView) => void;
}

interface Point {
  group: DowntimeGroupView;
  name: string;
  value: number;
  /** the server's cumulative share, scaled to the 0–100 axis for drawing */
  cumulative: number | null;
}

/**
 * Pareto of the server groups (lazy chunk with Recharts): bars = the server value, line = the server's
 * cumulative share. Numbers are only scaled for drawing; labels use the shared formatters.
 */
export function ParetoChart({ groups, unit, labelOf, onBar }: ParetoChartProps) {
  const points: Point[] = groups.map((group) => ({
    group,
    name: labelOf(group),
    value: Number(group.value),
    cumulative: group.cumulativeShare === null ? null : Number(group.cumulativeShare) * 100,
  }));
  const { digits } = useCalendarPreference();
  const format = (value: unknown) => (unit === 's' ? formatDuration(Number(value), 'long', digits) : formatCount(String(value), digits));
  const top = points[0];
  const caption = top
    ? `Pareto of ${plural(points.length, 'group', 'groups')} by ${unit === 's' ? 'downtime' : 'stop count'}, largest first; the largest is ${top.name} (${format(top.value)}).`
    : 'Pareto with no groups.';
  return (
    <ChartFigure caption={caption} chartClassName="h-72 w-full" testId="pareto-chart">
      <ResponsiveContainer>
        <ComposedChart data={points} margin={{ top: 16, right: 16, bottom: 16, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={72} tickMargin={4} tickFormatter={paretoAxisLabel} />
          <YAxis yAxisId="value" tickFormatter={(value: unknown) => unbreakable(format(value))} allowDecimals={unit === 's'} tick={{ fontSize: 11 }} width={unit === 's' ? 80 : 48} />
          <YAxis yAxisId="share" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => localizeNumber(`${v} %`, digits)} tick={{ fontSize: 11 }} />
          <Tooltip
            {...CHART_TOOLTIP_STYLE}
            formatter={(value: unknown, name: string, item: { payload?: Point }) =>
              name === 'cumulative' ? formatRatio(item.payload?.group.cumulativeShare, 1, digits) : format(value)
            }
          />
          <Bar yAxisId="value" dataKey="value" fill="hsl(var(--danger))" onClick={(point: { payload?: Point }) => point.payload && onBar(point.payload.group)} cursor="pointer">
            <LabelList dataKey="value" position="top" formatter={format} fontSize={11} />
          </Bar>
          <Line yAxisId="share" dataKey="cumulative" stroke="hsl(var(--heading))" dot />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
