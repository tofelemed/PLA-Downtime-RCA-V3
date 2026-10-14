import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import type { LossTreeGroupView } from '@/api/v2/types/pla-analytics';
import { currencyDigits } from '@/features/display-currency/money-format';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

interface Leaf {
  name: string;
  /** the server amount as a number, for the tile area only */
  size: number;
  amount: string;
  [key: string]: unknown;
}

/**
 * Treemap of the server's loss groups (lazy chunk, plan 3.6): tile areas are the server amounts; groups
 * without an amount (unvalued) are not drawn — the table lists them with their reason.
 */
export function LossTreemap({ groups, unit }: { groups: readonly LossTreeGroupView[]; unit: string | null }) {
  const leaves: Leaf[] = groups.flatMap((g) =>
    g.amount === null || g.amount.startsWith('-') || /^0(\.0*)?$/.test(g.amount) ? [] : [{ name: g.label ?? 'Not coded', size: Number(g.amount), amount: g.amount }],
  );
  const { decimal } = useNumberFormat();
  if (leaves.length === 0) return null;
  return (
    <div className="h-64 w-full" aria-hidden>
      <ResponsiveContainer>
        <Treemap data={leaves} dataKey="size" nameKey="name" stroke="hsl(var(--background))" fill="hsl(var(--primary))" isAnimationActive={false}>
          <Tooltip formatter={(_value: unknown, _name: string, item: { payload?: Leaf }) => `${decimal(item.payload?.amount, currencyDigits(unit))} ${unit ?? ''}`} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
