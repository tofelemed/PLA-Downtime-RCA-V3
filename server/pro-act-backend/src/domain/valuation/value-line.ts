import { Dec } from '../actuals/decimal';
import { unvaluedView, valuedView } from './currency-amounts';
import { economicView } from './economic-view';
import {
  normUom,
  RatePiece,
  ratePieces,
  ratesOf,
  shareOf,
  TIME_UNIFORM,
} from './rate-pieces';
import {
  LineValuation,
  LineViewValuation,
  ValuationComponent,
  ValuationContext,
  ValuationLineInput,
  ValuationPolicySnapshot,
  ValuationView,
} from './valuation.types';

type Priced = { components: ValuationComponent[] } | { reason: string };

type RateView = Exclude<ValuationView, 'economic_impact'>;

function ownerOf(line: ValuationLineInput, view: RateView) {
  return view === 'cost_per_hour' ? line.impactCodeId : line.profileId;
}

function component(
  line: ValuationLineInput,
  view: RateView,
  piece: RatePiece,
): ValuationComponent {
  const share = shareOf(line, piece);
  const seconds = line.seconds ? line.seconds.mul(share) : null;
  const quantity = view === 'cost_per_hour' ? null : line.quantity.mul(share);
  const amount =
    view === 'cost_per_hour'
      ? (seconds ?? new Dec(0)).div(3600).mul(piece.rate.value)
      : (quantity ?? new Dec(0)).mul(piece.rate.value);
  return {
    rateVersionId: piece.rate.id,
    rateVersion: piece.rate.version,
    from: new Date(piece.from),
    to: new Date(piece.to),
    currency: piece.rate.currency,
    unitValue: piece.rate.value,
    quantity,
    seconds: view === 'cost_per_hour' ? seconds : null,
    amount,
  };
}

/** VAL01 / VAL02: the components of one view, or why the line stays unvalued (never a zero). */
function price(
  line: ValuationLineInput,
  view: RateView,
  context: ValuationContext,
): Priced {
  if (!context.policy.approved) return { reason: 'policy_unapproved' };
  const ownerId = ownerOf(line, view);
  if (!ownerId) {
    return {
      reason: view === 'cost_per_hour' ? 'impact_code_missing' : 'no_profile',
    };
  }
  if (view !== 'cost_per_hour' && !line.uom) return { reason: 'uom_missing' };
  const rates = ratesOf(context, ownerId, view);
  const uniform = view === 'cost_per_hour' || TIME_UNIFORM.has(line.kind);
  const found = ratePieces(line, rates, uniform);
  if (!found || found.length === 0) return { reason: 'rate_missing' };
  const uom = line.uom ? normUom(line.uom) : null;
  if (
    view !== 'cost_per_hour' &&
    found.some((p) => normUom(p.rate.perUom) !== uom)
  ) {
    return { reason: 'uom_mismatch' };
  }
  return { components: found.map((p) => component(line, view, p)) };
}

/**
 * Views of a line: both quantity views always, the time view only for lines with lost seconds, and — when
 * the policy carries the SME V2–V4 rules (version 3) — the economic view for every loss but schedule time.
 */
export function viewsOf(
  line: ValuationLineInput,
  policy?: ValuationPolicySnapshot,
): ValuationView[] {
  const views: ValuationView[] =
    line.seconds === null
      ? ['contribution_margin', 'standard_cost']
      : ['contribution_margin', 'standard_cost', 'cost_per_hour'];
  const economic =
    policy?.economic !== undefined && line.kind !== 'schedule_exclusion';
  return economic ? [...views, 'economic_impact'] : views;
}

function valueView(
  line: ValuationLineInput,
  view: ValuationView,
  context: ValuationContext,
): LineViewValuation {
  if (view === 'economic_impact') return economicView(line, context);
  const priced = price(line, view, context);
  if ('reason' in priced)
    return unvaluedView(view, priced.reason, context.policy.currencies);
  return valuedView(view, priced.components, context);
}

/**
 * Values one loss line on every applicable view (plan 2.6, VAL01–VAL03): an effective-dated approved rate
 * of the slice's profile (margin, standard cost: `quantity × value`) or of the cause's impact code (cost
 * per hour: `seconds / 3600 × value`), split at rate edges for time-uniform lines; each view reported in
 * every policy currency through approved FX rates. Missing rate → `unvalued` with a reason and null
 * amounts; nothing is rounded here (8 dp at storage, currency minor units only in presentation). The
 * economic view (SME V2 / V3) is built in `economic-view.ts`.
 */
export function valueLine(
  line: ValuationLineInput,
  context: ValuationContext,
): LineValuation {
  return {
    valuationDate: line.start,
    seconds: line.seconds,
    views: viewsOf(line, context.policy).map((view) =>
      valueView(line, view, context),
    ),
  };
}
