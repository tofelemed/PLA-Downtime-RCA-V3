import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatDateTime, formatTime, useCalendarPreference } from '@/lib/dates';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { plural } from '@/features/ux-kit/format/plural';
import type { TrendPoint } from './historian-model';
import { ChartFigure } from '@/features/ux-kit/chart-figure';

export interface TrendSeries {
  id: string;
  name: string;
  points: readonly TrendPoint[];
}

export interface TrendChartProps {
  series: readonly TrendSeries[];
  timezone: string;
  /** label the time axis with dates instead of times */
  multiDay: boolean;
}

const COLORS = [1, 2, 3, 4, 5].map((n) => `hsl(var(--chart-${n}))`);

/** Line trend of stored samples per signal on the plant clock (lazy chunk with Recharts). */
export function TrendChart({ series, timezone, multiDay }: TrendChartProps) {
  const preference = useCalendarPreference();
  const options = { timeZone: timezone, ...preference };
  const { axis, number } = useNumberFormat();
  // sample values in the plant's digits (display only; up to 4 decimals as stored)
  const value = (raw: unknown) => (typeof raw === 'number' ? number(raw, 4) : String(raw));
  const tick = (value: number) => (multiDay ? formatDate : formatTime)(new Date(value).toISOString(), options);
  const label = (value: unknown) => (typeof value === 'number' ? formatDateTime(new Date(value).toISOString(), options) : '');
  const caption = `Step trend of the stored samples of ${plural(series.length, 'signal', 'signals', number)} (${series.map((entry) => entry.name).join(', ')}) on the plant clock.`;
  return (
    <ChartFigure caption={caption} chartClassName="h-80 w-full" testId="historian-trend-chart">
      <ResponsiveContainer>
        <LineChart margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={tick} tick={{ fontSize: 11 }} allowDuplicatedCategory={false} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} />
          <Tooltip labelFormatter={label} formatter={value} />
          <Legend />
          {series.map((entry, index) => (
            <Line key={entry.id} data={[...entry.points]} dataKey="value" name={entry.name} type="stepAfter" dot={false} isAnimationActive={false} stroke={COLORS[index % COLORS.length]} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFigure>
  );
}
