import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { toDec } from '../domain/actuals/decimal';
import {
  CodedRatio,
  codingGate,
  CodingGateResult,
  StopCodingCounts,
} from '../domain/reconciliation/coding-gate';
import { submitGateOf } from '../periods/reconciliation-options';
import { RevisionState } from './revision-state';

const FAILURE_DETAIL = `(e."failure_mode" IS NOT NULL OR e."failure_severity" IS NOT NULL OR e."maintainable_item" IS NOT NULL
        OR e."failure_mechanism" IS NOT NULL OR e."failure_cause" IS NOT NULL)`;

/**
 * Stopping downtime overlapping the period (the stops `coded_downtime_ratio` measures: no `none` /
 * `fractional` impact), by coding. Uses IDX_production_events_unit_span.
 */
const COUNTS_SQL = `SELECT count(*)::int AS "stops",
       count(*) FILTER (WHERE e."reason_code_id" IS NOT NULL)::int AS "coded",
       count(*) FILTER (WHERE e."reason_code_id" IS NULL AND e."investigation_pending")::int AS "pending",
       count(*) FILTER (WHERE e."verified_at" IS NOT NULL)::int AS "verified",
       count(*) FILTER (WHERE ${FAILURE_DETAIL})::int AS "failure_detailed",
       count(*) FILTER (WHERE ${FAILURE_DETAIL} AND e."validated_at" IS NOT NULL)::int AS "validated"
  FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2 AND e."physical_type" = 'downtime'
   AND e."physical_state" IN ('open', 'closed') AND e."impact_mode" NOT IN ('none', 'fractional')
   AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')`;

/** The period-level `coded_downtime_ratio` of the run (the KPI shown on the downtime screens). */
const RATIO_SQL = `SELECT k."value", k."numerator", k."denominator" FROM "kpi_results" k
 WHERE k."tenant_id" = $1 AND k."run_id" = $2 AND k."metric" = 'coded_downtime_ratio'
   AND k."scope"->>'level' = 'period'
 LIMIT 1`;

async function countsOf(
  manager: EntityManager,
  state: RevisionState,
): Promise<StopCodingCounts> {
  const { period } = state;
  const [row]: Array<{
    stops: number;
    coded: number;
    pending: number;
    verified: number;
    failure_detailed: number;
    validated: number;
  }> = await manager.query(COUNTS_SQL, [
    period.tenantId,
    period.unitId,
    period.utcStart,
    period.utcEnd,
  ]);
  return {
    stops: row?.stops ?? 0,
    coded: row?.coded ?? 0,
    investigationPending: row?.pending ?? 0,
    verified: row?.verified ?? 0,
    failureDetailed: row?.failure_detailed ?? 0,
    validated: row?.validated ?? 0,
  };
}

async function ratioOf(
  manager: EntityManager,
  state: RevisionState,
): Promise<CodedRatio> {
  if (!state.run) {
    return { value: null, codedSeconds: null, stoppedSeconds: null };
  }
  const [row]: Array<{
    value: string | null;
    numerator: string | null;
    denominator: string | null;
  }> = await manager.query(RATIO_SQL, [state.period.tenantId, state.run.id]);
  return {
    value: toDec(row?.value ?? null),
    codedSeconds: toDec(row?.numerator ?? null),
    stoppedSeconds: toDec(row?.denominator ?? null),
  };
}

/**
 * SME D12 gate of a revision's period with the `submitGate` of the tolerance policy the run used (a version
 * without the option: `warn` at 95 %). Shown on the period page; refuses a submission only in `block` mode.
 */
export async function loadCodingGate(
  manager: EntityManager,
  state: RevisionState,
): Promise<CodingGateResult> {
  const counts = await countsOf(manager, state);
  const ratio = await ratioOf(manager, state);
  return codingGate(counts, ratio, submitGateOf(state.tolerance.body));
}

/** 422 CODING_INCOMPLETE (`details.issues`) when a `block` gate fails; a `warn` gate never refuses. */
export function assertCodingGate(gate: CodingGateResult): void {
  if (gate.mode !== 'block' || gate.passes) return;
  throw new UnprocessableEntityException({
    code: 'CODING_INCOMPLETE',
    message: `stop coding is incomplete: ${gate.issues.map((i) => i.message).join('; ')}`,
    details: { issues: gate.issues, codingGate: gate },
  });
}
