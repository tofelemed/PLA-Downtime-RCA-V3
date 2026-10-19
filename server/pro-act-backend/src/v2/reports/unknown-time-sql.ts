import { KpiMetric } from '../../domain/kpi/kpi.types';

/**
 * Owner decision 2026-10-19 (QA re-test) "Unknown time is never available time". A period's unknown state
 * seconds are the `unknownSeconds` of its stored `state_coverage` row (SME D2: scheduled time the unit's
 * state timeline does not know — no data, stale, bad quality, unmapped). Over a report window they leave
 * the time terms of the availability-type KPIs, per period and clamped at zero:
 *
 * - scheduled / controllable availability: run time − U over scheduled time − U
 *   (= 1 − downtime ÷ known scheduled time; a stop recorded inside unknown time stays a stop);
 * - onstream factor: (calendar − downtime) − U over calendar − U;
 * - MTBF: operating exposure − U over the same failures.
 *
 * Stored per-period rows are not changed (no recalculation): a period whose state is fully known (U = 0)
 * keeps its figures, and a unit without a state mapping has no `state_coverage` row (U = 0).
 */
export const UNKNOWN_TIME_TERMS: Readonly<{
  numerator: readonly KpiMetric[];
  denominator: readonly KpiMetric[];
}> = {
  numerator: [
    'scheduled_availability',
    'controllable_availability',
    'onstream_factor',
    'mtbf',
  ],
  denominator: [
    'scheduled_availability',
    'controllable_availability',
    'onstream_factor',
  ],
};

/** `unk."seconds"`: the shown run's unknown state seconds of the period (null without a coverage row). */
export const PERIOD_UNKNOWN = `(SELECT GREATEST(COALESCE((u."cohort"->>'unknownSeconds')::numeric, 0), 0) AS "seconds"
    FROM "kpi_results" u
   WHERE u."tenant_id" = $1 AND u."run_id" = s."run_id" AND u."metric" = 'state_coverage'
     AND u."scope"->>'level' = 'period'
   LIMIT 1) unk`;

const U = `COALESCE(unk."seconds", 0)`;

/** $11 = metrics whose numerator loses U, $12 = metrics whose denominator loses U. */
export const UNKNOWN_NUMERATOR = `CASE WHEN m."metric" = ANY($11::kpi_metric[]) THEN GREATEST(k."numerator" - ${U}, 0) ELSE k."numerator" END`;
export const UNKNOWN_DENOMINATOR = `CASE WHEN m."metric" = ANY($12::kpi_metric[]) THEN GREATEST(k."denominator" - ${U}, 0) ELSE k."denominator" END`;
export const UNKNOWN_EXCLUDED = `CASE WHEN m."metric" = ANY($11::kpi_metric[]) THEN ${U} ELSE 0 END`;

/** The metric lists of $11 / $12 (empty = stored terms unchanged). */
export function unknownTimeTerms(exclude: boolean): {
  numerator: KpiMetric[];
  denominator: KpiMetric[];
} {
  if (!exclude) return { numerator: [], denominator: [] };
  return {
    numerator: [...UNKNOWN_TIME_TERMS.numerator],
    denominator: [...UNKNOWN_TIME_TERMS.denominator],
  };
}
