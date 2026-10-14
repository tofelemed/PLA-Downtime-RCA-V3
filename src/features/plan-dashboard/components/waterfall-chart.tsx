import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WaterfallBarView } from '@/api/v2/types/period-overview';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

interface Point {
  name: string;
  /** [start, end] of the server bar, as numbers for drawing only */
  range: [number, number];
  bar: WaterfallBarView;
}

const colourOf = (bar: WaterfallBarView) => {
  if (bar.kind === 'total') return 'hsl(var(--primary))';
  return bar.delta !== null && bar.delta.startsWith('-') ? 'hsl(var(--destructive))' : 'hsl(142 70% 40%)';
};

/** Floating bars of the server's [start, end] (Recharts range bars): nothing is summed in the browser. */
export function WaterfallChart({ bars, uom }: { bars: readonly WaterfallBarView[]; uom: string | null }) {
  const points: Point[] = bars.map((bar) => ({ name: bar.label, range: [Number(bar.start), Number(bar.end)], bar }));
  const unit = uom ? ` ${uom}` : '';
  const { axis, decimal } = useNumberFormat();
  return (
    <div className="h-64 w-full" aria-hidden>
      <ResponsiveContainer>
        <BarChart data={points} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={axis} />
          <Tooltip formatter={(_value: unknown, _name: string, item: { payload?: Point }) => `${decimal(item.payload?.bar.delta ?? item.payload?.bar.end)}${unit}`} />
          <Bar dataKey="range" isAnimationActive={false}>
            {points.map((p) => (
              <Cell key={p.bar.key} fill={colourOf(p.bar)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
