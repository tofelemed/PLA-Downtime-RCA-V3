import { CursorCodec } from '../v2/common/cursor-codec';
import { RcaActionV2ListQueryDto } from '../v2/rca/rca-actions-v2.dto';
import { actionOverdueSql } from './action-overdue';
import { actionQueueConditions, actionQueueCursor } from './rca-action-queue';
import { RcaScope } from './rca-scope';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const scope: RcaScope = { tenantId, units: null, userId };
const query = (overrides: Partial<RcaActionV2ListQueryDto>) =>
  Object.assign(new RcaActionV2ListQueryDto(), overrides);

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
  return undefined;
}

describe('cross-case RCA action list (UX F-7)', () => {
  it('adds no filter beyond the scope for a whole-tenant caller without filters', () => {
    expect(actionQueueConditions(query({}), scope)).toEqual([]);
  });

  it('limits a unit-limited caller to the cases of its units', () => {
    const [condition] = actionQueueConditions(query({}), {
      ...scope,
      units: [id],
    });
    expect(condition).toEqual({
      sql: 'rca.unitId = ANY(:units::uuid[])',
      params: { units: [id] },
    });
  });

  it('resolves mine to the signed-in user, and to no one without a user id', () => {
    expect(actionQueueConditions(query({ mine: true }), scope)).toEqual([
      { sql: 'a.ownerId = :mineId', params: { mineId: userId } },
    ]);
    const [anonymous] = actionQueueConditions(query({ mine: true }), {
      ...scope,
      userId: null,
    });
    expect(anonymous.params.mineId).toBe(
      '00000000-0000-0000-0000-000000000000',
    );
  });

  it('combines statuses, overdue (the summary definition), case, unit and due window', () => {
    const conditions = actionQueueConditions(
      query({
        status: ['open', 'in_progress'],
        overdue: true,
        rcaId: id,
        unitId: id,
        from: '2026-10-01T00:00:00Z',
        to: '2026-11-01T00:00:00Z',
      }),
      scope,
    );
    expect(conditions.map((condition) => condition.sql)).toEqual([
      'a.status::text = ANY(:statuses::text[])',
      actionOverdueSql('a'),
      'a.rcaId = :rcaId',
      'rca.unitId = :unitId',
      'a.dueDate >= :dueFrom',
      'a.dueDate < :dueTo',
    ]);
    expect(actionQueueConditions(query({ overdue: false }), scope)[0].sql).toBe(
      `NOT ${actionOverdueSql('a')}`,
    );
  });

  it('defines overdue as open or in progress past a due date (null-safe)', () => {
    expect(actionOverdueSql('a')).toBe(
      `(a."due_date" IS NOT NULL AND a."due_date" < now() AND a."status"::text IN ('open', 'in_progress'))`,
    );
  });

  it('continues after a dated cursor with later dates and then undated actions', () => {
    const cursor = CursorCodec.encode({
      sortValue: '2026-10-18 06:30:00.123456+00',
      id,
    });
    expect(actionQueueCursor(cursor)).toEqual({
      sql: '("a"."due_date" IS NULL OR ("a"."due_date", "a"."id") > (CAST(:cursorDue AS timestamptz), :cursorId))',
      params: { cursorDue: '2026-10-18 06:30:00.123456+00', cursorId: id },
    });
  });

  it('continues after an undated cursor with undated actions only', () => {
    const cursor = CursorCodec.encode({ sortValue: null, id });
    expect(actionQueueCursor(cursor).sql).toBe(
      '"a"."due_date" IS NULL AND "a"."id" > :cursorId',
    );
  });

  it('rejects a cursor it did not issue (400 INVALID_CURSOR)', () => {
    for (const bad of [
      CursorCodec.encode({ sortValue: 'yesterday', id }),
      CursorCodec.encode({ sortValue: null, id: 'not-a-uuid' }),
      CursorCodec.encode({ sortValue: 5, id }),
      'garbage',
    ]) {
      expect(errorCode(() => actionQueueCursor(bad))).toBe('INVALID_CURSOR');
    }
  });
});
