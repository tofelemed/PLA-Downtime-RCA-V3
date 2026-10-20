import type { DigitSystem } from '@/lib/dates';
import { formatDecimal, formatNumber } from '@/features/ux-kit/format/decimal';
import type { RcaRecommendationView } from '@/api/v2/types/rca';
import { formatDuration } from '@/features/ux-kit/format/duration';

/** Plain words of the RCA trigger kinds (backend `src/domain/rca/rca-triggers.ts`, `approved-triggers.ts`). */
export const TRIGGER_LABELS: Readonly<Record<string, string>> = {
  duration: 'Long unplanned stop',
  repeat: 'Same failure repeating',
  cumulative: 'Downtime adding up on one asset',
  consequence: 'Safety or critical consequence',
  cost: 'High valued loss',
  quantity: 'Large lost quantity',
  rule: 'RCA trigger rule',
  reevaluate: 'Recurred after closure',
};

/** Thresholds that a critical asset lowers (production thresholds; cost and repeats are never scaled). */
const SCALED_BY_CRITICALITY = new Set(['duration', 'cumulative', 'quantity']);

type Detail = RcaRecommendationView['detail'];

const num = (detail: Detail, key: string): number | null => {
  const value = detail[key];
  if (typeof value === 'number') return value;
  return typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
};
const text = (detail: Detail, key: string): string | null => {
  const value = detail[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
};
const duration = (seconds: number | null, digits?: DigitSystem) => (seconds === null ? null : formatDuration(seconds, 'long', digits));

function durationText(detail: Detail, digits?: DigitSystem): string | null {
  const seconds = duration(num(detail, 'seconds'), digits);
  const limit = duration(num(detail, 'thresholdSeconds'), digits);
  return seconds && limit ? `${seconds} (limit ${limit})` : null;
}

function repeatText(detail: Detail, digits?: DigitSystem): string | null {
  const failures = num(detail, 'failures');
  const days = num(detail, 'repeatWindowDays');
  if (failures === null || days === null) return null;
  const limit = num(detail, 'repeatCount');
  return `${formatNumber(failures, 0, digits)} failures in ${formatNumber(days, 0, digits)} days${limit === null ? '' : ` (limit ${formatNumber(limit, 0, digits)})`}`;
}

function cumulativeText(detail: Detail, digits?: DigitSystem): string | null {
  const seconds = duration(num(detail, 'seconds'), digits);
  const days = num(detail, 'windowDays');
  const limit = duration(num(detail, 'thresholdSeconds'), digits);
  return seconds && days !== null ? `${seconds} in ${formatNumber(days, 0, digits)} days${limit ? ` (limit ${limit})` : ''}` : null;
}

function quantityText(detail: Detail, digits?: DigitSystem): string | null {
  const lost = text(detail, 'lostQuantity');
  const limit = text(detail, 'thresholdQuantity');
  const uom = text(detail, 'uom');
  const unit = (value: string) => (uom ? `${formatDecimal(value, 2, digits)} ${uom}` : formatDecimal(value, 2, digits));
  return lost && limit ? `lost ${unit(lost)} (limit ${unit(limit)})` : null;
}

function costText(detail: Detail, digits?: DigitSystem): string | null {
  const amount = text(detail, 'amount');
  const currency = text(detail, 'currency');
  const limit = text(detail, 'threshold');
  const money = (value: string) => (currency ? `${formatDecimal(value, 0, digits)} ${currency}` : formatDecimal(value, 0, digits));
  if (!amount) return null;
  return `${money(amount)}${limit ? ` (limit ${money(limit)})` : ''}`;
}

function consequenceText(detail: Detail): string | null {
  const marker = text(detail, 'marker');
  if (!marker) return null;
  const [kind, value] = marker.split(':');
  return value ? `event marked ${value} (${kind === 'solType' ? 'type' : 'severity'})` : marker;
}

/** D-T3 watch: incidents since the closure and the guarded rate against the case's frozen baseline. */
function reevaluateText(detail: Detail, digits?: DigitSystem): string | null {
  const incidents = num(detail, 'incidents');
  const rate = text(detail, 'guardedRate');
  const baseline = text(detail, 'baselineRate');
  if (incidents === null || !rate || !baseline) return null;
  const count = `${formatNumber(incidents, 0, digits)} ${incidents === 1 ? 'incident' : 'incidents'} since closure`;
  return `${count}: ${formatDecimal(rate, 2, digits)} per 1,000 run hours (baseline ${formatDecimal(baseline, 2, digits)})`;
}

const DETAIL_TEXT: Readonly<Record<string, (detail: Detail, digits?: DigitSystem) => string | null>> = {
  duration: durationText,
  repeat: repeatText,
  cumulative: cumulativeText,
  quantity: quantityText,
  cost: costText,
  consequence: consequenceText,
  reevaluate: reevaluateText,
};

/** What the server recorded when the trigger fired, in plain words and the plant's digits (empty when nothing usable). */
export function triggerDetailText(rec: Pick<RcaRecommendationView, 'trigger' | 'detail'>, digits?: DigitSystem): string[] {
  const parts: string[] = [];
  const main = DETAIL_TEXT[rec.trigger]?.(rec.detail, digits);
  if (main) parts.push(main);
  if (rec.detail.criticalAsset === true && SCALED_BY_CRITICALITY.has(rec.trigger)) parts.push('critical asset: lower threshold');
  return parts;
}
