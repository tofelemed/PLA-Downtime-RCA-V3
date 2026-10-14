import { ValuationBasis } from '../profiles/profile.types';
import { unvaluedView, valuedView } from './currency-amounts';
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
  LineViewValuation,
  QualityDisposition,
  ValuationComponent,
  ValuationContext,
  ValuationLineInput,
} from './valuation.types';

const VIEW = 'economic_impact';

/** One economic part of a line: a product value per tonne, its sign, and whether it may be absent. */
interface Part {
  component: EconomicComponent;
  basis: ValuationBasis;
  sign: 1 | -1;
  required: boolean;
  /** lost contribution: charged only for sales actually forgone (SME V3) */
  forgoneSale: boolean;
}

const part = (
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

const LOST_SALE = part('lost_contribution', 'contribution_margin', {
  forgoneSale: true,
});

/**
 * SME V2 (14 Oct 2026), non-overlapping parts: output never made is lost contribution; scrap is the lost
 * contribution of an unrecovered sale plus the variable cost already spent, less salvage, plus disposal;
 * a downgrade sold is the net price difference plus incremental handling; successful rework is its
 * incremental cost only (the sale is recovered, so no contribution is lost).
 */
const PARTS: Readonly<Record<QualityDisposition | 'unproduced', Part[]>> = {
  unproduced: [LOST_SALE],
  scrap: [
    LOST_SALE,
    part('variable_cost', 'variable_cost'),
    part('salvage', 'salvage_value', { sign: -1, required: false }),
    part('disposal', 'disposal_cost', { required: false }),
  ],
  downgrade: [
    part('price_difference', 'downgrade_price_difference'),
    part('disposal', 'disposal_cost', { required: false }),
  ],
  rework: [part('rework_cost', 'rework_cost')],
};

type Plan = { parts: Part[]; notes: string[] } | { reason: string };

function dispositionOf(
  line: ValuationLineInput,
  rules: EconomicRules,
): QualityDisposition | null {
  const mapped = line.impactCodeId
    ? rules.qualityDispositions[line.impactCodeId]
    : undefined;
  return mapped ?? rules.defaultQualityDisposition;
}

function planOf(line: ValuationLineInput, rules: EconomicRules): Plan {
  if (line.kind !== 'quality') return { parts: PARTS.unproduced, notes: [] };
  const disposition = dispositionOf(line, rules);
  if (!disposition) return { reason: 'disposition_missing' };
  return { parts: PARTS[disposition], notes: [`disposition_${disposition}`] };
}

const ms = (iso: string | null) => (iso === null ? Infinity : Date.parse(iso));

function demandAt(
  line: ValuationLineInput,
  context: ValuationContext,
): DemandStatusSnapshot | null {
  const at = line.start.getTime();
  return (
    (context.demand ?? []).find(
      (d) =>
        d.productId === line.productId && ms(d.from) <= at && ms(d.to) > at,
    ) ?? null
  );
}

interface Demand {
  /** whether forgone-sale parts are charged */
  charged: boolean;
  statusId?: string;
  notes: string[];
}

/** SME V3: lost contribution only when demand was constrained (unless the policy charges all lost output). */
function demandOf(
  line: ValuationLineInput,
  context: ValuationContext,
  rules: EconomicRules,
): Demand | { reason: string } {
  if (rules.demandRule === 'all_lost_output')
    return { charged: true, notes: [] };
  const status = demandAt(line, context);
  if (!status) return { reason: 'demand_status_missing' };
  return {
    charged: status.constrained,
    statusId: status.id,
    notes: status.constrained ? [] : ['demand_not_constrained'],
  };
}

function componentOf(
  line: ValuationLineInput,
  item: Part,
  piece: RatePiece,
): ValuationComponent {
  const quantity = line.quantity.mul(shareOf(line, piece));
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

type PartPrice =
  | { components: ValuationComponent[]; note?: string }
  | { reason: string };

function pricePart(
  line: ValuationLineInput,
  item: Part,
  context: ValuationContext,
): PartPrice {
  const profileId = line.profileId ?? '';
  const rates = ratesOf(context, profileId, item.basis);
  const found = ratePieces(line, rates, TIME_UNIFORM.has(line.kind));
  if (!found || found.length === 0) {
    if (item.required) return { reason: missingReason(item.basis) };
    return { components: [], note: `no_${item.component}_rate` };
  }
  const uom = normUom(line.uom ?? '');
  if (found.some((p) => normUom(p.rate.perUom) !== uom))
    return { reason: 'uom_mismatch' };
  return { components: found.map((p) => componentOf(line, item, p)) };
}

function precondition(
  line: ValuationLineInput,
  context: ValuationContext,
): string | null {
  if (!context.policy.approved) return 'policy_unapproved';
  if (!line.profileId) return 'no_profile';
  if (!line.uom) return 'uom_missing';
  return null;
}

/**
 * The `economic_impact` view of one line (SME V2 / V3 / V8): the parts of its disposition priced with the
 * product's approved values, lost contribution only for sales forgone (an approved demand status of the
 * product says whether demand was constrained), each part kept as its own component so nothing is counted
 * twice. A missing required value or demand status leaves the view unvalued (never a zero); a sale not
 * forgone gives a valued zero with the note `demand_not_constrained` — the tonnes stay visible.
 */
export function economicView(
  line: ValuationLineInput,
  context: ValuationContext,
): LineViewValuation {
  const currencies = context.policy.currencies;
  const rules = context.policy.economic;
  const blocked = rules ? precondition(line, context) : 'policy_unapproved';
  if (blocked || !rules) return unvaluedView(VIEW, blocked ?? '', currencies);
  const plan = planOf(line, rules);
  if ('reason' in plan) return unvaluedView(VIEW, plan.reason, currencies);
  const needsDemand = plan.parts.some((p) => p.forgoneSale);
  const demand = needsDemand
    ? demandOf(line, context, rules)
    : { charged: true, notes: [] };
  if ('reason' in demand) return unvaluedView(VIEW, demand.reason, currencies);
  const components: ValuationComponent[] = [];
  const notes = [...plan.notes, ...demand.notes];
  for (const item of plan.parts) {
    if (item.forgoneSale && !demand.charged) continue;
    const priced = pricePart(line, item, context);
    if ('reason' in priced)
      return unvaluedView(VIEW, priced.reason, currencies);
    components.push(...priced.components);
    if (priced.note) notes.push(priced.note);
  }
  return {
    ...valuedView(VIEW, components, context),
    ...(demand.statusId ? { demandStatusId: demand.statusId } : {}),
    notes,
  };
}
