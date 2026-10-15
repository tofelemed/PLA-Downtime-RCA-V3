import {
  GradeChange,
  LossEvent,
  LossEventType,
} from '../domain/accounting/accounting.types';

export interface EventRow {
  id: string;
  occurrence_id: string;
  physical_type: LossEventType;
  start_time: Date;
  end_time: Date | null;
  schedule_class: string;
  oee_component: string;
  impact_mode: string;
  impact_fraction: string | null;
  quantity: string | null;
  reason_code_id: string | null;
  impact_code_id: string | null;
  failure_mode: string | null;
  asset_id: string | null;
  planned_end_time: Date | null;
  from_product_id: string | null;
  to_product_id: string | null;
  catalyst_family: string | null;
  operating_mode: string | null;
  recovery_of_event_id: string | null;
  failure_severity: string | null;
  disposition_class: string | null;
  asset_type: string | null;
  reason_code: string | null;
  row_version: number;
  revision_id: string | null;
  revision: number | null;
}

export const EVENTS_SQL = `SELECT e."id", e."occurrence_id", e."physical_type", e."start_time", e."end_time", e."schedule_class",
       e."oee_component", e."impact_mode", e."impact_fraction"::text AS "impact_fraction", e."quantity"::text AS "quantity",
       e."reason_code_id", e."impact_code_id", e."failure_mode", e."asset_id", e."planned_end_time", e."row_version",
       e."from_product_id", e."to_product_id", e."catalyst_family", e."operating_mode", e."recovery_of_event_id",
       e."failure_severity", e."disposition_class", a."asset_type", rc."code" AS "reason_code",
       r."id" AS "revision_id", r."revision"
  FROM "production_events" e
  LEFT JOIN "assets" a ON a."id" = e."asset_id"
  LEFT JOIN "reason_codes" rc ON rc."id" = e."reason_code_id"
  LEFT JOIN LATERAL (SELECT er."id", er."revision" FROM "event_revisions" er WHERE er."event_id" = e."id"
                      ORDER BY er."revision" DESC LIMIT 1) r ON true
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2
   AND e."physical_type" IN ('downtime', 'slowdown', 'quality_loss', 'grade_transition') AND e."physical_state" IN ('open', 'closed')
   AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')
 ORDER BY e."start_time", e."id"`;

function gradeChangeOf(
  row: EventRow,
  contextModes: ReadonlyMap<string, string>,
): GradeChange | null {
  if (!row.from_product_id || !row.to_product_id) return null;
  return {
    fromProductId: row.from_product_id,
    toProductId: row.to_product_id,
    catalystFamily: row.catalyst_family,
    operatingMode:
      row.operating_mode ?? contextModes.get(row.to_product_id) ?? null,
  };
}

/**
 * A loss event from its row. SME E1: a grade change carries the event's catalyst family and operating
 * mode; without a recorded mode, the production context's (the to-product's profile mode) applies.
 */
export function toEvent(
  row: EventRow,
  contextModes: ReadonlyMap<string, string> = new Map(),
): LossEvent {
  return {
    eventId: row.id,
    revisionId: row.revision_id,
    revision: row.revision,
    occurrenceId: row.occurrence_id,
    physicalType: row.physical_type,
    start: new Date(row.start_time),
    end: row.end_time ? new Date(row.end_time) : null,
    scheduleClass: row.schedule_class,
    oeeComponent: row.oee_component,
    impactMode: row.impact_mode,
    impactFraction: row.impact_fraction,
    quantity: row.quantity,
    reasonCodeId: row.reason_code_id,
    impactCodeId: row.impact_code_id,
    failureMode: row.failure_mode,
    assetId: row.asset_id,
    plannedEnd: row.planned_end_time ? new Date(row.planned_end_time) : null,
    transition: gradeChangeOf(row, contextModes),
    recoveryOfEventId: row.recovery_of_event_id,
    assetClass: row.asset_type,
    reasonCode: row.reason_code,
    failureSeverity: row.failure_severity,
    dispositionClass: row.disposition_class,
  };
}
