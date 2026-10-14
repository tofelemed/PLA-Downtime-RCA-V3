import { EntityManager } from 'typeorm';
import { FailureSpan } from '../domain/kpi/reliability';
import {
  repairEvidence,
  RepairOperation,
} from '../domain/reliability/repair-evidence';

/** CMMS operations linked to the stops of the failures (index tenant + event). */
const OPERATIONS_SQL = `SELECT e."occurrence_id", o."operation_kind", o."started_at", o."ended_at", o."waiting_seconds"
  FROM "work_order_operations" o
  JOIN "production_events" e ON e."id" = o."event_id" AND e."tenant_id" = $1::varchar
 WHERE o."tenant_id" = $1::uuid AND e."occurrence_id" = ANY($2::uuid[])
 ORDER BY e."occurrence_id", o."started_at", o."id"`;

interface OperationRow {
  occurrence_id: string;
  operation_kind: RepairOperation['kind'];
  started_at: Date;
  ended_at: Date | null;
  waiting_seconds: number;
}

/**
 * SME D10: the failures with their active-repair evidence from the CMMS operations linked to their stops
 * (first / last operation and active seconds). A failure without linked operations, or with one still
 * open, keeps no evidence — the KPI then names the restore time, never a repair time.
 */
export async function withRepairEvidence(
  manager: EntityManager,
  tenantId: string,
  failures: FailureSpan[],
): Promise<FailureSpan[]> {
  if (failures.length === 0) return failures;
  const rows: OperationRow[] = await manager.query(OPERATIONS_SQL, [
    tenantId,
    failures.map((f) => f.occurrenceId),
  ]);
  if (rows.length === 0) return failures;
  return failures.map((failure) => {
    const evidence = repairEvidence(
      rows
        .filter((r) => r.occurrence_id === failure.occurrenceId)
        .map((r) => ({
          kind: r.operation_kind,
          start: new Date(r.started_at),
          end: r.ended_at ? new Date(r.ended_at) : null,
          waitingSeconds: r.waiting_seconds,
        })),
    );
    return evidence ? { ...failure, ...evidence } : failure;
  });
}
