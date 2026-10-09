import { LossKind } from '../accounting/accounting.types';
import { Dec } from '../actuals/decimal';
import { convert } from './fx';
import {
  CurrencyAmount,
  LineValuation,
  LineViewValuation,
  ValuationComponent,
  ValuationContext,
  ValuationLineInput,
  ValuationRateSnapshot,
  ValuationView,
} from './valuation.types';

/** Kinds whose quantity accrues uniformly over the line's interval (rate × time), so rate changes split it. */
const TIME_UNIFORM: ReadonlySet<LossKind> = new Set([
  'availability',
  'schedule_exclusion',
]);

type Priced = { components: ValuationComponent[] } | { reason: string };

const norm = (uom: string) => uom.replace(/\s+/g, '').toLowerCase();
const ms = (iso: string | null) => (iso === null ? Infinity : Date.parse(iso));

function ownerOf(line: ValuationLineInput, view: ValuationView) {
  return view === 'cost_per_hour' ? line.impactCodeId : line.profileId;
}

function ratesOf(
  context: ValuationContext,
  ownerId: string,
  view: ValuationView,
): ValuationRateSnapshot[] {
  return context.rates
    .filter((r) => r.ownerId === ownerId && r.basis === view)
    .sort((a, b) => ms(a.from) - ms(b.from) || a.id.localeCompare(b.id));
}

/** The rates' share of `[start, end)`: time pieces in order, null when some instant has no rate. */
function pieces(
  rates: readonly ValuationRateSnapshot[],
  start: number,
  end: number,
): Array<{ rate: ValuationRateSnapshot; from: number; to: number }> | null {
  const found: Array<{
    rate: ValuationRateSnapshot;
    from: number;
    to: number;
  }> = [];
  let cursor = start;
  while (cursor < end) {
    const rate = rates.find((r) => ms(r.from) <= cursor && ms(r.to) > cursor);
    if (!rate) return null;
    const to = Math.min(end, ms(rate.to));
    found.push({ rate, from: cursor, to });
    cursor = to;
  }
  return found;
}

/** Rate pieces of a line: split at rate edges for time-uniform lines, else the rate at the valuation date. */
function ratePieces(
  line: ValuationLineInput,
  rates: readonly ValuationRateSnapshot[],
  uniform: boolean,
) {
  const start = line.start.getTime();
  const end = line.end.getTime();
  if (uniform && end > start) return pieces(rates, start, end);
  const rate = rates.find((r) => ms(r.from) <= start && ms(r.to) > start);
  return rate ? [{ rate, from: start, to: Math.max(start, end) }] : null;
}

function component(
  line: ValuationLineInput,
  view: ValuationView,
  piece: { rate: ValuationRateSnapshot; from: number; to: number },
): ValuationComponent {
  const span = line.end.getTime() - line.start.getTime();
  const share =
    span > 0 ? new Dec(piece.to - piece.from).div(span) : new Dec(1);
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
  view: ValuationView,
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
  const uom = line.uom ? norm(line.uom) : null;
  if (
    view !== 'cost_per_hour' &&
    found.some((p) => norm(p.rate.perUom) !== uom)
  ) {
    return { reason: 'uom_mismatch' };
  }
  return { components: found.map((p) => component(line, view, p)) };
}

/** The line in one reporting currency: Σ components converted at each component's date. */
function inCurrency(
  components: readonly ValuationComponent[],
  currency: string,
  context: ValuationContext,
): CurrencyAmount {
  let total = new Dec(0);
  const fxRateIds: string[] = [];
  for (const c of components) {
    const converted = convert(
      c.amount,
      { from: c.currency, to: currency },
      c.from,
      { fx: context.fx, fxPolicy: context.policy.fxPolicy },
    );
    if (converted.amount === null) {
      return {
        currency,
        amount: null,
        reason: converted.reason,
        fxRateIds: [],
        native: false,
      };
    }
    total = total.plus(converted.amount);
    if (converted.fxRateId && !fxRateIds.includes(converted.fxRateId))
      fxRateIds.push(converted.fxRateId);
  }
  const native = components.every((c) => c.currency === currency);
  return { currency, amount: total, reason: null, fxRateIds, native };
}

/** Views of a line: both quantity views always, the time view only for lines with lost seconds. */
export function viewsOf(line: ValuationLineInput): ValuationView[] {
  return line.seconds === null
    ? ['contribution_margin', 'standard_cost']
    : ['contribution_margin', 'standard_cost', 'cost_per_hour'];
}

function valueView(
  line: ValuationLineInput,
  view: ValuationView,
  context: ValuationContext,
): LineViewValuation {
  const priced = price(line, view, context);
  const currencies = context.policy.currencies;
  if ('reason' in priced) {
    return {
      view,
      status: 'unvalued',
      reason: priced.reason,
      components: [],
      amounts: currencies.map((currency) => ({
        currency,
        amount: null,
        reason: priced.reason,
        fxRateIds: [],
        native: false,
      })),
    };
  }
  return {
    view,
    status: 'valued',
    reason: null,
    components: priced.components,
    amounts: currencies.map((c) => inCurrency(priced.components, c, context)),
  };
}

/**
 * Values one loss line on every applicable view (plan 2.6, VAL01–VAL03): an effective-dated approved rate
 * of the slice's profile (margin, standard cost: `quantity × value`) or of the cause's impact code (cost
 * per hour: `seconds / 3600 × value`), split at rate edges for time-uniform lines; each view reported in
 * every policy currency through approved FX rates. Missing rate → `unvalued` with a reason and null
 * amounts; nothing is rounded here (8 dp at storage, currency minor units only in presentation).
 */
export function valueLine(
  line: ValuationLineInput,
  context: ValuationContext,
): LineValuation {
  return {
    valuationDate: line.start,
    seconds: line.seconds,
    views: viewsOf(line).map((view) => valueView(line, view, context)),
  };
}
