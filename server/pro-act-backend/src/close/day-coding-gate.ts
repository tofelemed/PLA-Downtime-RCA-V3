import { EntityManager } from 'typeorm';
import { Dec, toDec } from '../domain/actuals/decimal';
import {
  CodedRatio,
  codingGate,
  CodingGateResult,
} from '../domain/reconciliation/coding-gate';
import { policyBodiesInForce } from '../periods/policy-bodies-in-force';
import {
  dayGateOf,
  reconciliationOptions,
} from '../periods/reconciliation-options';
import { stopCodingCounts } from '../reconciliation/coding-gate.loader';
import { DayPeriodRow } from './day-periods';

/**
 * Σ coded / Σ stopped seconds of the period-level `coded_downtime_ratio` of the runs the day's shift
 * revisions show (each shift measured its own part of a stop, so the sums are the day's). Uses
 * IDX_accounting_revisions_current_run and the kpi_results run index.
 */
const DAY_RATIO_SQL = `SELECT sum(k."numerator") AS "coded", sum(k."denominator") AS "stopped"
  FROM "accounting_revisions" r
  JOIN "kpi_results" k ON k."tenant_id" = r."tenant_id" AND k."run_id" = r."current_run_id"
 WHERE r."tenant_id" = $1 AND r."id" = ANY($2::uuid[])
   AND k."metric" = 'coded_downtime_ratio' AND k."scope"->>'level' = 'period'`;

async function dayRatio(
  manager: EntityManager,
  tenantId: string,
  revisionIds: string[],
): Promise<CodedRatio> {
  if (revisionIds.length === 0) {
    return { value: null, codedSeconds: null, stoppedSeconds: null };
  }
  const [row]: Array<{
    coded: string | number | null;
    stopped: string | number | null;
  }> = await manager.query(DAY_RATIO_SQL, [tenantId, revisionIds]);
  const coded = toDec(row?.coded ?? null);
  const stopped = toDec(row?.stopped ?? null);
  const value: Dec | null =
    coded !== null && stopped !== null && stopped.gt(0)
      ? coded.div(stopped).toDecimalPlaces(8)
      : null;
  return { value, codedSeconds: coded, stoppedSeconds: stopped };
}

async function dayGatePolicy(
  manager: EntityManager,
  key: { tenantId: string; unitId: string; at: Date },
) {
  const [body] = await policyBodiesInForce(
    manager,
    'reconciliation_tolerance',
    [key],
  );
  const options =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? reconciliationOptions(body as Record<string, unknown>)
      : {};
  return dayGateOf(options);
}

/**
 * SME D12 daily target of a production day (pilot 99 % by daily approval): every stop overlapping the
 * day's shift periods has a reason or "investigation pending", and the coded share of the day's stopped
 * time reaches `dayGate.codedRatioTarget` of the `reconciliation_tolerance`
 * version in force for the unit at the day's first period (absent option: `warn` at 99 %). The count and
 * the ratio cover the same shifts (Marun regression R2): the ratio sums the current run of every shift's
 * latest revision, whatever its workflow (a shift in review counts as its run shows it). Once every shift
 * is approved — the certification case — that is the approved runs, as before. Null = the day has no
 * period.
 */
export async function loadDayCodingGate(
  manager: EntityManager,
  key: { tenantId: string; unitId: string },
  periods: readonly DayPeriodRow[],
): Promise<CodingGateResult | null> {
  if (periods.length === 0) return null;
  const from = new Date(Math.min(...periods.map((p) => p.utcStart.getTime())));
  const to = new Date(Math.max(...periods.map((p) => p.utcEnd.getTime())));
  const revisions = periods.flatMap((p) =>
    p.revisionId ? [p.revisionId] : [],
  );
  const counts = await stopCodingCounts(manager, { ...key, from, to });
  const ratio = await dayRatio(manager, key.tenantId, revisions);
  const policy = await dayGatePolicy(manager, { ...key, at: from });
  return codingGate(counts, ratio, policy);
}
