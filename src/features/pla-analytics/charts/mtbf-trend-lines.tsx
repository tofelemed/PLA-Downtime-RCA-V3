import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { CHART_TOOLTIP_STYLE, unbreakable } from '@/features/ux-kit/chart-text';
import { formatDuration } from '@/features/ux-kit/format/duration';
import { useCalendarPreference } from '@/lib/dates';

export interface ReliabilityBar {
  label: string;
  /** seconds, as the server states them */
  mtbf: string | null;
  mttr: string | null;
}

const MTBF_COLOUR = 'hsl(var(--primary))';
const MTTR_COLOUR = 'hsl(var(--chart-2))';

const toNumber = (value: string | null) => (value === null ? null : Number(value));

/** MTBF (solid, left axis) and MTTR (dashed, right axis) per month as the server states them; each has its own scale. */
export function MtbfTrendLines({ rows }: { rows: readonly ReliabilityBar[] }) {
  const { digits } = useCalendarPreference();
  const points = rows.map((row) => ({ label: row.label, mtbf: toNumber(row.mtbf), mttr: toNumber(row.mttr) }));
  const seconds = (value: unknown) => formatDuration(Number(value), 'long', digits);
  return (
    <ChartFigure caption={`Mean time between failures (solid line) and mean time to repair (dashed line) over ${rows.length} months.`} chartClassName="h-64 w-full" testId="mtbf-trend-chart">
      <ResponsiveContainer>
        <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="mtbf" tick={{ fontSize: 11 }} width={80} tickFormatter={(value: unknown) => unbreakable(seconds(value))} />
          <YAxis yAxisId="mttr" orientation="right" tick={{ fontSize: 11 }} width={80} tickFormatter={(value: unknown) => unbreakable(seconds(value))} />
          <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value: unknown) => seconds(value)} />
          <Legend />
          <Line yAxisId="mtbf" dataKey="mtbf" name="MTBF" stroke={MTBF_COLOUR} strokeWidth={2} dot={{ r: 2 }} connectNulls isAnimationActive={false} />
          <Line yAxisId="mttr" dataKey="mttr" name="MTTR" stroke={MTTR_COLOUR} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
