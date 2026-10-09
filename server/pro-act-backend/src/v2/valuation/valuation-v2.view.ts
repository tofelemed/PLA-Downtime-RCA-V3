import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import { FxRate } from '../../valuation/entities/fx-rate.entity';
import { snapshotOf } from '../../valuation/valuation-policy.store';

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export interface FxRateV2View {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  /** decimal string: units of toCurrency per 1 fromCurrency */
  rate: string;
  source: string | null;
  version: number;
  state: string;
  effectiveFrom: string;
  effectiveTo: string | null;
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
  createdBy: string | null;
  createdAt: string;
}

export function toFxRateView(rate: FxRate): FxRateV2View {
  const value = toDec(rate.rate);
  return {
    id: rate.id,
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    rate: value ? formatDec(value) : String(rate.rate),
    source: rate.source,
    version: rate.version,
    state: rate.state,
    effectiveFrom: rate.effectiveFrom.toISOString(),
    effectiveTo: iso(rate.effectiveTo),
    approvedBy: rate.approvedBy,
    approvedAt: iso(rate.approvedAt),
    rowVersion: rate.rowVersion,
    createdAt: rate.createdAt.toISOString(),
    updatedAt: rate.updatedAt.toISOString(),
  };
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
    createdBy: policy.createdBy,
    createdAt: policy.createdAt.toISOString(),
  };
}

/** Canonical decimal string of a stored money / quantity value; null stays null. */
export function moneyText(value: string | number | null): string | null {
  const parsed = toDec(value);
  return parsed === null ? null : formatDec(new Dec(parsed));
}
