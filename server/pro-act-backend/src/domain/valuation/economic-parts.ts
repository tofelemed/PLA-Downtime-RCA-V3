import { Dec } from '../actuals/decimal';
import { ValuationBasis } from '../profiles/profile.types';
import {
  normUom,
  RatePiece,
  ratePieces,
  ratesOf,
  shareOf,
  TIME_UNIFORM,
} from './rate-pieces';
import {
  DemandStatusSnapshot,
  EconomicComponent,
  EconomicRules,
  ValuationComponent,
  ValuationContext,
  ValuationLineInput,
} from './valuation.types';

/** One economic part of a line: a product value per tonne, its sign, and whether it may be absent. */
export interface Part {
  component: EconomicComponent;
  basis: ValuationBasis;
  sign: 1 | -1;
  required: boolean;
  /** lost contribution: charged only for sales actually forgone (SME V3) */
  forgoneSale: boolean;
}

export const part = (
  component: EconomicComponent,
  basis: ValuationBasis,
  options: Partial<Pick<Part, 'sign' | 'required' | 'forgoneSale'>> = {},
): Part => ({
  component,
  basis,
  sign: options.sign ?? 1,
  required: options.required ?? true,
  forgoneSale: options.forgoneSale ?? false,
});

export const ms = (iso: string | null) =>
  iso === null ? Infinity : Date.parse(iso);

function demandAt(
  productId: string | null | undefined,
  at: number,
  context: ValuationContext,
): DemandStatusSnapshot | null {
  return (
    (context.demand ?? []).find(
      (d) => d.productId === productId && ms(d.from) <= at && ms(d.to) > at,
    ) ?? null
  );
}

export interface Demand {
  /** whether forgone-sale parts are charged */
  charged: boolean;
  statusId?: string;
  notes: string[];
}

/**
 * SME V3: lost contribution only when demand was constrained at `at` (the line's valuation date unless a
 * later instant matters, e.g. when rework took the capacity), unless the policy charges all lost output.
 */
export function demandOf(
  line: ValuationLineInput,
  context: ValuationContext,
  rules: EconomicRules,
  at: Date = line.start,
): Demand | { reason: string } {
  if (rules.demandRule === 'all_lost_output')
    return { charged: true, notes: [] };
  const status = demandAt(line.productId, at.getTime(), context);
  if (!status) return { reason: 'demand_status_missing' };
  return {
    charged: status.constrained,
    statusId: status.id,
    notes: status.constrained ? [] : ['demand_not_constrained'],
  };
}

function componentOf(
  item: Part,
  piece: RatePiece,
  quantity: Dec,
): ValuationComponent {
  return {
    rateVersionId: piece.rate.id,
    rateVersion: piece.rate.version,
    from: new Date(piece.from),
    to: new Date(piece.to),
    currency: piece.rate.currency,
    unitValue: piece.rate.value,
    quantity,
    seconds: null,
    amount: quantity.mul(piece.rate.value).mul(item.sign),
    component: item.component,
  };
}

const missingReason = (basis: ValuationBasis) =>
  basis === 'contribution_margin' ? 'rate_missing' : `${basis}_missing`;

export type PartPrice =
  | { components: ValuationComponent[]; note?: string }
  | { reason: string };

/**
 * One part priced with the product's approved values at the line's valuation date: `quantity` tonnes
 * (default the line's own), split by the time share of each rate piece.
 */
export function pricePart(
  line: ValuationLineInput,
  item: Part,
  context: ValuationContext,
  quantity: Dec = line.quantity,
): PartPrice {
  const rates = ratesOf(context, line.profileId ?? '', item.basis);
  const found = ratePieces(line, rates, TIME_UNIFORM.has(line.kind));
  if (!found || found.length === 0) {
    if (item.required) return { reason: missingReason(item.basis) };
    return { components: [], note: `no_${item.component}_rate` };
  }
  const uom = normUom(line.uom ?? '');
  if (found.some((p) => normUom(p.rate.perUom) !== uom))
    return { reason: 'uom_mismatch' };
  return {
    components: found.map((p) =>
      componentOf(item, p, quantity.mul(shareOf(line, p))),
    ),
  };
}
