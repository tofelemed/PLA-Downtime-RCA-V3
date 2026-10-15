import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { periodScopeUnits } from '../../periods/period-scope';
import { requestRecalculation } from '../../periods/period-recalc';

/**
 * Time of a unit a reliability input change touches; `end` null = still open (up to now), `OPEN_ENDED` =
 * from `start` on, future periods included (a new mapping version or standby duty).
 */
export interface AffectedSpan {
  unitId: string;
  start: Date;
  end: Date | null;
}

export interface UnitWindow {
  unitId: string;
  from: Date;
  /** null = up to now */
  to: Date | null;
}

/** One window per unit, earliest start to latest end; any open span makes it run up to now. */
export function windowsByUnit(spans: readonly AffectedSpan[]): UnitWindow[] {
  const byUnit = new Map<string, UnitWindow>();
  for (const span of spans) {
    const known = byUnit.get(span.unitId);
    if (!known) {
      byUnit.set(span.unitId, { unitId: span.unitId, ...windowOf(span) });
      continue;
    }
    if (span.start < known.from) known.from = span.start;
    if (known.to && (!span.end || span.end > known.to)) known.to = span.end;
  }
  return [...byUnit.values()].sort((a, b) => a.unitId.localeCompare(b.unitId));
}

const windowOf = (span: AffectedSpan) => ({ from: span.start, to: span.end });

/**
 * Reliability inputs the KPI engine reads (CMMS operations, standby logs and duties, state mappings) queue
 * a recalculation of the affected unit and window with the change (FND02 outbox →
 * `PeriodRecalculateRequested` → one collapsed recompute job per period). Idempotent: the inbox consumes
 * each message once, queued jobs of a period collapse, and an unchanged input hash keeps the current run.
 */
export async function requestReliabilityRecalc(
  manager: EntityManager,
  context: RequestContext,
  spans: readonly AffectedSpan[],
  reason: string,
): Promise<void> {
  const tenantId = requireTenantId(context);
  for (const window of windowsByUnit(spans)) {
    await requestRecalculation(manager, {
      tenantId,
      unitIds: [window.unitId],
      from: window.from,
      to: window.to,
      reason,
      scopeUnitIds: periodScopeUnits(context),
      requestedBy: context.userId,
    });
  }
}

/** Full extent of the stop occurrences of the given events (all their events), per unit. */
export async function occurrenceSpans(
  manager: EntityManager,
  tenantId: string,
  eventIds: readonly string[],
): Promise<AffectedSpan[]> {
  if (eventIds.length === 0) return [];
  const rows = await manager.query<
    Array<{ unit_id: string; start_time: Date; end_time: Date | null }>
  >(
    `SELECT e."unit_id", min(e."start_time") AS "start_time",
            CASE WHEN bool_or(e."end_time" IS NULL) THEN NULL ELSE max(e."end_time") END AS "end_time"
       FROM "production_events" e
      WHERE e."tenant_id" = $1 AND e."occurrence_id" IN (
            SELECT s."occurrence_id" FROM "production_events" s
             WHERE s."tenant_id" = $1 AND s."id" = ANY($2::uuid[]))
      GROUP BY e."occurrence_id", e."unit_id"`,
    [tenantId, [...new Set(eventIds)]],
  );
  return rows.map((r) => ({
    unitId: r.unit_id,
    start: new Date(r.start_time),
    end: r.end_time ? new Date(r.end_time) : null,
  }));
}
