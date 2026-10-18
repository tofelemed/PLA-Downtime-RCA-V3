import { EntityManager } from 'typeorm';
import { isUuid } from '../production-event/revisions/revision-actor';
import { ProductionEvent } from '../production-event/production-event.entity';
import { RcaLinkType } from '../rca/entities/rca-case-link.entity';
import { approvedImpact } from './approved-impact';
import { inScope, invalidReference, notFound, RcaScope } from './rca-scope';

const MAX_TARGET_EVENTS = 200;

/** A resolved link target: its unit, revision and evidence package snapshot. */
export interface ResolvedTarget {
  unitId: string | null;
  targetRevision: number | null;
  evidence: Record<string, unknown>;
}

/** An event of the caller's tenant and units, or 404 (path ids) / 422 (body ids). */
export async function findEvent(
  manager: EntityManager,
  scope: RcaScope,
  id: string,
  as: 'path' | 'body' = 'path',
): Promise<ProductionEvent> {
  const event = isUuid(id)
    ? await manager
        .getRepository(ProductionEvent)
        .createQueryBuilder('event')
        .where('event.id = :id AND event.tenantId = :tenantId', {
          id,
          tenantId: scope.tenantId,
        })
        .getOne()
    : null;
  if (!event || !inScope(scope, event.unitId)) {
    throw as === 'path' ? notFound('Event') : invalidReference('targetId');
  }
  return event;
}

interface LossLineRow {
  unit_id: string;
  period_id: string;
  run_id: string | null;
  kind: string;
  quantity: string;
  uom: string | null;
  cause_event_id: string | null;
  segment_start: Date;
  segment_end: Date;
  source: 'run' | 'manual';
}

/** A run line (`loss_lines.id`). */
const RUN_LINE_SQL = `SELECT p."unit_id", l."period_id", l."run_id", l."kind"::text AS "kind", l."quantity"::text AS "quantity", l."uom",
        l."cause_event_id", l."segment_start", l."segment_end", 'run' AS "source"
   FROM "loss_lines" l JOIN "production_periods" p ON p."id" = l."period_id" AND p."tenant_id" = l."tenant_id"
  WHERE l."id" = $1 AND l."tenant_id" = $2`;

/**
 * A manual line of an approved revision (Marun E2E): the id is the manual line's (`approved_loss_lines.source_id`
 * with source `line`), its latest approval; it has no run segment, so the period bounds stand in.
 */
const MANUAL_LINE_SQL = `SELECT p."unit_id", a."period_id", ar."current_run_id" AS "run_id", a."kind"::text AS "kind",
        a."quantity"::text AS "quantity", a."uom", a."cause_event_id", p."utc_start" AS "segment_start",
        p."utc_end" AS "segment_end", 'manual' AS "source"
   FROM "approved_loss_lines" a
   JOIN "accounting_revisions" ar ON ar."id" = a."revision_id" AND ar."tenant_id" = a."tenant_id"
   JOIN "production_periods" p ON p."id" = a."period_id" AND p."tenant_id" = a."tenant_id"
  WHERE a."source_id" = $1 AND a."tenant_id" = $2 AND a."source" = 'line' AND ar."lifecycle" = 'approved'
  ORDER BY ar."revision" DESC LIMIT 1`;

async function findLossLine(
  manager: EntityManager,
  scope: RcaScope,
  id: string,
): Promise<LossLineRow | null> {
  if (!isUuid(id)) return null;
  const run: LossLineRow[] = await manager.query(RUN_LINE_SQL, [
    id,
    scope.tenantId,
  ]);
  if (run[0]) return run[0];
  const manual: LossLineRow[] = await manager.query(MANUAL_LINE_SQL, [
    id,
    scope.tenantId,
  ]);
  return manual[0] ?? null;
}

async function lossLineTarget(
  manager: EntityManager,
  scope: RcaScope,
  id: string,
): Promise<ResolvedTarget> {
  const line = await findLossLine(manager, scope, id);
  if (!line || !inScope(scope, line.unit_id))
    throw invalidReference('targetId');
  return {
    unitId: line.unit_id,
    targetRevision: null,
    evidence: {
      kind: 'loss_line',
      builtAt: new Date().toISOString(),
      line: {
        id,
        source: line.source,
        periodId: line.period_id,
        runId: line.run_id,
        kind: line.kind,
        quantity: line.quantity,
        uom: line.uom,
        causeEventId: line.cause_event_id,
        segmentStart: new Date(line.segment_start).toISOString(),
        segmentEnd: new Date(line.segment_end).toISOString(),
      },
      approvedImpact: await approvedImpact(manager, scope.tenantId, {
        lineIds: [id],
      }),
    },
  };
}

/** Events of a work order number or an occurrence, inside the caller's units. */
async function groupTarget(
  manager: EntityManager,
  scope: RcaScope,
  input: { kind: 'work_order' | 'occurrence'; id: string },
): Promise<ResolvedTarget> {
  if (input.kind === 'occurrence' && !isUuid(input.id))
    throw invalidReference('targetId');
  const column =
    input.kind === 'work_order' ? '"work_order_id"' : '"occurrence_id"';
  const rows: Array<{ id: string; unit_id: string }> = await manager.query(
    `SELECT "id", "unit_id" FROM "production_events" WHERE "tenant_id" = $1 AND ${column} = $2
      AND ($3::uuid[] IS NULL OR "unit_id" = ANY($3::uuid[])) ORDER BY "start_time", "id" LIMIT $4`,
    [scope.tenantId, input.id, scope.units, MAX_TARGET_EVENTS],
  );
  if (rows.length === 0) throw invalidReference('targetId');
  const eventIds = rows.map((row) => row.id);
  return {
    unitId: rows[0].unit_id,
    targetRevision: null,
    evidence: {
      kind: input.kind,
      builtAt: new Date().toISOString(),
      targetId: input.id,
      eventIds,
      approvedImpact: await approvedImpact(manager, scope.tenantId, {
        eventIds,
      }),
    },
  };
}

/** Resolves a non-event target of `POST /v2/rcas/{id}/links` (422 INVALID_REFERENCE when not in scope). */
export function resolveTarget(
  manager: EntityManager,
  scope: RcaScope,
  input: { linkType: Exclude<RcaLinkType, 'event'>; targetId: string },
): Promise<ResolvedTarget> {
  if (input.linkType === 'loss_line')
    return lossLineTarget(manager, scope, input.targetId);
  return groupTarget(manager, scope, {
    kind: input.linkType,
    id: input.targetId,
  });
}
