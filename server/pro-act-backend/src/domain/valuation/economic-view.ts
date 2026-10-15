import { unvaluedView, valuedView } from './currency-amounts';
import { demandOf, part, Part, PartPrice, pricePart } from './economic-parts';
import { reworkParts } from './rework-parts';
import {
  EconomicRules,
  LineViewValuation,
  QualityDisposition,
  ValuationComponent,
  ValuationContext,
  ValuationLineInput,
} from './valuation.types';

const VIEW = 'economic_impact';

const LOST_SALE = part('lost_contribution', 'contribution_margin', {
  forgoneSale: true,
});

/**
 * SME V2 (14 Oct 2026), non-overlapping parts: output never made is lost contribution; scrap is the lost
 * contribution of an unrecovered sale plus the variable cost already spent, less salvage, plus disposal;
 * a downgrade sold is the net price difference plus incremental handling; successful rework is its
 * incremental cost, its yield loss and any contribution displaced at a constrained unit (2.8.0), never the
 * lost contribution of the recovered sale.
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
  // successful rework: incremental cost, yield loss and displaced contribution (`rework-parts.ts`, 2.8.0)
  rework: [],
};

type Plan =
  | { parts: Part[]; notes: string[]; rework: boolean }
  | { reason: string };

/**
 * SME E3: a line whose quality class is itself a disposition (an approved lot disposition or a quality
 * event's class) is valued as recorded — no impact-code mapping needed. Other classes (transition
 * off-grade) and unclassified lines use the policy's impact-code map, then its default.
 */
const CLASS_DISPOSITIONS: Readonly<Record<string, QualityDisposition>> = {
  scrap: 'scrap',
  downgrade: 'downgrade',
  rework: 'rework',
};

function dispositionOf(
  line: ValuationLineInput,
  rules: EconomicRules,
): QualityDisposition | null {
  const recorded = line.qualityClass
    ? CLASS_DISPOSITIONS[line.qualityClass]
    : undefined;
  if (recorded) return recorded;
  const mapped = line.impactCodeId
    ? rules.qualityDispositions[line.impactCodeId]
    : undefined;
  return mapped ?? rules.defaultQualityDisposition;
}

function planOf(line: ValuationLineInput, rules: EconomicRules): Plan {
  if (line.kind !== 'quality')
    return { parts: PARTS.unproduced, notes: [], rework: false };
  const disposition = dispositionOf(line, rules);
  if (!disposition) return { reason: 'disposition_missing' };
  return {
    parts: PARTS[disposition],
    notes: [`disposition_${disposition}`],
    rework: disposition === 'rework',
  };
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
  const priced = plan.rework
    ? reworkParts(line, context, rules)
    : standardParts(line, context, rules, plan.parts);
  if ('reason' in priced) return unvaluedView(VIEW, priced.reason, currencies);
  return {
    ...valuedView(VIEW, priced.components, context),
    ...(priced.demandStatusId ? { demandStatusId: priced.demandStatusId } : {}),
    notes: [...plan.notes, ...priced.notes],
  };
}

interface Priced {
  components: ValuationComponent[];
  notes: string[];
  demandStatusId?: string;
}

/** Never-made output, scrap and downgrade: each part priced for the line's tonnes (forgone sales per V3). */
function standardParts(
  line: ValuationLineInput,
  context: ValuationContext,
  rules: EconomicRules,
  parts: readonly Part[],
): Priced | { reason: string } {
  const needsDemand = parts.some((p) => p.forgoneSale);
  const demand = needsDemand
    ? demandOf(line, context, rules)
    : { charged: true, notes: [] };
  if ('reason' in demand) return demand;
  const out: Priced = { components: [], notes: [...demand.notes] };
  for (const item of parts) {
    if (item.forgoneSale && !demand.charged) continue;
    const priced: PartPrice = pricePart(line, item, context);
    if ('reason' in priced) return priced;
    out.components.push(...priced.components);
    if (priced.note) out.notes.push(priced.note);
  }
  if ('statusId' in demand && demand.statusId)
    out.demandStatusId = demand.statusId;
  return out;
}
