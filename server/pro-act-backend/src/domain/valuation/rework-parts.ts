import { Dec, ZERO } from '../actuals/decimal';
import { demandOf, part, Part, pricePart } from './economic-parts';
import { reworkOutcome } from './rework-outcome';
import {
  EconomicRules,
  ValuationComponent,
  ValuationContext,
  ValuationLineInput,
} from './valuation.types';

const REWORK_COST = part('rework_cost', 'rework_cost');

/** SME V2: the lost share of rework is valued like scrap (lost sale if forgone + material − salvage + disposal). */
const YIELD_LOSS: Part[] = [
  part('yield_loss_contribution', 'contribution_margin', { forgoneSale: true }),
  part('yield_loss_variable_cost', 'variable_cost'),
  part('yield_loss_salvage', 'salvage_value', { sign: -1, required: false }),
  part('yield_loss_disposal', 'disposal_cost', { required: false }),
];

const DISPLACED = part('displaced_contribution', 'contribution_margin');

export interface ReworkPriced {
  components: ValuationComponent[];
  notes: string[];
  demandStatusId?: string;
}

type Priced = ReworkPriced | { reason: string };

/** Prices `items` for `quantity` tonnes, appending to `out`; a missing required value stops (reason). */
function priceAll(
  line: ValuationLineInput,
  context: ValuationContext,
  items: ReadonlyArray<{ item: Part; quantity: Dec }>,
  out: ReworkPriced,
): string | null {
  for (const { item, quantity } of items) {
    if (quantity.lte(ZERO)) continue;
    const priced = pricePart(line, item, context, quantity);
    if ('reason' in priced) return priced.reason;
    out.components.push(...priced.components);
    if (priced.note) out.notes.push(priced.note);
  }
  return null;
}

/**
 * The economic parts of a successful rework line (SME V2, 2.8.0), non-overlapping: the incremental
 * rework cost of every reworked tonne; the yield loss — tonnes not recovered — valued like scrap (lost
 * contribution only when that sale was forgone); the contribution of prime output displaced by the rework
 * time at a demand-constrained unit. The recovered share is not a loss.
 */
export function reworkParts(
  line: ValuationLineInput,
  context: ValuationContext,
  rules: EconomicRules,
): Priced {
  const demandAt = (at: Date) => demandOf(line, context, rules, at);
  const outcome = reworkOutcome(line, context, demandAt);
  if ('reason' in outcome) return outcome;
  const out: ReworkPriced = { components: [], notes: [...outcome.notes] };
  const found = demandOf(line, context, rules);
  if ('reason' in found && outcome.lost.gt(ZERO)) return found;
  const sale = 'reason' in found ? null : found;
  if (sale?.statusId) out.demandStatusId = sale.statusId;
  if (sale && outcome.lost.gt(ZERO)) out.notes.push(...sale.notes);
  const items = [
    { item: REWORK_COST, quantity: line.quantity },
    ...YIELD_LOSS.filter((p) => !p.forgoneSale || sale?.charged).map(
      (item) => ({
        item,
        quantity: outcome.lost,
      }),
    ),
    { item: DISPLACED, quantity: outcome.displaced },
  ];
  const reason = priceAll(line, context, items, out);
  if (reason) return { reason };
  return out;
}
