import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { FxRate } from '../../valuation/entities/fx-rate.entity';
import { RevaluationRequested } from '../../valuation/valuation-events';
import { snapshotOf } from '../../valuation/valuation-policy.store';

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export interface FxRateV2View {
  id: string;
  /** SME V5: the named rate table (economic, group_reporting, budget) */
  rateType: string;
  fromCurrency: string;
  toCurrency: string;
  /** decimal string: units of toCurrency per 1 fromCurrency */
  rate: string;
  source: string | null;
  /** SME V7: an authorised provisional rate (its values are marked provisional until the final one) */
  provisional: boolean;
  version: number;
  state: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** the draft's author: requires another approver unless SuperAdmin (403 SEPARATION_OF_DUTIES) */
  createdBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ValuationPolicyV2View {
  id: string;
  version: number;
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** the stored body, unchanged (v1 may carry the `XXX` placeholder) */
  body: Record<string, unknown>;
  /** reporting currencies as valuation applies them (empty for the `XXX` placeholder) */
  reportingCurrencies: string[];
  notes: string | null;
  /** commissioning backdate reason (null = not backdated, owner 18 Oct 2026) */
  backdateReason: string | null;
  /** a backdate over approved figures revalues them through change proposals */
  restateApproved: boolean;
  createdBy: string | null;
  createdAt: string;
}

/** Approve response: the version and the revaluation it queued (SME V7). */
export interface ValuationPolicyApproveV2View extends ValuationPolicyV2View {
  revaluation: RevaluationRequested | null;
}

export function toFxRateView(rate: FxRate): FxRateV2View {
  const value = toDec(rate.rate);
  return {
    id: rate.id,
    rateType: rate.rateType,
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    rate: value ? formatDec(value) : String(rate.rate),
    source: rate.source,
    provisional: rate.provisional,
    version: rate.version,
    state: rate.state,
    effectiveFrom: rate.effectiveFrom.toISOString(),
    effectiveTo: iso(rate.effectiveTo),
    createdBy: rate.createdBy,
    approvedBy: rate.approvedBy,
    approvedAt: iso(rate.approvedAt),
    rowVersion: rate.rowVersion,
    createdAt: rate.createdAt.toISOString(),
    updatedAt: rate.updatedAt.toISOString(),
  };
}

/** Approve / retire response: the version and the revaluation it queued (null when none, SME V7). */
export interface FxRateTransitionV2View extends FxRateV2View {
  revaluation: RevaluationRequested | null;
}

export function toFxTransitionView(result: {
  rate: FxRate;
  revaluation: RevaluationRequested | null;
}): FxRateTransitionV2View {
  return { ...toFxRateView(result.rate), revaluation: result.revaluation };
}

export function toValuationPolicyView(
  policy: AccountingPolicy,
): ValuationPolicyV2View {
  return {
    id: policy.id,
    version: policy.version,
    approved: policy.approvedAt !== null,
    approvedBy: policy.approvedBy,
    approvedAt: iso(policy.approvedAt),
    effectiveFrom: policy.effectiveFrom.toISOString(),
    effectiveTo: iso(policy.effectiveTo),
    body: policy.body,
    reportingCurrencies: snapshotOf(policy).currencies,
    notes: policy.notes,
    backdateReason: policy.backdateReason,
    restateApproved: policy.restateApproved,
    createdBy: policy.createdBy,
    createdAt: policy.createdAt.toISOString(),
  };
}

/** Canonical decimal string of a stored money / quantity value; null stays null. */
export function moneyText(value: string | number | null): string | null {
  const parsed = toDec(value);
  return parsed === null ? null : formatDec(new Dec(parsed));
}
