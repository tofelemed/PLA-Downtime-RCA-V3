import { isUuid } from '../production-event/revisions/revision-actor';
import { CursorCodec, invalidCursor } from '../v2/common/cursor-codec';
import { RcaActionV2ListQueryDto } from '../v2/rca/rca-actions-v2.dto';
import { actionOverdueSql } from './action-overdue';
import { RcaActionV2View } from './rca-action.view';
import { RcaScope } from './rca-scope';

/** One `andWhere` of the cross-case action list: SQL over aliases `a` (action) and `rca` (its case). */
export interface QueueCondition {
  sql: string;
  params: Record<string, unknown>;
}

/** The case of an action row, so the list needs no request per row. */
export interface RcaActionCaseRef {
  id: string;
  title: string;
  status: string | null;
  unitId: string | null;
}

/** A row of `GET /v2/rca-actions`: the action as the case screen shows it, plus its case. */
export interface RcaActionQueueItemV2View extends RcaActionV2View {
  case: RcaActionCaseRef;
}

const NO_MATCH = '00000000-0000-0000-0000-000000000000';
/** a stored timestamptz as text (`2026-10-18 06:30:00.123456+00`) or ISO 8601 */
const TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}(:?\d{2})?)?$/;

/**
 * Filters of `GET /v2/rca-actions` (F-7) inside the caller's scope: the units of a unit-limited grant
 * (through the case), `mine` (the signed-in user; nothing for a caller without a user id), owner,
 * statuses, overdue (`actionOverdueSql`), case, unit and a half-open due-date window (`from`/`to`).
 */
export function actionQueueConditions(
  query: RcaActionV2ListQueryDto,
  scope: RcaScope,
): QueueCondition[] {
  const conditions: QueueCondition[] = [];
  const add = (sql: string, params: Record<string, unknown> = {}) =>
    conditions.push({ sql, params });
  if (scope.units)
    add('rca.unitId = ANY(:units::uuid[])', { units: scope.units });
  if (query.mine)
    add('a.ownerId = :mineId', { mineId: scope.userId ?? NO_MATCH });
  if (query.ownerId) add('a.ownerId = :ownerId', { ownerId: query.ownerId });
  if (query.status?.length)
    add('a.status::text = ANY(:statuses::text[])', { statuses: query.status });
  if (query.overdue !== undefined)
    add(query.overdue ? actionOverdueSql('a') : `NOT ${actionOverdueSql('a')}`);
  if (query.rcaId) add('a.rcaId = :rcaId', { rcaId: query.rcaId });
  if (query.unitId) add('rca.unitId = :unitId', { unitId: query.unitId });
  if (query.from) add('a.dueDate >= :dueFrom', { dueFrom: query.from });
  if (query.to) add('a.dueDate < :dueTo', { dueTo: query.to });
  return conditions;
}

/**
 * Keyset position after a cursor of the order `due_date ASC NULLS LAST, id ASC`: a dated cursor continues
 * with later dates (same date: larger id) and then every undated action; an undated cursor (sort value
 * null) continues with undated actions of larger id. 400 INVALID_CURSOR for anything else.
 */
export function actionQueueCursor(cursor: string): QueueCondition {
  const { sortValue, id } = CursorCodec.decode(cursor);
  if (!isUuid(id)) throw invalidCursor();
  if (sortValue === null)
    return {
      sql: '"a"."due_date" IS NULL AND "a"."id" > :cursorId',
      params: { cursorId: id },
    };
  if (typeof sortValue !== 'string' || !TIMESTAMP.test(sortValue))
    throw invalidCursor();
  return {
    sql: '("a"."due_date" IS NULL OR ("a"."due_date", "a"."id") > (CAST(:cursorDue AS timestamptz), :cursorId))',
    params: { cursorDue: sortValue, cursorId: id },
  };
}
