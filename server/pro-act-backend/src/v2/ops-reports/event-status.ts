import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { ReportScope } from '../reports/report-scope';

/** Coding and verification state of one event type in the window (decimal strings for seconds). */
export interface EventStatusRowView {
  physicalType: string;
  events: number;
  /** still running (no end yet) */
  open: number;
  /** ended, not coded */
  uncoded: number;
  /** coded or reviewed */
  coded: number;
  /** supervisor verification of the coding (SME D13) */
  verified: number;
  /** seconds of the ended events, and of the ended uncoded ones */
  seconds: string;
  uncodedSeconds: string;
  /** end of the oldest ended uncoded event (ISO 8601), null when none */
  oldestUncodedEnd: string | null;
}

export interface EventStatusView {
  rows: EventStatusRowView[];
  asOf: string;
}

interface Row {
  physical_type: string;
  events: number;
  open: number;
  uncoded: number;
  coded: number;
  verified: number;
  seconds: string | null;
  uncoded_seconds: string | null;
  oldest_uncoded_end: Date | null;
}

const LOSS_TYPES = ['downtime', 'slowdown', 'quality_loss', 'grade_transition'];

/**
 * Live (not superseded or retracted) loss events of the units starting in [from, to): $1 tenant, $2 units,
 * $3 from, $4 to, $5 event types. Uses IDX_production_events_tenant_unit_start.
 */
const SQL = `SELECT e."physical_type"::text AS "physical_type", count(*)::int AS "events",
       count(*) FILTER (WHERE e."physical_state" = 'open')::int AS "open",
       count(*) FILTER (WHERE e."physical_state" = 'closed' AND e."coding_state" = 'uncoded')::int AS "uncoded",
       count(*) FILTER (WHERE e."coding_state" <> 'uncoded')::int AS "coded",
       count(*) FILTER (WHERE e."verified_at" IS NOT NULL)::int AS "verified",
       sum(e."duration_seconds")::text AS "seconds",
       sum(e."duration_seconds") FILTER (WHERE e."coding_state" = 'uncoded')::text AS "uncoded_seconds",
       min(e."end_time") FILTER (WHERE e."physical_state" = 'closed' AND e."coding_state" = 'uncoded') AS "oldest_uncoded_end"
  FROM "production_events" e
 WHERE e."tenant_id" = $1 AND e."unit_id" = ANY($2::uuid[]) AND e."start_time" >= $3 AND e."start_time" < $4
   AND e."physical_state" IN ('open', 'closed') AND e."physical_type"::text = ANY($5::text[])
 GROUP BY 1 ORDER BY 1`;

const seconds = (value: string | null) => formatDec(new Dec(value ?? '0'));

/**
 * `GET /reports/event-status` (R1, R2, R9): how many of the window's loss events are still running,
 * uncoded, coded and verified, with their seconds — the trust strip under the production figures.
 */
export async function eventStatus(
  manager: EntityManager,
  scope: ReportScope,
): Promise<EventStatusView> {
  const rows: Row[] = await manager.query(SQL, [
    scope.tenantId,
    scope.unitIds,
    scope.from,
    scope.to,
    LOSS_TYPES,
  ]);
  return {
    rows: rows.map((r) => ({
      physicalType: r.physical_type,
      events: r.events,
      open: r.open,
      uncoded: r.uncoded,
      coded: r.coded,
      verified: r.verified,
      seconds: seconds(r.seconds),
      uncodedSeconds: seconds(r.uncoded_seconds),
      oldestUncodedEnd: r.oldest_uncoded_end?.toISOString() ?? null,
    })),
    asOf: new Date().toISOString(),
  };
}
