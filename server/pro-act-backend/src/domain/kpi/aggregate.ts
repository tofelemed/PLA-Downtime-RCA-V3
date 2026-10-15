import { Dec, ZERO } from '../actuals/decimal';
import { KpiMetric, KpiQuality, KpiUnit } from './kpi.types';

const RATIO_METRICS: ReadonlySet<KpiMetric> = new Set<KpiMetric>([
  'availability',
  'performance',
  'quality',
  'oee',
  'reconciled_availability',
  'reconciled_performance',
  'reconciled_quality',
  'reconciled_oee',
  'scheduled_availability',
  'controllable_availability',
  'onstream_factor',
  'coded_downtime_ratio',
]);
const MEAN_METRICS: ReadonlySet<KpiMetric> = new Set<KpiMetric>([
  'mean_stop_duration',
  'mtbf',
  'mttr',
  'mean_downtime_to_restore',
]);
const COUNT_METRICS: ReadonlySet<KpiMetric> = new Set<KpiMetric>([
  'stop_count',
  'carry_in_count',
]);

export type AggregateKind = 'ratio' | 'mean' | 'amount' | 'min';

export function aggregateKindOf(metric: KpiMetric): AggregateKind {
  if (RATIO_METRICS.has(metric)) return 'ratio';
  if (MEAN_METRICS.has(metric)) return 'mean';
  return metric === 'coverage' ? 'min' : 'amount';
}

export function unitOf(metric: KpiMetric): KpiUnit {
  if (RATIO_METRICS.has(metric) || metric === 'coverage') return 'ratio';
  return COUNT_METRICS.has(metric) ? 'count' : 's';
}

/** Summed terms of a group of stored results (the SQL `SUM`s of the report read models). */
export interface GroupTerms {
  /** Σ numerators of the complete rows */
  numerator: Dec | null;
  /** Σ denominators of the complete rows */
  denominator: Dec | null;
  /** smallest value (coverage only) */
  minValue: Dec | null;
  rows: number;
  /** rows whose terms are present (the others are missing data, never zero) */
  complete: number;
  provisionalRows: number;
  /** distinct `oee_policy` versions behind the rows */
  policies: number;
  reasons: string[];
}

export interface KpiAggregate {
  numerator: Dec | null;
  denominator: Dec | null;
  value: Dec | null;
  quality: KpiQuality;
  reason: string | null;
  rows: number;
  missing: number;
}

const ZERO_REASON: Partial<Record<KpiMetric, string>> = {
  mtbf: 'no_failures',
  mean_downtime_to_restore: 'no_restored_failures',
  mean_stop_duration: 'no_completed_stops',
  mttr: 'repair_evidence_missing',
};

function finish(
  group: GroupTerms,
  value: Dec | null,
  base: Omit<KpiAggregate, 'quality' | 'reason' | 'value'>,
): KpiAggregate {
  const missing = group.rows - group.complete;
  if (missing > 0)
    return {
      ...base,
      value,
      quality: 'provisional',
      reason: 'incomplete_periods',
    };
  if (group.provisionalRows > 0)
    return {
      ...base,
      value,
      quality: 'provisional',
      reason: 'provisional_inputs',
    };
  return { ...base, value, quality: 'ok', reason: null };
}

/**
 * AN03 / T31: a group's KPI from its summed numerators and denominators — never an average of
 * percentages. No complete row → null with the stored reasons; a zero denominator → null with the
 * metric's reason; different OEE policies behind one ratio → unavailable (incompatible denominators);
 * ratios above 1 stay as exceptions; missing or provisional rows make the result provisional.
 */
export function combine(metric: KpiMetric, group: GroupTerms): KpiAggregate {
  const kind = aggregateKindOf(metric);
  const base = {
    numerator: group.numerator,
    denominator: kind === 'ratio' || kind === 'mean' ? group.denominator : null,
    rows: group.rows,
    missing: group.rows - group.complete,
  };
  const none = (reason: string): KpiAggregate => ({
    ...base,
    value: null,
    quality: 'unavailable',
    reason,
  });
  if (group.complete === 0)
    return none(group.reasons.sort().join(',') || 'no_data');
  if (kind === 'min') return finish(group, group.minValue, base);
  if (kind === 'amount') return finish(group, group.numerator, base);
  if (kind === 'ratio' && group.policies > 1)
    return none('incompatible_policies');
  const { numerator, denominator } = group;
  if (numerator === null || denominator === null) return none('input_missing');
  if (denominator.isZero())
    return none(ZERO_REASON[metric] ?? 'no_scheduled_time');
  const value = numerator
    .div(denominator)
    .toDecimalPlaces(kind === 'ratio' ? 10 : 8);
  if (kind === 'ratio' && value.gt(1)) {
    return {
      ...base,
      value,
      quality: 'exception',
      reason: 'above_100_percent',
    };
  }
  return finish(group, value, base);
}

/** Stored per-period rows → group terms (in memory; the report read models sum in SQL instead). */
export interface StoredKpi {
  numerator: Dec | null;
  denominator: Dec | null;
  value: Dec | null;
  quality: KpiQuality;
  reason: string | null;
  policyId: string | null;
}

export function groupTerms(
  metric: KpiMetric,
  rows: readonly StoredKpi[],
): GroupTerms {
  const kind = aggregateKindOf(metric);
  const complete = rows.filter((r) =>
    kind === 'min'
      ? r.value !== null
      : kind === 'amount'
        ? r.numerator !== null
        : r.numerator !== null && r.denominator !== null,
  );
  const values = complete.flatMap((r) => (r.value ? [r.value] : []));
  return {
    numerator: complete.reduce((s, r) => s.plus(r.numerator ?? ZERO), ZERO),
    denominator: complete.reduce((s, r) => s.plus(r.denominator ?? ZERO), ZERO),
    minValue: values.length ? Dec.min(...values) : null,
    rows: rows.length,
    complete: complete.length,
    provisionalRows: rows.filter((r) => r.quality === 'provisional').length,
    policies: new Set(rows.map((r) => r.policyId)).size,
    reasons: [
      ...new Set(
        rows.flatMap((r) => (r.value === null && r.reason ? [r.reason] : [])),
      ),
    ],
  };
}
