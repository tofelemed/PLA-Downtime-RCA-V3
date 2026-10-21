import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useNavigate, type To } from 'react-router-dom';
import type { WaterfallBarView } from '@/api/v2/types/period-overview';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { waterfallBarLabel } from '../model/display';

interface Point {
  name: string;
  /** [start, end] of the server bar, as numbers for drawing only */
  range: [number, number];
  bar: WaterfallBarView;
  /** the server's change (or total) as display text */
  valueText: string;
}

// totals neutral, losses red, gains green (waterfall convention); never the branding colour (owner 21 Oct 2026)
const COLOURS = { total: 'hsl(var(--chart-8))', loss: 'hsl(var(--destructive))', gain: 'hsl(var(--success))' } as const;

const toneOf = (bar: WaterfallBarView): keyof typeof COLOURS => {
  if (bar.kind === 'total') return 'total';
  return bar.delta !== null && bar.delta.startsWith('-') ? 'loss' : 'gain';
};

const LEGEND: Array<{ tone: keyof typeof COLOURS; label: string }> = [
  { tone: 'loss', label: 'Loss' },
  { tone: 'gain', label: 'Gain' },
  { tone: 'total', label: 'Total' },
];

function WaterfallLegend() {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" data-testid="waterfall-legend" aria-label="Legend">
      {LEGEND.map(({ tone, label }) => (
        <li key={tone} className="flex items-center gap-1">
          <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: COLOURS[tone] }} />
          {label}
        </li>
      ))}
    </ul>
  );
}

export interface WaterfallChartProps {
  bars: readonly WaterfallBarView[];
  uom: string | null;
  /** drill-down of a bar (a click opens it); the same links are listed as text by the caller for keyboards */
  barLink?: (bar: WaterfallBarView) => To | null;
}

/** Floating bars of the server's [start, end] (Recharts range bars) labelled with the server's figures: nothing is summed in the browser. */
export function WaterfallChart({ bars, uom, barLink }: WaterfallChartProps) {
  const { axis, decimal } = useNumberFormat();
  const navigate = useNavigate();
  const unit = uom ? ` ${uom}` : '';
  const points: Point[] = bars.map((bar) => ({ name: waterfallBarLabel(bar), range: [Number(bar.start), Number(bar.end)], bar, valueText: decimal(bar.kind === 'total' ? bar.end : bar.delta ?? bar.end, 1) }));
  const first = bars[0];
  const last = bars[bars.length - 1];
  const caption = first && last
    ? `Waterfall of ${bars.length} bars from ${waterfallBarLabel(first)} (${decimal(first.end)}${unit}) to ${waterfallBarLabel(last)} (${decimal(last.end)}${unit}).`
    : 'Waterfall with no bars.';
  return (
    <div className="space-y-1">
      <WaterfallLegend />
      <ChartFigure caption={caption} chartClassName="h-80 w-full" testId="waterfall-chart">
        <ResponsiveContainer>
          <BarChart data={points} margin={{ top: 20, right: 16, bottom: 8, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={72} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} label={{ value: uom ? `Quantity (${uom})` : 'Quantity (unit unknown)', angle: -90, position: 'insideLeft', style: { fontSize: 11, textAnchor: 'middle' } }} />
            <Tooltip formatter={(_value: unknown, _name: string, item: { payload?: Point }) => `${decimal(item.payload?.bar.delta ?? item.payload?.bar.end)}${unit}`} />
            <Bar dataKey="range" isAnimationActive={false}>
              {points.map((p) => {
                const to = barLink?.(p.bar) ?? null;
                return <Cell key={p.bar.key} fill={COLOURS[toneOf(p.bar)]} cursor={to ? 'pointer' : undefined} onClick={to ? () => navigate(to) : undefined} />;
              })}
              <LabelList dataKey="valueText" position="top" style={{ fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
    </div>
  );
}
