import { unionSeconds } from '../../domain/time/interval-algebra';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';
import { ReadinessCheckView, ReadinessStatus } from './readiness-v2.view';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

const LABELS: Record<string, [string, string]> = {
  unit: ['unit', 'Active production unit'],
  assets: ['assets', 'Equipment records'],
  product: ['products', 'Selected product'],
  codes: ['codes', 'Active leaf reason codes'],
  stop_policy: ['stop-policy', 'Stop derivation policy'],
  impact: ['impact', 'Asset impact rules'],
  calendar: ['calendar', 'Published calendar coverage'],
  profile: ['profiles', 'Approved profile coverage'],
  planning_rate: ['profiles', 'Approved planning rate'],
  sustained_rate: ['profiles', 'Approved sustained rate'],
  connection: ['connection', 'Saved MQTT connection'],
  signals: ['signals', 'Effective signal definitions'],
  state_mapping: ['state', 'State mapping coverage'],
  authority: ['authority', 'Approved MQTT output priority'],
  valuation_policy: ['finance', 'Approved valuation policy'],
  margin: ['finance', 'Approved contribution margin'],
  fx: ['finance', 'Exchange rate coverage'],
  state_coverage: ['telemetry', 'Known physical state coverage'],
  output_coverage: ['telemetry', 'Usable output telemetry'],
  plan: ['plan', 'Selected plan approval and periods'],
  period: ['period', 'Selected period calculation and approval'],
  day: ['period', 'Production day certification'],
  events: ['events', 'Event and coding evidence'],
  analysis: ['analysis', 'Analysis review'],
};
export function check(
  id: string,
  status: ReadinessStatus,
  detail: string,
  coverage: number | null = null,
): ReadinessCheckView {
  const [stepId, label] = LABELS[id];
  return { id, stepId, label, status, detail, coverage };
}
export interface EffectiveSpan {
  effectiveFrom: Date;
  effectiveTo: Date | null;
}
export function overlapping<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: EquipmentReadinessQueryDto,
) {
  return qb.andWhere(
    'r.effectiveFrom < :to AND (r.effectiveTo IS NULL OR r.effectiveTo > :from)',
    query,
  );
}
export const windowOf = (query: EquipmentReadinessQueryDto) => ({
  start: new Date(query.from),
  end: new Date(query.to),
});
export function spanCoverage(
  rows: readonly EffectiveSpan[],
  query: EquipmentReadinessQueryDto,
): number {
  const { start, end } = windowOf(query);
  const intervals = rows
    .map((row) => ({
      start: new Date(Math.max(start.getTime(), row.effectiveFrom.getTime())),
      end: new Date(
        Math.min(end.getTime(), row.effectiveTo?.getTime() ?? Infinity),
      ),
    }))
    .filter((span) => span.end > span.start);
  return Math.min(
    1,
    unionSeconds(intervals) / ((end.getTime() - start.getTime()) / 1000),
  );
}
export function coverageCheck(
  id: string,
  rows: readonly EffectiveSpan[],
  query: EquipmentReadinessQueryDto,
  pending = false,
): ReadinessCheckView {
  const ratio = spanCoverage(rows, query);
  if (ratio === 1)
    return check(
      id,
      'ready',
      'Effective approved/published records cover the full selected window.',
      ratio,
    );
  const detail = pending
    ? 'Records exist, but approval/publication or effective-date coverage is missing.'
    : 'No effective records cover the full selected window. Create or select the required versions.';
  return check(
    id,
    rows.length || pending ? 'needs_attention' : 'missing',
    detail,
    ratio,
  );
}
