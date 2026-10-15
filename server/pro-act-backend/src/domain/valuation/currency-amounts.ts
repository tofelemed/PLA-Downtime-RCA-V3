import { Dec } from '../actuals/decimal';
import { convert, ConversionContext } from './fx';
import {
  CurrencyAmount,
  LineViewValuation,
  ValuationComponent,
  ValuationContext,
  ValuationView,
} from './valuation.types';

const EPOCH = '1970-01-01T00:00:00.000Z';

/** How a run converts (V5 / V6): the approved rates of the policy's rate type, at the date or the average. */
export function conversionOf(context: ValuationContext): ConversionContext {
  const { policy } = context;
  // without a frozen month window an average cannot be formed: an empty window converts nothing
  const average =
    policy.fx?.dateRule === 'period_average'
      ? (context.fxAverage ?? { from: EPOCH, to: EPOCH })
      : undefined;
  return {
    fx: context.fx,
    fxPolicy: policy.fxPolicy,
    ...(average
      ? { average, maxAverageDeviation: policy.fx?.maxAverageDeviation }
      : {}),
  };
}

/** The line in one reporting currency: Σ components converted at each component's date. */
export function inCurrency(
  components: readonly ValuationComponent[],
  currency: string,
  context: ValuationContext,
): CurrencyAmount {
  const conversion = conversionOf(context);
  let total = new Dec(0);
  const fxRateIds: string[] = [];
  let provisional = false;
  for (const c of components) {
    const pair = { from: c.currency, to: currency };
    const converted = convert(c.amount, pair, c.from, conversion);
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
    provisional = provisional || converted.provisional;
    converted.fxRateIds.forEach((id) => {
      if (!fxRateIds.includes(id)) fxRateIds.push(id);
    });
  }
  const native = components.every((c) => c.currency === currency);
  return {
    currency,
    amount: total,
    reason: null,
    fxRateIds,
    native,
    ...provisionalMark(provisional),
  };
}

/** SME V7 mark of an amount: the field exists only when true, so stored shapes and hashes stay as they were. */
export function provisionalMark(provisional: boolean): { provisional?: true } {
  return provisional ? { provisional: true } : {};
}

/** A view that cannot be valued: the reason in every currency, amounts null (never a zero). */
export function unvaluedView(
  view: ValuationView,
  reason: string,
  currencies: readonly string[],
): LineViewValuation {
  return {
    view,
    status: 'unvalued',
    reason,
    components: [],
    amounts: currencies.map((currency) => ({
      currency,
      amount: null,
      reason,
      fxRateIds: [],
      native: false,
    })),
  };
}

/** A valued view: its components in every reporting currency of the policy. */
export function valuedView(
  view: ValuationView,
  components: ValuationComponent[],
  context: ValuationContext,
): LineViewValuation {
  return {
    view,
    status: 'valued',
    reason: null,
    components,
    amounts: context.policy.currencies.map((c) =>
      inCurrency(components, c, context),
    ),
  };
}
