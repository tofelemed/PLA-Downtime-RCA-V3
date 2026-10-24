import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLossTree } from '@/api/v2/queries/pla-analytics';
import type { LossTreeGroupView } from '@/api/v2/types/pla-analytics';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { ChartFigure } from '@/features/ux-kit/chart-figure';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { lossTreeQuery, type AnalyticsScope } from '../model/analytics-scope';
import { OEE_METRIC_LABELS } from '../model/display';

const CATEGORY_COLOURS: Readonly<Record<string, string>> = {
  availability: 'hsl(var(--danger))',
  performance: 'hsl(var(--chart-2))',
  quality: 'hsl(var(--warning))',
};
const FALLBACK_COLOUR = 'hsl(var(--chart-8))';
const NOT_CODED = 'Not categorised';

const categoryLabel = (group: LossTreeGroupView) => (group.key ? (OEE_METRIC_LABELS[group.key] ?? group.label ?? group.key) : NOT_CODED);

/** Groups of the loss tree by unit of measure, in server order: quantities of different units are never added. */
function byUnit(groups: readonly LossTreeGroupView[]): Array<{ uom: string | null; groups: LossTreeGroupView[] }> {
  const units = [...new Set(groups.map((g) => g.unit))];
  return units.map((uom) => ({ uom, groups: groups.filter((g) => g.unit === uom) }));
}

function UnitBars({ uom, groups }: { uom: string | null; groups: readonly LossTreeGroupView[] }) {
  const { axis, number } = useNumberFormat();
  const points = groups.map((g) => ({ name: categoryLabel(g), key: g.key ?? '', amount: g.amount === null ? null : Number(g.amount) }));
  const values = points.map((p) => `${p.name} ${p.amount === null ? 'not available' : number(p.amount, 2)}`).join(', ');
  return (
    <div data-testid="oee-loss-unit" data-uom={uom ?? ''}>
      <p className="text-xs font-medium text-muted-foreground">{uom ?? 'Unit not stated'}</p>
      <ChartFigure caption={`Lost quantity in ${uom ?? 'unknown unit'} by OEE category: ${values}.`} chartClassName="h-40 w-full">
        <ResponsiveContainer>
          <BarChart data={points} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={axis} />
            <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value: unknown) => (typeof value === 'number' ? `${number(value, 2)} ${uom ?? ''}`.trim() : String(value))} />
            <Bar dataKey="amount" isAnimationActive={false}>
              {points.map((p) => (
                <Cell key={p.name} fill={CATEGORY_COLOURS[p.key] ?? FALLBACK_COLOUR} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartFigure>
    </div>
  );
}

/** "Where production was lost": the loss tree's quantity by OEE category (server-computed), one small chart per unit of measure. */
export function OeeLossChart({ scope }: { scope: AnalyticsScope }) {
  const env = useEventHubEnv();
  const query = useLossTree(lossTreeQuery(scope, { groupBy: 'oee', metric: 'qty' }), env.timezone);
  const groups = query.data?.data.groups ?? [];
  const state = dataStateOf(query, { isEmpty: groups.length === 0 });
  return (
    <div className="space-y-2" data-testid="oee-loss">
      <h3 className="text-sm font-medium">Where production was lost</h3>
      <DataState state={state} error={query.error} onRetry={() => query.refetch()} detail="No losses recorded in this window.">
        <div className="space-y-3">
          {byUnit(groups).map((unit) => (
            <UnitBars key={unit.uom ?? '-'} uom={unit.uom} groups={unit.groups} />
          ))}
        </div>
      </DataState>
    </div>
  );
}
