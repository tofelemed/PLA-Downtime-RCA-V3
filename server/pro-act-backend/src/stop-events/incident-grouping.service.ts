import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import {
  groupIncidents,
  IncidentStop,
  StopIncident as IncidentGroup,
} from '../domain/events/stop-incidents';
import { requestRecalculation } from '../periods/period-recalc';
import { UnitScope } from './derived-stop-writer';
import { StopIncidentBreak } from './entities/stop-incident-break.entity';
import { StopIncidentMember } from './entities/stop-incident-member.entity';
import { StopIncident } from './entities/stop-incident.entity';
import { StopEventSettingsService } from './stop-event-settings.service';

/** Chains are rebuilt over the window and a day either side (a repeat chain rarely spans a day). */
const MARGIN_MS = 86_400_000;

/** A changed incident's span (null end = still open); the KPI periods it touches are recalculated. */
interface Span {
  start: Date;
  end: Date | null;
}

/**
 * Live stop occurrences of the unit touching the range with their full extent and their first event's
 * asset and reason (index tenant + unit + span).
 */
const OCCURRENCES_SQL = `SELECT DISTINCT ON (e."occurrence_id") e."occurrence_id", e."asset_id", e."reason_code_id",
       o."start_time", o."end_time"
  FROM (SELECT x."occurrence_id", min(x."start_time") AS "start_time",
               CASE WHEN bool_or(x."end_time" IS NULL) THEN NULL ELSE max(x."end_time") END AS "end_time"
          FROM "production_events" x
         WHERE x."tenant_id" = $1 AND x."unit_id" = $2 AND x."physical_type" = 'downtime'
           AND x."physical_state" IN ('open', 'closed')
           AND tstzrange(x."start_time", x."end_time", '[)') && tstzrange($3, $4, '[)')
         GROUP BY x."occurrence_id") o
  JOIN "production_events" e ON e."occurrence_id" = o."occurrence_id" AND e."tenant_id" = $1
   AND e."physical_type" = 'downtime' AND e."physical_state" IN ('open', 'closed')
 ORDER BY e."occurrence_id", e."start_time", e."id"`;

interface OccurrenceRow {
  occurrence_id: string;
  asset_id: string | null;
  reason_code_id: string | null;
  start_time: Date;
  end_time: Date | null;
}

/** Closed stopped seconds of the group's stops (S3: the stops, not the envelope; an open stop adds later). */
function closedSeconds(
  group: IncidentGroup,
  stops: ReadonlyMap<string, IncidentStop>,
): number {
  return group.occurrenceIds.reduce((total, id) => {
    const stop = stops.get(id);
    if (!stop?.end) return total;
    return total + (stop.end.getTime() - stop.start.getTime()) / 1000;
  }, 0);
}

/**
 * SME D5 incident grouping of one unit (worker, after event changes and derived writes): recomputes the
 * repeat-stop incidents over the window from the live stops, the policy's window and the people's "new
 * failure" breaks; an incident keeps its row while its first occurrence still starts a chain, members
 * follow the chains, and incidents whose chain dissolved are deleted (with their members). Idempotent.
 */
@Injectable()
export class IncidentGroupingService {
  constructor(private readonly settings: StopEventSettingsService) {}

  async regroupUnit(
    manager: EntityManager,
    scope: UnitScope,
    window: { start: Date; end: Date | null },
    now: Date,
  ): Promise<void> {
    const { settings, policyVersionId } = await this.settings.resolve(
      manager,
      scope,
      now,
    );
    const stops = await this.loadStops(manager, scope, window, now);
    const ids = stops.map((s) => s.occurrenceId);
    if (ids.length === 0) return;
    const breaks = await manager.getRepository(StopIncidentBreak).find({
      where: { tenantId: scope.tenantId, occurrenceId: In(ids) },
    });
    const groups = groupIncidents(stops, {
      windowSeconds: settings.incidentWindowSeconds,
      breaks: new Set(breaks.map((b) => b.occurrenceId)),
    });
    const byId = new Map(stops.map((s) => [s.occurrenceId, s]));
    const kept = new Set<string>();
    const changed: Span[] = [];
    for (const group of groups) {
      const { incident, written } = await this.upsert(manager, scope, group, {
        windowSeconds: settings.incidentWindowSeconds,
        policyVersionId,
        stoppedSeconds: closedSeconds(group, byId),
      });
      kept.add(incident.id);
      const moved = await this.setMembers(
        manager,
        scope.tenantId,
        incident.id,
        group.occurrenceIds,
      );
      if (written || moved)
        changed.push({ start: group.start, end: group.end });
    }
    changed.push(
      ...(await this.dropDissolved(
        manager,
        scope.tenantId,
        new Set(ids),
        kept,
      )),
    );
    await this.requestKpiRecalc(manager, scope, changed);
  }

  /** Incident membership is a KPI input (MTBF counts an incident once): recalculate the touched periods. */
  private async requestKpiRecalc(
    manager: EntityManager,
    scope: UnitScope,
    spans: readonly Span[],
  ): Promise<void> {
    if (spans.length === 0) return;
    const open = spans.some((s) => s.end === null);
    await requestRecalculation(manager, {
      tenantId: scope.tenantId,
      unitIds: [scope.unitId],
      from: new Date(Math.min(...spans.map((s) => s.start.getTime()))),
      to: open
        ? null
        : new Date(Math.max(...spans.map((s) => (s.end as Date).getTime()))),
      reason: 'stop_incidents_changed',
      scopeUnitIds: null,
      requestedBy: null,
    });
  }

  private async loadStops(
    manager: EntityManager,
    scope: UnitScope,
    window: { start: Date; end: Date | null },
    now: Date,
  ): Promise<IncidentStop[]> {
    const rows = await manager.query<OccurrenceRow[]>(OCCURRENCES_SQL, [
      scope.tenantId,
      scope.unitId,
      new Date(window.start.getTime() - MARGIN_MS),
      new Date((window.end ?? now).getTime() + MARGIN_MS),
    ]);
    return rows.map((row) => ({
      occurrenceId: row.occurrence_id,
      unitId: scope.unitId,
      assetId: row.asset_id,
      reasonCodeId: row.reason_code_id,
      start: new Date(row.start_time),
      end: row.end_time ? new Date(row.end_time) : null,
    }));
  }

  private async upsert(
    manager: EntityManager,
    scope: UnitScope,
    group: IncidentGroup,
    extra: {
      windowSeconds: number;
      policyVersionId: string | null;
      stoppedSeconds: number;
    },
  ): Promise<{ incident: StopIncident; written: boolean }> {
    const repository = manager.getRepository(StopIncident);
    const existing = await repository.findOneBy({
      tenantId: scope.tenantId,
      firstOccurrenceId: group.firstOccurrenceId,
    });
    const values: Partial<StopIncident> = {
      tenantId: scope.tenantId,
      unitId: scope.unitId,
      assetId: group.assetId,
      reasonCodeId: group.reasonCodeId,
      firstOccurrenceId: group.firstOccurrenceId,
      startTime: group.start,
      endTime: group.end,
      stopCount: group.occurrenceIds.length,
      ...extra,
    };
    if (existing && sameIncident(existing, values)) {
      return { incident: existing, written: false };
    }
    const incident = await repository.save(
      existing ? repository.merge(existing, values) : repository.create(values),
    );
    return { incident, written: true };
  }

  /** Members of the incident = the chain's occurrences (an occurrence moves from another incident). */
  private async setMembers(
    manager: EntityManager,
    tenantId: string,
    incidentId: string,
    occurrenceIds: readonly string[],
  ): Promise<boolean> {
    const repository = manager.getRepository(StopIncidentMember);
    const current = await repository.find({
      where: [
        { tenantId, incidentId },
        { tenantId, occurrenceId: In([...occurrenceIds]) },
      ],
    });
    const wanted = new Set(occurrenceIds);
    const stale = current.filter(
      (m) => m.incidentId !== incidentId || !wanted.has(m.occurrenceId),
    );
    if (stale.length > 0)
      await repository.delete({ id: In(stale.map((m) => m.id)) });
    const present = new Set(
      current
        .filter((m) => m.incidentId === incidentId)
        .map((m) => m.occurrenceId),
    );
    const missing = occurrenceIds.filter((id) => !present.has(id));
    if (missing.length > 0) {
      await repository.insert(
        missing.map((occurrenceId) => ({ tenantId, incidentId, occurrenceId })),
      );
    }
    return stale.length > 0 || missing.length > 0;
  }

  /** Incidents of the loaded occurrences that no chain kept (all their members were loaded). */
  private async dropDissolved(
    manager: EntityManager,
    tenantId: string,
    loaded: ReadonlySet<string>,
    kept: ReadonlySet<string>,
  ): Promise<Span[]> {
    const members = await manager.getRepository(StopIncidentMember).find({
      where: { tenantId, occurrenceId: In([...loaded]) },
    });
    const touched = [...new Set(members.map((m) => m.incidentId))].filter(
      (id) => !kept.has(id),
    );
    if (touched.length === 0) return [];
    const all = await manager.getRepository(StopIncidentMember).find({
      where: { tenantId, incidentId: In(touched) },
    });
    const outside = new Set(
      all.filter((m) => !loaded.has(m.occurrenceId)).map((m) => m.incidentId),
    );
    const dissolved = touched.filter((id) => !outside.has(id));
    if (dissolved.length === 0) return [];
    const rows = await manager
      .getRepository(StopIncident)
      .findBy({ tenantId, id: In(dissolved) });
    await manager
      .getRepository(StopIncident)
      .delete({ tenantId, id: In(dissolved) });
    return rows.map((r) => ({ start: r.startTime, end: r.endTime }));
  }
}

function sameIncident(
  row: StopIncident,
  values: Partial<StopIncident>,
): boolean {
  const time = (d: Date | null | undefined) =>
    d ? new Date(d).getTime() : null;
  return (
    row.assetId === values.assetId &&
    row.reasonCodeId === values.reasonCodeId &&
    time(row.startTime) === time(values.startTime) &&
    time(row.endTime) === time(values.endTime) &&
    row.stopCount === values.stopCount &&
    Number(row.stoppedSeconds) === values.stoppedSeconds &&
    row.windowSeconds === values.windowSeconds &&
    row.policyVersionId === values.policyVersionId
  );
}
