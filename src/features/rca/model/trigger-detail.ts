import { formatDecimal } from '@/features/ux-kit/format/decimal';
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
const duration = (seconds: number | null) => (seconds === null ? null : formatDuration(seconds, 'long'));

function durationText(detail: Detail): string | null {
  const seconds = duration(num(detail, 'seconds'));
  const limit = duration(num(detail, 'thresholdSeconds'));
  return seconds && limit ? `${seconds} (limit ${limit})` : null;
}

function repeatText(detail: Detail): string | null {
  const failures = num(detail, 'failures');
  const days = num(detail, 'repeatWindowDays');
  if (failures === null || days === null) return null;
  const limit = num(detail, 'repeatCount');
  return `${failures} failures in ${days} days${limit === null ? '' : ` (limit ${limit})`}`;
}

function cumulativeText(detail: Detail): string | null {
  const seconds = duration(num(detail, 'seconds'));
  const days = num(detail, 'windowDays');
  const limit = duration(num(detail, 'thresholdSeconds'));
  return seconds && days !== null ? `${seconds} in ${days} days${limit ? ` (limit ${limit})` : ''}` : null;
}

function quantityText(detail: Detail): string | null {
  const lost = text(detail, 'lostQuantity');
  const limit = text(detail, 'thresholdQuantity');
  const uom = text(detail, 'uom');
  const unit = (value: string) => (uom ? `${formatDecimal(value, 2)} ${uom}` : formatDecimal(value, 2));
  return lost && limit ? `lost ${unit(lost)} (limit ${unit(limit)})` : null;
}

function costText(detail: Detail): string | null {
  const amount = text(detail, 'amount');
  const currency = text(detail, 'currency');
  const limit = text(detail, 'threshold');
  const money = (value: string) => (currency ? `${formatDecimal(value, 0)} ${currency}` : formatDecimal(value, 0));
  if (!amount) return null;
  return `${money(amount)}${limit ? ` (limit ${money(limit)})` : ''}`;
}

function consequenceText(detail: Detail): string | null {
  const marker = text(detail, 'marker');
  if (!marker) return null;
  const [kind, value] = marker.split(':');
  return value ? `event marked ${value} (${kind === 'solType' ? 'type' : 'severity'})` : marker;
}

const DETAIL_TEXT: Readonly<Record<string, (detail: Detail) => string | null>> = {
  duration: durationText,
  repeat: repeatText,
  cumulative: cumulativeText,
  quantity: quantityText,
  cost: costText,
  consequence: consequenceText,
};

/** What the server recorded when the trigger fired, in plain words (empty when it recorded nothing usable). */
export function triggerDetailText(rec: Pick<RcaRecommendationView, 'trigger' | 'detail'>): string[] {
  const parts: string[] = [];
  const main = DETAIL_TEXT[rec.trigger]?.(rec.detail);
  if (main) parts.push(main);
  if (rec.detail.criticalAsset === true && SCALED_BY_CRITICALITY.has(rec.trigger)) parts.push('critical asset: lower threshold');
  return parts;
}
