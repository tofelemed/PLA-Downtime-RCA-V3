import { EntityManager } from 'typeorm';
import { Dec, formatDec, toDec } from '../../domain/actuals/decimal';
import { planCoveredSql } from '../../close/plan-coverage-sql';
import { params, SHOWN } from './report-sql';
import { ReportScope } from './report-scope';

/**
 * What the window's figures stand on (owner decision 2026-10-19 "Unknown time is never available time"):
 * the state data coverage of the shown runs (Σ known ÷ Σ scheduled seconds of the `state_coverage` rows) and
 * the periods no approved plan covers ("No approved plan covers this period"). Read-only, summed in SQL.
 */
export interface DataCoverageView {
  /** shown periods with a state coverage row (0 = no state mapping: availability is not adjusted) */
  periodsWithStateData: number;
  scheduledSeconds: string | null;
  knownSeconds: string | null;
  /** unknown state seconds taken out of scheduled / available time and MTBF exposure */
  unknownSeconds: string | null;
  /** known ÷ scheduled, 0..1 decimal string; null without scheduled time */
  ratio: string | null;
  /** periods of the window (calculated or not) that no approved plan covers */
  periodsWithoutPlan: number;
}

interface CoverageRow {
  rows: number;
  known: string | null;
  scheduled: string | null;
  unknown: string | null;
  without_plan: number;
}

const COVERAGE_SQL = `${SHOWN}
  SELECT count(k."id")::int AS "rows",
         sum(k."numerator")::text AS "known",
         sum(k."denominator")::text AS "scheduled",
         sum(GREATEST(COALESCE((k."cohort"->>'unknownSeconds')::numeric, 0), 0))::text AS "unknown",
         count(*) FILTER (WHERE NOT ${planCoveredSql('p')})::int AS "without_plan"
    FROM shown s
    JOIN "production_periods" p ON p."id" = s."period_id"
    LEFT JOIN "kpi_results" k ON k."run_id" = s."run_id" AND k."tenant_id" = $1
                             AND k."metric" = 'state_coverage' AND k."scope"->>'level' = 'period'`;

const text = (value: Dec | null) => (value === null ? null : formatDec(value));

export async function dataCoverage(
  manager: EntityManager,
  scope: ReportScope,
): Promise<DataCoverageView> {
  const [row]: CoverageRow[] = await manager.query(COVERAGE_SQL, params(scope));
  const known = toDec(row?.known ?? null);
  const scheduled = toDec(row?.scheduled ?? null);
  const ratio =
    known !== null && scheduled !== null && scheduled.gt(0)
      ? known.div(scheduled).toDecimalPlaces(10).toFixed()
      : null;
  return {
    periodsWithStateData: row?.rows ?? 0,
    scheduledSeconds: text(scheduled),
    knownSeconds: text(known),
    unknownSeconds: text(toDec(row?.unknown ?? null)),
    ratio,
    periodsWithoutPlan: row?.without_plan ?? 0,
  };
}
