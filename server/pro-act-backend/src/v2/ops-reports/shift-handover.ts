import { EntityManager } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { AnalyticsResponse } from '../common/response';
import { resolveReportScope, ReportScope } from '../reports/report-scope';
import { eventStatus, EventStatusRowView } from './event-status';
import { ShiftHandoverQueryDto } from './ops-reports-v2.dto';
import {
  productionByProduct,
  ProductionRowView,
} from './production-by-product';
import { handoverEvents, HandoverEventView } from './shift-handover-events';
import { shiftNotes, ShiftNoteView } from './shift-notes';

export interface ShiftInstanceView {
  unitId: string;
  unitName: string | null;
  crewName: string | null;
  from: string;
  to: string;
  excluded: boolean;
}

export interface ShiftHandoverView {
  localDate: string;
  shiftName: string;
  /** the shift on the units: earliest start and latest end; null when no unit has this shift */
  from: string | null;
  to: string | null;
  instances: ShiftInstanceView[];
  production: ProductionRowView[];
  eventStatus: EventStatusRowView[];
  /** loss events overlapping the shift (also those still running), oldest first */
  events: HandoverEventView[];
  eventsTruncated: boolean;
  notes: ShiftNoteView[];
  calculationRunIds: string[];
}

interface InstanceRow {
  unit_id: string;
  unit_name: string | null;
  crew_name: string | null;
  utc_start: Date;
  utc_end: Date;
  is_excluded: boolean;
}

const DAY_MS = 86_400_000;

async function instancesOf(
  manager: EntityManager,
  scope: ReportScope,
  query: ShiftHandoverQueryDto,
): Promise<InstanceRow[]> {
  return manager.query(
    `SELECT si."unit_id"::text AS "unit_id", u."name" AS "unit_name", c."name" AS "crew_name",
            si."utc_start", si."utc_end", si."is_excluded"
       FROM "shift_instances" si
       LEFT JOIN "units" u ON u."id" = si."unit_id"
       LEFT JOIN "crews" c ON c."id" = si."crew_id"
      WHERE si."tenant_id" = $1 AND si."unit_id" = ANY($2::uuid[]) AND si."local_date" = $3::date
        AND si."shift_name" = $4
      ORDER BY u."name", si."unit_id"`,
    [scope.tenantId, scope.unitIds, query.localDate, query.shiftName],
  );
}

const toInstance = (r: InstanceRow): ShiftInstanceView => ({
  unitId: r.unit_id,
  unitName: r.unit_name,
  crewName: r.crew_name,
  from: r.utc_start.toISOString(),
  to: r.utc_end.toISOString(),
  excluded: r.is_excluded,
});

/** The units the caller may read for this request (the window only satisfies the scope check). */
function unitScope(
  manager: EntityManager,
  context: RequestContext,
  query: ShiftHandoverQueryDto,
): Promise<ReportScope> {
  const day = Date.parse(`${query.localDate}T00:00:00Z`);
  return resolveReportScope(manager, context, {
    from: new Date(day - DAY_MS).toISOString(),
    to: new Date(day + 2 * DAY_MS).toISOString(),
    unitIds: query.unitIds,
  });
}

/** Earliest start and latest end of the shift's instances. */
function shiftWindow(rows: InstanceRow[]): { from: Date; to: Date } {
  return {
    from: new Date(Math.min(...rows.map((r) => r.utc_start.getTime()))),
    to: new Date(Math.max(...rows.map((r) => r.utc_end.getTime()))),
  };
}

/**
 * `GET /reports/shift-handover` (R2): one shift of the plant calendar on the caller's units — the output of
 * its periods per product (shown runs), its loss events and their coding, and the handover notes. The
 * shift's window comes from the stored shift instances; when no unit has the shift, only notes are read.
 */
export async function shiftHandover(
  manager: EntityManager,
  context: RequestContext,
  query: ShiftHandoverQueryDto,
): Promise<AnalyticsResponse<ShiftHandoverView>> {
  const units = await unitScope(manager, context, query);
  const rows = await instancesOf(manager, units, query);
  const window = rows.length
    ? shiftWindow(rows)
    : { from: units.from, to: units.from };
  const scope: ReportScope = {
    ...units,
    ...window,
    selection: { shiftNames: [query.shiftName] },
  };
  const shifted = rows.length > 0;
  const [production, status, events, notes] = await Promise.all([
    productionByProduct(manager, scope, 'total'),
    shifted ? eventStatus(manager, scope) : { rows: [] },
    shifted ? handoverEvents(manager, scope) : { events: [], truncated: false },
    shiftNotes(manager, {
      ...query,
      tenantId: units.tenantId,
      unitIds: units.unitIds,
    }),
  ]);
  return {
    ...production,
    data: {
      localDate: query.localDate,
      shiftName: query.shiftName,
      from: shifted ? window.from.toISOString() : null,
      to: shifted ? window.to.toISOString() : null,
      instances: rows.map(toInstance),
      production: production.data.rows,
      eventStatus: status.rows,
      events: events.events,
      eventsTruncated: events.truncated,
      notes,
      calculationRunIds: production.data.calculationRunIds,
    },
  };
}
