import { EntityManager } from 'typeorm';
import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import { params, SHOWN } from '../reports/report-sql';
import { ReportScope } from '../reports/report-scope';
import { summarizeTransitions, TransitionPairView } from './transition-pairs';

export const TRANSITION_LIMIT = 500;

/** One grade transition of the window against the approved standard the calculation applied (R5). */
export interface TransitionRowView {
  eventId: string;
  unitId: string;
  unitName: string | null;
  start: string;
  end: string | null;
  /** seconds of an ended transition, null while running */
  seconds: string | null;
  fromProductId: string | null;
  fromProduct: string | null;
  toProductId: string | null;
  toProduct: string | null;
  catalystFamily: string | null;
  operatingMode: string | null;
  /** the standard the calculation matched (`transition_standard:` line flag); null = none or not calculated */
  standardId: string | null;
  referenceSeconds: string | null;
  referenceOffgrade: string | null;
  /** seconds over (positive) or under the standard; null without a standard or while running */
  excessSeconds: string | null;
  /** capacity-ledger loss of the transition in the shown runs: within the standard and over it */
  uom: string | null;
  allowanceLoss: string | null;
  excessLoss: string | null;
  /** transition off-grade quantity of its lines */
  offGrade: string | null;
  /** the calculation found no approved standard for this change */
  noStandard: boolean;
  /** no shown run has lines of this transition yet */
  calculated: boolean;
}

export interface TransitionPerformanceView {
  transitions: TransitionRowView[];
  truncated: boolean;
  /** per product change (from → to): count, durations and excess, from the listed transitions */
  pairs: TransitionPairView[];
}

export interface TransitionRow {
  event_id: string;
  unit_id: string;
  unit_name: string | null;
  start_time: Date;
  end_time: Date | null;
  seconds: string | null;
  from_product_id: string | null;
  from_product: string | null;
  to_product_id: string | null;
  to_product: string | null;
  catalyst_family: string | null;
  operating_mode: string | null;
  standard_id: string | null;
  reference_seconds: string | null;
  reference_offgrade: string | null;
  uom: string | null;
  allowance_loss: string | null;
  excess_loss: string | null;
  off_grade: string | null;
  no_standard: boolean | null;
  lines: number;
}

/**
 * Live grade transitions of the units starting in [from, to) (newest first, $6 = limit + 1) with their
 * capacity-ledger lines in the shown runs of the window's periods. $1..$5 = SHOWN.
 */
const SQL = `${SHOWN},
ev AS (
  SELECT e."id", e."unit_id", e."start_time", e."end_time", e."duration_seconds", e."from_product_id",
         e."to_product_id", e."catalyst_family", e."operating_mode"
    FROM "production_events" e
   WHERE e."tenant_id" = $1 AND e."unit_id" = ANY($2::uuid[]) AND e."start_time" >= $3 AND e."start_time" < $4
     AND e."physical_type" = 'grade_transition' AND e."physical_state" IN ('open', 'closed')
   ORDER BY e."start_time" DESC, e."id" LIMIT $6),
ln AS (
  SELECT l."cause_event_id", l."kind"::text AS "kind", l."uom", l."quantity", l."flags"
    FROM shown s
    JOIN "loss_lines" l ON l."run_id" = s."run_id" AND l."tenant_id" = $1 AND l."period_id" = s."period_id"
   WHERE l."ledger" = 'capacity' AND l."state" = 'active' AND l."source" <> 'candidate_superseded'
     AND l."cause_event_id" IN (SELECT "id" FROM ev))
SELECT ev."id"::text AS "event_id", ev."unit_id"::text AS "unit_id", u."name" AS "unit_name",
       ev."start_time", ev."end_time", ev."duration_seconds"::text AS "seconds",
       ev."from_product_id"::text AS "from_product_id", fp."code" AS "from_product",
       ev."to_product_id"::text AS "to_product_id", tp."code" AS "to_product",
       ev."catalyst_family", ev."operating_mode", st."id"::text AS "standard_id",
       st."reference_seconds"::text AS "reference_seconds", st."reference_offgrade_qty"::text AS "reference_offgrade",
       agg."uom", agg."allowance_loss", agg."excess_loss", agg."off_grade", agg."no_standard", agg."lines"
  FROM ev
  LEFT JOIN "units" u ON u."id" = ev."unit_id"
  LEFT JOIN "products" fp ON fp."id" = ev."from_product_id" AND fp."tenant_id" = $1
  LEFT JOIN "products" tp ON tp."id" = ev."to_product_id" AND tp."tenant_id" = $1
  LEFT JOIN LATERAL (
    SELECT max(ln."uom") AS "uom", count(*)::int AS "lines",
           (sum(ln."quantity") FILTER (WHERE ln."kind" = 'transition_allowance'))::text AS "allowance_loss",
           (sum(ln."quantity") FILTER (WHERE ln."kind" = 'transition_excess'))::text AS "excess_loss",
           (sum(ln."quantity") FILTER (WHERE ln."flags" ? 'quality_class:transition_off_grade'))::text AS "off_grade",
           bool_or(ln."flags" ? 'no_transition_standard') AS "no_standard",
           (SELECT substr(f, 21) FROM ln x, jsonb_array_elements_text(x."flags") f
             WHERE x."cause_event_id" = ev."id" AND f LIKE 'transition_standard:%' LIMIT 1) AS "standard_id"
      FROM ln WHERE ln."cause_event_id" = ev."id") agg ON true
  LEFT JOIN "transition_standards" st ON st."id"::text = agg."standard_id" AND st."tenant_id" = $1
 ORDER BY ev."start_time" DESC, ev."id"`;

const dec = (value: string | null) =>
  value === null ? null : formatDec(new Dec(value));

function excessOf(seconds: string | null, reference: string | null) {
  const actual = toDec(seconds);
  const standard = toDec(reference);
  return actual === null || standard === null
    ? null
    : formatDec(actual.minus(standard));
}

export function toTransitionRow(r: TransitionRow): TransitionRowView {
  return {
    eventId: r.event_id,
    unitId: r.unit_id,
    unitName: r.unit_name,
    start: r.start_time.toISOString(),
    end: r.end_time?.toISOString() ?? null,
    seconds: dec(r.seconds),
    fromProductId: r.from_product_id,
    fromProduct: r.from_product,
    toProductId: r.to_product_id,
    toProduct: r.to_product,
    catalystFamily: r.catalyst_family,
    operatingMode: r.operating_mode,
    standardId: r.standard_id,
    referenceSeconds: dec(r.reference_seconds),
    referenceOffgrade: dec(r.reference_offgrade),
    excessSeconds: excessOf(r.seconds, r.reference_seconds),
    uom: r.uom,
    allowanceLoss: dec(r.allowance_loss),
    excessLoss: dec(r.excess_loss),
    offGrade: dec(r.off_grade),
    noStandard: r.no_standard === true,
    calculated: r.lines > 0,
  };
}

/**
 * `GET /reports/transition-performance` (R5): each grade transition of the window with the standard the
 * calculation applied, its duration against the standard's reference, and its loss within and over the
 * allowance; then per product change the count, mean and worst duration and the mean excess.
 */
export async function transitionPerformance(
  manager: EntityManager,
  scope: ReportScope,
): Promise<TransitionPerformanceView> {
  const rows = await manager.query<TransitionRow[]>(SQL, [
    ...params(scope),
    TRANSITION_LIMIT + 1,
  ]);
  const transitions = rows.slice(0, TRANSITION_LIMIT).map(toTransitionRow);
  return {
    transitions,
    truncated: rows.length > TRANSITION_LIMIT,
    pairs: summarizeTransitions(transitions),
  };
}
