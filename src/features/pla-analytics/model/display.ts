import type { LossTreeGroupBy, LossTreeGroupView, LossTreeMetric, LossTreeTotalView, TrendGroup } from '@/api/v2/types/pla-analytics';
import type { KpiAggregateView } from '@/api/v2/types/reports';
import { formatRatio, reasonText } from '@/features/downtime-analysis/model/kpi-display';
import { valuationReasonLabel } from '@/features/plan-dashboard/model/display';
import { currencyDigits } from '@/features/display-currency/money-format';
import { formatDecimal } from '@/features/ux-kit/format/decimal';

/** Labels and display rules of PLA Analytics (plan 3.6); the browser formats server figures, never derives them. */
export const TAB_LABELS = {
  waterfall: 'Waterfall',
  'loss-tree': 'Loss tree',
  trends: 'Trends',
  reconciliation: 'Reconciliation',
  quality: 'Quality coverage',
  'repeat-causes': 'Repeat causes',
  opportunities: 'Top opportunities',
  oee: 'OEE',
} as const;

export const LOSS_GROUP_LABELS: Record<LossTreeGroupBy, string> = {
  reason: 'Reason',
  impact: 'Impact',
  oee: 'OEE component',
  kind: 'Loss kind',
  unit: 'Unit',
};

export const METRIC_LABELS: Record<LossTreeMetric, string> = {
  qty: 'Lost quantity',
  margin: 'Contribution margin',
  standard_cost: 'Standard cost',
  operational_cost: 'Operational cost (per hour of downtime)',
};

export const TREND_LABELS: Record<TrendGroup, string> = { shift: 'Shift', day: 'Day', week: 'Week', month: 'Month' };

export const OEE_COMPONENTS = ['availability', 'performance', 'quality', 'oee'] as const;
export const RECONCILED_COMPONENTS = ['reconciled_availability', 'reconciled_performance', 'reconciled_quality', 'reconciled_oee'] as const;

/** A loss amount with its unit (uom or currency); null says why — never a 0 (VAL02, T45). */
export function amountText(row: Pick<LossTreeGroupView | LossTreeTotalView, 'amount' | 'unit' | 'reasons' | 'status'>, metric: LossTreeMetric): string {
  const unit = row.unit ?? (metric === 'qty' ? 'unit unknown' : 'no currency');
  if (row.amount === null) return `Not valued (${notValuedReason(row.reasons)})`;
  const digits = metric === 'qty' ? 2 : currencyDigits(row.unit);
  return `${formatDecimal(row.amount, digits)} ${unit}`;
}

export function notValuedReason(reasons: readonly string[]): string {
  if (reasons.length === 0) return 'no valuation recorded';
  return reasons.map((reason) => (reason === 'not_valued' ? 'no valuation recorded' : valuationReasonLabel(reason))).join('; ');
}

/** "87.5 %" from a server ratio; null → "—". */
export const shareText = (value: string | null) => formatRatio(value, 1);

/**
 * OEE tile text (T41, KPI04): the server's value as a percentage, or "Not available: <reason>" — never a
 * fabricated 87 % or a default 100 % quality.
 */
export function kpiText(view: KpiAggregateView | undefined): string {
  if (!view) return 'Not available: no calculated periods';
  if (view.value === null) return `Not available: ${(reasonText(view.reason) ?? 'no data').toLowerCase()}`;
  return formatRatio(view.value, 1);
}

export const findKpi = (views: readonly KpiAggregateView[] | undefined, metric: string) => views?.find((v) => v.metric === metric);

/** "2 d 3 h" from server seconds (an age, display only). */
export function ageText(seconds: number): string {
  if (seconds < 0) return 'not ended';
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}
