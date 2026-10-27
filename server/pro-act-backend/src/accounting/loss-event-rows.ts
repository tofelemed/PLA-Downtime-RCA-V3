import { parseDeclaredFigures } from '../domain/events/declared-figures';
import { storedReasonWeights } from '../domain/events/reason-weights';
import {
  GradeChange,
  LossEvent,
  LossEventType,
} from '../domain/accounting/accounting.types';

export interface EventRow {
  id: string;
  unit_id: string;
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
  /** D-T5 weighted reasons (jsonb) */
  reason_weights: unknown;
  impact_code_id: string | null;
  failure_mode: string | null;
  asset_id: string | null;
  planned_end_time: Date | null;
  from_product_id: string | null;
  to_product_id: string | null;
  catalyst_family: string | null;
  operating_mode: string | null;
  stream_code: string | null;
  recovery_of_event_id: string | null;
  failure_severity: string | null;
  disposition_class: string | null;
  asset_type: string | null;
  reason_code: string | null;
  /** declared mode: the OT figures of a production loss (jsonb); null for every other event */
  declared_figures: unknown;
  investigation_pending: boolean;
  row_version: number;
  revision_id: string | null;
  revision: number | null;
}

/** Columns of a loss event with its asset type, reason code and latest revision. */
const EVENT_SELECT = `SELECT e."id", e."unit_id", e."occurrence_id", e."physical_type", e."start_time", e."end_time", e."schedule_class",
       e."oee_component", e."impact_mode", e."impact_fraction"::text AS "impact_fraction", e."quantity"::text AS "quantity",
       e."reason_code_id", e."reason_weights", e."impact_code_id", e."failure_mode", e."asset_id", e."planned_end_time", e."row_version",
       e."from_product_id", e."to_product_id", e."catalyst_family", e."operating_mode", e."stream_code", e."recovery_of_event_id",
       e."failure_severity", e."disposition_class", a."asset_type", rc."code" AS "reason_code",
       e."declared_figures", e."investigation_pending",
       r."id" AS "revision_id", r."revision"
  FROM "production_events" e
  LEFT JOIN "assets" a ON a."id" = e."asset_id"
  LEFT JOIN "reason_codes" rc ON rc."id" = e."reason_code_id"
  LEFT JOIN LATERAL (SELECT er."id", er."revision" FROM "event_revisions" er WHERE er."event_id" = e."id"
                      ORDER BY er."revision" DESC LIMIT 1) r ON true`;

export const EVENTS_SQL = `${EVENT_SELECT}
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2
   AND e."physical_type" IN ('downtime', 'slowdown', 'quality_loss', 'grade_transition') AND e."physical_state" IN ('open', 'closed')
   AND tstzrange(e."start_time", e."end_time", '[)') && tstzrange($3, $4, '[)')
 ORDER BY e."start_time", e."id"`;

/**
 * Declared mode: the unit's production loss events overlapping ($3, $4), live and not retracted. The
 * `declared_figures IS NOT NULL AND retracted_at IS NULL` predicate matches the partial index
 * `IDX_production_events_declared` (tenant, unit, start_time).
 */
export const DECLARED_EVENTS_SQL = `${EVENT_SELECT}
 WHERE e."tenant_id" = $1 AND e."unit_id" = $2
   AND e."declared_figures" IS NOT NULL AND e."retracted_at" IS NULL
   AND e."physical_type" = 'production_loss' AND e."physical_state" IN ('open', 'closed')
   AND e."start_time" < $4 AND (e."end_time" IS NULL OR e."end_time" > $3)
 ORDER BY e."start_time", e."id"`;

/** Loss event rows of both queries in one order (start, id), as the engine and the fingerprint read them. */
export function byStartThenId(a: EventRow, b: EventRow): number {
  const diff =
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
  if (diff !== 0) return diff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * SME E2: stopping downtime of upstream units ($2 unit ids) overlapping ($3, $4) — the supply outages a
 * buffer may cover (no-impact and partial events never stop supply, SME Q5).
 */
export const UPSTREAM_STOPS_SQL = `${EVENT_SELECT}
 WHERE e."tenant_id" = $1 AND e."unit_id" = ANY($2::uuid[])
   AND e."physical_type" = 'downtime' AND e."physical_state" IN ('open', 'closed')
   AND e."impact_mode" NOT IN ('none', 'fractional')
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
    reasonWeights: storedReasonWeights(row.reason_weights),
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
    streamId: row.stream_code,
    ...(row.declared_figures
      ? {
          declaredFigures: parseDeclaredFigures(row.declared_figures),
          investigationPending: row.investigation_pending,
        }
      : {}),
  };
}
