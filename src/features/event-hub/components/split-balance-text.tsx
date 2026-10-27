import { useNumberFormat, type NumberFormat } from '@/features/ux-kit/use-number-format';
import type { ReasonSplitState } from '../hooks/use-reason-split';
import { splitBalance, splitGap, tonnesTolerance, type TonnesSplitGap } from '../model/declared-split';

interface Unit {
  symbol: string;
  digits: number;
  over: string;
}

const TONNES: Unit = { symbol: 't', digits: 3, over: 'over the shortfall' };
const PERCENT: Unit = { symbol: '%', digits: 2, over: 'over 100 %' };

function gapText(gap: TonnesSplitGap, unit: Unit, numbers: NumberFormat): string {
  return `${numbers.number(gap.tonnes, unit.digits)} ${unit.symbol} ${gap.side === 'remaining' ? 'still to place' : unit.over}.`;
}

/** "Losses 40.000 t − recovery 8.000 t = 32.000 t ✓", or the same with what is left / over. */
function balanceText(split: ReasonSplitState, unit: Unit, numbers: NumberFormat): { text: string; fits: boolean } {
  const balance = splitBalance(split.rows);
  const target = unit === TONNES ? (split.shortfall ?? 0) : 100;
  const gap = splitGap(balance.net, target, unit === TONNES ? tonnesTolerance(target) : 0);
  const amount = (value: number) => `${numbers.number(value, unit.digits)} ${unit.symbol}`;
  const equation = `Losses ${amount(balance.losses)} − recovery ${amount(balance.recovery)} = ${amount(balance.net)}`;
  return { text: gap ? `${equation} · ${gapText(gap, unit, numbers)}` : `${equation} ✓`, fits: gap === null };
}

/**
 * Live check of a declared split (Task 13): with recovery shares, Σ loss − Σ recovery must equal the
 * shortfall (tonnes) or 100 (percent); without them, what is still to place of the shortfall. The server
 * normalises and validates again; this only guides the coder.
 */
export function SplitBalanceText({ split }: { split: ReasonSplitState }) {
  const numbers = useNumberFormat();
  const withRecovery = split.rows.some((row) => row.recovery);
  if (split.mode === 'minutes' || split.shortfall === null) return null;
  if (split.mode === 'percent' && !withRecovery) return null;
  const unit = split.mode === 'tonnes' ? TONNES : PERCENT;
  if (!withRecovery) {
    const gap = splitGap(splitBalance(split.rows).net, split.shortfall, tonnesTolerance(split.shortfall));
    return (
      <p className={gap ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} data-testid="split-tonnes-remaining" role="status">
        {gap ? gapText(gap, unit, numbers) : 'The tonnes add up to the shortfall.'}
      </p>
    );
  }
  const { text, fits } = balanceText(split, unit, numbers);
  return (
    <p className={fits ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'} data-testid="split-tonnes-remaining" data-balance="recovery" role="status">
      {text}
    </p>
  );
}
