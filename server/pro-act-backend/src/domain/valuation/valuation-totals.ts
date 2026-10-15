import { Ledger, LossKind } from '../accounting/accounting.types';
import { Dec } from '../actuals/decimal';
import { provisionalMark } from './currency-amounts';
import {
  INDEPENDENT_VIEW,
  LineValuation,
  LineViewValuation,
  TotalsView,
  ValuationPolicySnapshot,
} from './valuation.types';

/** A valued line as the totals see it. */
export interface TotalsLine {
  sliceId: string;
  ledger: Ledger;
  kind: LossKind;
  uom: string | null;
  quantity: Dec;
  impactCodeId: string | null;
  valuation: LineValuation;
}

export type TotalStatus = 'valued' | 'unvalued' | 'mixed';

/** Totals of one slice, ledger, kind, view and reporting currency (`period_valuation_totals`). */
export interface ValuationTotal {
  sliceId: string;
  ledger: Ledger;
  kind: LossKind;
  view: TotalsView;
  currency: string;
  uom: string | null;
  /** Σ valued lines in this currency; null when nothing is valued or an FX rate is missing (T45) */
  amount: Dec | null;
  /** Σ components priced in this currency itself (no conversion) — always available */
  nativeAmount: Dec;
  valuedLines: number;
  unvaluedLines: number;
  fxMissingLines: number;
  /** SME V7: valued lines converted with a provisional FX rate (their amounts are in `amount`) */
  fxProvisionalLines: number;
  unvaluedQuantity: Dec;
  unvaluedSeconds: Dec;
  status: TotalStatus;
  reasons: string[];
  fxRateIds: string[];
}

/** SME V7 reason on a total or report whose amount includes provisional-rate conversions. */
export const FX_PROVISIONAL = 'fx_rate_provisional';

type Slot = { view: TotalsView; valuation: LineViewValuation };

/** VAL02 `independent_components`: margin + time cost of one line, only when both are valued. */
function combined(
  views: readonly LineViewValuation[],
): LineViewValuation | null {
  const margin = views.find((v) => v.view === 'contribution_margin');
  const time = views.find((v) => v.view === 'cost_per_hour');
  if (!margin || !time) return null;
  const unvalued = [margin, time].find((v) => v.status === 'unvalued');
  return {
    view: 'contribution_margin',
    status: unvalued ? 'unvalued' : 'valued',
    reason: unvalued?.reason ?? null,
    components: unvalued ? [] : [...margin.components, ...time.components],
    amounts: margin.amounts.map((a, i) => {
      const b = time.amounts[i];
      const amount = a.amount && b?.amount ? a.amount.plus(b.amount) : null;
      return {
        currency: a.currency,
        amount: unvalued ? null : amount,
        reason: unvalued?.reason ?? (amount ? null : 'fx_rate_missing'),
        fxRateIds: [...new Set([...a.fxRateIds, ...(b?.fxRateIds ?? [])])],
        native: a.native && Boolean(b?.native),
        ...provisionalMark(Boolean(a.provisional || b?.provisional)),
      };
    }),
  };
}

function slotsOf(line: TotalsLine, policy: ValuationPolicySnapshot): Slot[] {
  const slots: Slot[] = line.valuation.views.map((v) => ({
    view: v.view,
    valuation: v,
  }));
  const independent =
    policy.timeBasisRule === 'independent_components' &&
    line.impactCodeId !== null &&
    policy.independentImpactCodeIds.includes(line.impactCodeId);
  const both = independent ? combined(line.valuation.views) : null;
  return both ? [...slots, { view: INDEPENDENT_VIEW, valuation: both }] : slots;
}

function emptyTotal(
  line: TotalsLine,
  view: TotalsView,
  currency: string,
): ValuationTotal {
  return {
    sliceId: line.sliceId,
    ledger: line.ledger,
    kind: line.kind,
    view,
    currency,
    uom: line.uom,
    amount: new Dec(0),
    nativeAmount: new Dec(0),
    valuedLines: 0,
    unvaluedLines: 0,
    fxMissingLines: 0,
    fxProvisionalLines: 0,
    unvaluedQuantity: new Dec(0),
    unvaluedSeconds: new Dec(0),
    status: 'valued',
    reasons: [],
    fxRateIds: [],
  };
}

const addReason = (total: ValuationTotal, reason: string | null) => {
  if (reason && !total.reasons.includes(reason)) total.reasons.push(reason);
};

function accumulate(
  total: ValuationTotal,
  line: TotalsLine,
  slot: Slot,
  index: number,
): void {
  const { valuation } = slot;
  if (valuation.status === 'unvalued') {
    total.unvaluedLines += 1;
    if (slot.view === 'cost_per_hour')
      total.unvaluedSeconds = total.unvaluedSeconds.plus(
        line.valuation.seconds ?? 0,
      );
    else total.unvaluedQuantity = total.unvaluedQuantity.plus(line.quantity);
    addReason(total, valuation.reason);
    return;
  }
  total.valuedLines += 1;
  const amount = valuation.amounts[index];
  total.nativeAmount = valuation.components
    .filter((c) => c.currency === total.currency)
    .reduce((sum, c) => sum.plus(c.amount), total.nativeAmount);
  if (!amount || amount.amount === null) {
    total.fxMissingLines += 1;
    addReason(total, amount?.reason ?? 'fx_rate_missing');
    return;
  }
  total.amount = (total.amount ?? new Dec(0)).plus(amount.amount);
  if (amount.provisional) {
    total.fxProvisionalLines += 1;
    addReason(total, FX_PROVISIONAL);
  }
  amount.fxRateIds.forEach((id) => {
    if (!total.fxRateIds.includes(id)) total.fxRateIds.push(id);
  });
}

function finish(total: ValuationTotal): ValuationTotal {
  const nothing = total.valuedLines === 0;
  const status: TotalStatus = nothing
    ? 'unvalued'
    : total.unvaluedLines === 0 && total.fxMissingLines === 0
      ? 'valued'
      : 'mixed';
  return {
    ...total,
    amount: nothing || total.fxMissingLines > 0 ? null : total.amount,
    status,
    reasons: [...total.reasons].sort(),
    fxRateIds: [...total.fxRateIds].sort(),
  };
}

/**
 * Valuation totals of a run (plan 2.6 step 3) per slice, ledger, loss kind, view and reporting currency.
 * Views are never added to each other (VAL02) — the only sum across views is the `independent_components`
 * row for impact codes the policy marks independent; kinds are never netted (gains and residuals keep
 * their own rows). Missing prices keep their quantity (`unvaluedQuantity`, T38); a missing FX rate makes
 * the currency total null (`fx_rate_missing`) while `nativeAmount` keeps the per-currency sum (T45); a
 * provisional-rate conversion is summed but counted (`fxProvisionalLines`, reason `fx_rate_provisional`, V7).
 */
export function valuationTotals(
  lines: readonly TotalsLine[],
  policy: ValuationPolicySnapshot,
): ValuationTotal[] {
  const totals = new Map<string, ValuationTotal>();
  for (const line of lines) {
    for (const slot of slotsOf(line, policy)) {
      policy.currencies.forEach((currency, index) => {
        const key = [
          line.sliceId,
          line.ledger,
          line.kind,
          slot.view,
          currency,
        ].join('|');
        const total = totals.get(key) ?? emptyTotal(line, slot.view, currency);
        accumulate(total, line, slot, index);
        totals.set(key, total);
      });
    }
  }
  return [...totals.values()].map(finish);
}
