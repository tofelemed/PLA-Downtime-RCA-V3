import type { LossTreeGroupBy, LossTreeGroupView, LossTreeMetric, LossTreeMetricParam, LossTreeTotalView, TrendGroup } from '@/api/v2/types/pla-analytics';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import type { CurrencyValueView } from '@/api/v2/types/period-overview';
import { formatRatio, reasonText } from '@/features/downtime-analysis/model/kpi-display';
import { valuationReasonLabel } from '@/features/plan-dashboard/model/display';
import { currencyDigits, formatCurrencyAmount } from '@/features/display-currency/money-format';
import { formatDecimal } from '@/features/ux-kit/format/decimal';
import { type DigitSystem, toDigits } from '@/lib/dates';

/** Labels and display rules of PLA Analytics (plan 3.6); the browser formats server figures, never derives them. */
export const TAB_LABELS = {
  waterfall: 'Waterfall',
  losses: 'Losses',
  trends: 'Trends',
  reconciliation: 'Reconciliation',
  oee: 'OEE',
} as const;

export const LOSS_EVENT_TYPE_LABELS = {
  all: 'All loss events',
  downtime: 'Stops',
  slowdown: 'Slowdowns',
  quality_loss: 'Quality losses',
} as const;

/** Actuals quality states and KPI quality flags (server tokens → words). */
export const QUALITY_STATE_LABELS: Readonly<Record<string, string>> = {
  complete: 'Complete',
  partial: 'Partial',
  missing: 'Missing',
  conflict: 'Conflict',
  ok: 'OK',
  estimated: 'Estimated',
  exception: 'Above 100 %',
  provisional: 'Provisional',
  unavailable: 'Not available',
};

/** Export job states (2.9). */
export const EXPORT_STATE_LABELS: Readonly<Record<string, string>> = {
  queued: 'queued',
  running: 'running',
  completed: 'ready',
  failed: 'failed',
  expired: 'expired',
};

export const LOSS_GROUP_LABELS: Record<LossTreeGroupBy, string> = {
  reason: 'Reason',
  impact: 'Impact',
  oee: 'OEE component',
  kind: 'Loss kind',
  unit: 'Unit',
  qualityClass: 'Quality class',
};

export const METRIC_LABELS: Record<LossTreeMetricParam, string> = {
  qty: 'Lost quantity',
  value: 'Value (policy default view)',
  economic_impact: 'Economic impact',
  margin: 'Contribution margin',
  standard_cost: 'Standard cost',
  operational_cost: 'Operational cost (per hour of downtime)',
};

/** The heading of a loss view: the resolved metric, marked when it is the policy's default view (SME V8). */
export function shownMetricLabel(asked: LossTreeMetricParam, data: { metric: LossTreeMetric; defaultView: boolean } | undefined): string {
  if (!data) return METRIC_LABELS[asked];
  return data.defaultView ? `${METRIC_LABELS[data.metric]} (policy default)` : METRIC_LABELS[data.metric];
}

/** A label inside a sentence: "Reason" → "reason", but acronyms keep their case ("OEE component", never "oee"). */
export function inSentence(label: string): string {
  const first = label.split(' ')[0];
  if (first.length > 1 && first === first.toUpperCase()) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

export const TREND_LABELS: Record<TrendGroup, string> = { shift: 'Shift', day: 'Day', week: 'Week', month: 'Month' };

export const OEE_METRIC_LABELS: Readonly<Record<string, string>> = {
  oee: 'OEE',
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
};

export const OEE_COMPONENTS = ['availability', 'performance', 'quality', 'oee'] as const;
export const RECONCILED_COMPONENTS = ['reconciled_availability', 'reconciled_performance', 'reconciled_quality', 'reconciled_oee'] as const;

/** A loss amount with its unit (uom or currency); null says why — never a 0 (VAL02, T45). */
export function amountText(
  row: Pick<LossTreeGroupView | LossTreeTotalView, 'amount' | 'unit' | 'reasons' | 'status'>,
  metric: LossTreeMetric,
  digitSystem?: DigitSystem,
): string {
  const unit = row.unit ?? (metric === 'qty' ? 'unit unknown' : 'no currency');
  if (row.amount === null) return `Not valued (${notValuedReason(row.reasons)})`;
  const digits = metric === 'qty' ? 2 : currencyDigits(row.unit);
  return `${formatDecimal(row.amount, digits, digitSystem)} ${unit}`;
}

export function notValuedReason(reasons: readonly string[]): string {
  if (reasons.length === 0) return 'no valuation recorded';
  return reasons.map((reason) => (reason === 'not_valued' ? 'no valuation recorded' : valuationReasonLabel(reason))).join('; ');
}

/** An amount, or "Not valued" with the server's reasons in words (QA: "— USD (not valued)" gave no reason). */
export function valueText(value: CurrencyValueView, digits?: DigitSystem): string {
  if (value.amount !== null) return formatCurrencyAmount(value.amount, value.currency, digits);
  return `Not valued in ${value.currency} (${notValuedReason(value.reasons)})`;
}

/**
 * What the coverage ratio counts (QA: Reports 43 % vs Dashboard 86 % for the same window): the share of the
 * window's periods whose figures are shown — approved ones with "Approved revisions only", otherwise every
 * calculated one (approved, else its draft). Same server ratio, said for the selection it was taken over.
 */
export function coverageText(coverage: string, approvedOnly: boolean): string {
  return approvedOnly ? `${coverage} of periods approved` : `${coverage} of periods calculated`;
}

/** "87.5 %" from a server ratio; null → "—". */
export const shareText = (value: string | null, digits?: DigitSystem) => formatRatio(value, 1, digits);

/**
 * OEE tile text (T41, KPI04): the server's value as a percentage, or "Not available: <reason>" — never a
 * fabricated 87 % or a default 100 % quality.
 */
export function kpiText(view: KpiAggregateView | undefined, digits?: DigitSystem): string {
  if (!view) return 'Not available: no calculated periods';
  if (view.value === null) return `Not available: ${(reasonText(view.reason) ?? 'no data').toLowerCase()}`;
  return formatRatio(view.value, 1, digits);
}

export const findKpi = (views: readonly KpiAggregateView[] | undefined, metric: string) => views?.find((v) => v.metric === metric);

/** "2 d 3 h" from server seconds (an age, display only), in the plant's digits. */
export function ageText(seconds: number, digits?: DigitSystem): string {
  if (seconds < 0) return 'not ended';
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return toDigits(`${hours} h`, digits);
  return toDigits(`${Math.floor(hours / 24)} d ${hours % 24} h`, digits);
}
