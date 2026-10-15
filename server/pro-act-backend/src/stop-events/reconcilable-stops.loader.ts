import { EntityManager } from 'typeorm';
import { SourceKind } from '../domain/events/event-classification';
import {
  CauseValues,
  ReconcilableStop,
} from '../domain/events/stop-reconciliation';
import { UnitScope } from './derived-stop-writer';

/** Upper bound of stops one reconciliation reads (one unit, a bounded window). */
const MAX_STOPS = 5000;

/**
 * Live downtime events of the unit overlapping the window (`IDX_production_events_unit_span`: unit + span
 * of live events), with the cause fields a duplicate can contribute.
 */
const STOPS_SQL = `SELECT e."id", e."unit_id", e."asset_id", e."source_kind", e."start_time", e."end_time", e."created_at",
       e."reason_code_id", e."impact_code_id", e."oee_code_id", e."origin_unit_id", e."origin_asset_id",
       e."failure_mode", e."failure_severity", e."maintainable_item", e."failure_mechanism", e."failure_cause",
       e."detection_method", e."work_order_id"
  FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2 AND e."physical_type" = 'downtime'
   AND e."physical_state" IN ('open', 'closed')
   AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')
 ORDER BY e."start_time", e."id" LIMIT ${MAX_STOPS}`;

interface StopRow {
  id: string;
  unit_id: string;
  asset_id: string | null;
  source_kind: SourceKind;
  start_time: Date;
  end_time: Date | null;
  created_at: Date;
  reason_code_id: string | null;
  impact_code_id: string | null;
  oee_code_id: string | null;
  origin_unit_id: string | null;
  origin_asset_id: string | null;
  failure_mode: string | null;
  failure_severity: string | null;
  maintainable_item: string | null;
  failure_mechanism: string | null;
  failure_cause: string | null;
  detection_method: string | null;
  work_order_id: string | null;
}

const causeOf = (row: StopRow): CauseValues => ({
  reasonCodeId: row.reason_code_id,
  impactCodeId: row.impact_code_id,
  oeeCodeId: row.oee_code_id,
  originUnitId: row.origin_unit_id,
  originAssetId: row.origin_asset_id,
  failureMode: row.failure_mode,
  failureSeverity: row.failure_severity,
  maintainableItem: row.maintainable_item,
  failureMechanism: row.failure_mechanism,
  failureCause: row.failure_cause,
  detectionMethod: row.detection_method,
  workOrderId: row.work_order_id,
});

export async function loadReconcilableStops(
  manager: EntityManager,
  scope: UnitScope,
  window: { start: Date; end: Date },
): Promise<ReconcilableStop[]> {
  const rows = await manager.query<StopRow[]>(STOPS_SQL, [
    scope.tenantId,
    scope.unitId,
    window.start,
    window.end,
  ]);
  return rows.map((row) => ({
    id: row.id,
    unitId: row.unit_id,
    assetId: row.asset_id,
    sourceKind: row.source_kind,
    start: new Date(row.start_time),
    end: row.end_time ? new Date(row.end_time) : null,
    createdAt: new Date(row.created_at),
    cause: causeOf(row),
  }));
}
