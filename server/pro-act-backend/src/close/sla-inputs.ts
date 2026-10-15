import { EntityManager } from 'typeorm';
import {
  DataHoldSpan,
  SlaInputs,
  SlaWorkflow,
} from '../domain/close/reconciliation-sla';

/** The period facts the SLA clock reads. */
export interface SlaPeriod {
  id: string;
  tenantId: string;
  unitId: string;
  localDate: string;
}

interface CurrentRevision {
  periodId: string;
  revisionId: string | null;
  workflow: SlaWorkflow;
}

/** The latest revision that is not cancelled, as a grid workflow state ('none' without one). */
async function currentRevisions(
  manager: EntityManager,
  tenantId: string,
  ids: string[],
): Promise<Map<string, CurrentRevision>> {
  const rows: Array<{
    period_id: string;
    id: string | null;
    workflow: string;
  }> = await manager.query(
    `SELECT p."id" AS "period_id", r."id",
              CASE WHEN r."lifecycle" IS NULL THEN 'none'
                   WHEN r."lifecycle" = 'in_review' AND r."is_stale" THEN 'stale'
                   ELSE r."lifecycle"::text END AS "workflow"
         FROM "production_periods" p
         LEFT JOIN LATERAL (SELECT ar."id", ar."lifecycle", ar."is_stale" FROM "accounting_revisions" ar
                             WHERE ar."period_id" = p."id" AND ar."lifecycle" <> 'cancelled'
                             ORDER BY ar."revision" DESC LIMIT 1) r ON true
        WHERE p."tenant_id" = $1 AND p."id" = ANY($2::uuid[])`,
    [tenantId, ids],
  );
  return new Map(
    rows.map((r) => [
      r.period_id,
      {
        periodId: r.period_id,
        revisionId: r.id,
        workflow: r.workflow as SlaWorkflow,
      },
    ]),
  );
}

/** End of each production day: the latest period end of the unit and operational date. */
async function dayEnds(
  manager: EntityManager,
  tenantId: string,
  periods: readonly SlaPeriod[],
): Promise<Map<string, Date>> {
  const rows: Array<{ unit_id: string; local_date: string; day_end: Date }> =
    await manager.query(
      `SELECT q."unit_id", to_char(q."local_date", 'YYYY-MM-DD') AS "local_date", max(q."utc_end") AS "day_end"
         FROM "production_periods" q
        WHERE q."tenant_id" = $1 AND q."unit_id" = ANY($2::uuid[]) AND q."local_date" = ANY($3::date[])
        GROUP BY q."unit_id", q."local_date"`,
      [
        tenantId,
        [...new Set(periods.map((p) => p.unitId))],
        [...new Set(periods.map((p) => p.localDate))],
      ],
    );
  return new Map(
    rows.map((r) => [`${r.unit_id}|${r.local_date}`, new Date(r.day_end)]),
  );
}

async function rejectionsOf(
  manager: EntityManager,
  revisionIds: string[],
): Promise<Map<string, { count: number; last: Date }>> {
  if (revisionIds.length === 0) return new Map();
  const rows: Array<{ revision_id: string; count: number; last: Date }> =
    await manager.query(
      `SELECT "revision_id", count(*)::int AS "count", max("created_at") AS "last"
         FROM "approval_actions" WHERE "revision_id" = ANY($1::uuid[]) AND "action" = 'reject'
        GROUP BY "revision_id"`,
      [revisionIds],
    );
  return new Map(
    rows.map((r) => [
      r.revision_id,
      { count: r.count, last: new Date(r.last) },
    ]),
  );
}

async function holdsOf(
  manager: EntityManager,
  tenantId: string,
  ids: string[],
): Promise<Map<string, DataHoldSpan[]>> {
  const rows: Array<{
    period_id: string;
    started_at: Date;
    ended_at: Date | null;
  }> = await manager.query(
    `SELECT "period_id", "started_at", "ended_at" FROM "period_data_holds"
        WHERE "tenant_id" = $1 AND "period_id" = ANY($2::uuid[]) ORDER BY "started_at"`,
    [tenantId, ids],
  );
  const map = new Map<string, DataHoldSpan[]>();
  for (const r of rows) {
    const list = map.get(r.period_id) ?? [];
    list.push({
      startedAt: new Date(r.started_at),
      endedAt: r.ended_at ? new Date(r.ended_at) : null,
    });
    map.set(r.period_id, list);
  }
  return map;
}

/**
 * The SLA inputs of a page of periods in five bounded queries (no N+1): current revision, production-day
 * end, rejections of the current revision and the data holds. Periods of one tenant.
 */
export async function loadSlaInputs(
  manager: EntityManager,
  periods: readonly SlaPeriod[],
  asOf: Date,
): Promise<Map<string, SlaInputs>> {
  if (periods.length === 0) return new Map();
  const tenantId = periods[0].tenantId;
  const ids = periods.map((p) => p.id);
  const revisions = await currentRevisions(manager, tenantId, ids);
  const revisionIds = [...revisions.values()].flatMap((r) =>
    r.revisionId ? [r.revisionId] : [],
  );
  const [ends, rejections, holds] = await Promise.all([
    dayEnds(manager, tenantId, periods),
    rejectionsOf(manager, revisionIds),
    holdsOf(manager, tenantId, ids),
  ]);
  return new Map(
    periods.map((p) => {
      const revision = revisions.get(p.id);
      const rejected = revision?.revisionId
        ? rejections.get(revision.revisionId)
        : undefined;
      const inputs: SlaInputs = {
        dayEnd: ends.get(`${p.unitId}|${p.localDate}`) ?? asOf,
        asOf,
        workflow: revision?.workflow ?? 'none',
        lastRejectedAt: rejected?.last ?? null,
        rejections: rejected?.count ?? 0,
        holds: holds.get(p.id) ?? [],
      };
      return [p.id, inputs];
    }),
  );
}
