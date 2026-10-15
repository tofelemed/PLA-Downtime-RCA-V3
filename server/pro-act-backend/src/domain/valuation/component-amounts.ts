import { Dec, formatDec } from '../actuals/decimal';
import { inCurrency } from './currency-amounts';
import {
  EconomicComponent,
  LineViewValuation,
  ValuationComponent,
  ValuationContext,
} from './valuation.types';

/**
 * One economic part of a valued line in one reporting currency (VA-04), stored with the line valuation
 * row so reports can break the economic view down by component in SQL. The amount is converted exactly
 * like the line (each piece at its own date), so the parts of a line add up to its amount.
 */
export interface StoredComponentAmount {
  component: EconomicComponent;
  /** decimal string; null when no approved FX rate covers a piece (never estimated) */
  amount: string | null;
  /** tonnes the part applies to (Σ of its rate pieces) */
  quantity: string | null;
  /** SME V7: converted with a provisional FX rate (only when true) */
  provisional?: true;
}

function byComponent(
  components: readonly ValuationComponent[],
): Map<EconomicComponent, ValuationComponent[]> {
  const groups = new Map<EconomicComponent, ValuationComponent[]>();
  for (const c of components) {
    if (!c.component) continue;
    groups.set(c.component, [...(groups.get(c.component) ?? []), c]);
  }
  return groups;
}

function quantityOf(pieces: readonly ValuationComponent[]): string | null {
  if (pieces.every((p) => p.quantity === null)) return null;
  const sum = pieces.reduce((s, p) => s.plus(p.quantity ?? 0), new Dec(0));
  return formatDec(sum);
}

/**
 * The economic components of a valued `economic_impact` view in `currency`, in the order they first
 * appear; null for any other view or an unvalued one (an unvalued line has no parts to break down).
 */
export function componentAmounts(
  view: LineViewValuation,
  currency: string,
  context: ValuationContext,
): StoredComponentAmount[] | null {
  if (view.view !== 'economic_impact' || view.status !== 'valued') return null;
  return [...byComponent(view.components)].map(([component, pieces]) => {
    const converted = inCurrency(pieces, currency, context);
    return {
      component,
      amount: converted.amount === null ? null : formatDec(converted.amount),
      quantity: quantityOf(pieces),
      ...(converted.provisional ? { provisional: true as const } : {}),
    };
  });
}
