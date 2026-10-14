import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatDateTime, formatTime, useCalendarPreference } from '@/lib/dates';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import type { TrendPoint } from './historian-model';

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

const COLORS = ['hsl(210 70% 45%)', 'hsl(25 85% 50%)', 'hsl(150 55% 35%)', 'hsl(280 50% 50%)', 'hsl(0 65% 50%)'];

/** Line trend of stored samples per signal on the plant clock (lazy chunk with Recharts). */
export function TrendChart({ series, timezone, multiDay }: TrendChartProps) {
  const preference = useCalendarPreference();
  const options = { timeZone: timezone, ...preference };
  const { axis, number } = useNumberFormat();
  // sample values in the plant's digits (display only; up to 4 decimals as stored)
  const value = (raw: unknown) => (typeof raw === 'number' ? number(raw, 4) : String(raw));
  const tick = (value: number) => (multiDay ? formatDate : formatTime)(new Date(value).toISOString(), options);
  const label = (value: unknown) => (typeof value === 'number' ? formatDateTime(new Date(value).toISOString(), options) : '');
  return (
    <div className="h-80 w-full" aria-hidden>
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
    </div>
  );
}
