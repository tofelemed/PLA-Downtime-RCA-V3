import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { ProductionEvent } from '../../production-event/production-event.entity';
import { CursorCodec } from '../common/cursor-codec';
import {
  applyEventKeyset,
  applyEventOrder,
  cursorOf,
  OPEN_DURATION_CURSOR,
  sortKeyOf,
} from './production-event-sort';

type Call = [string, string, unknown?];

function recorder(): {
  qb: SelectQueryBuilder<ProductionEvent>;
  calls: Call[];
} {
  const calls: Call[] = [];
  const qb = {
    andWhere(sql: string, params?: unknown) {
      calls.push(['and', sql, params]);
      return qb;
    },
    orderBy(sql: string, dir: string) {
      calls.push(['order', sql, dir]);
      return qb;
    },
    addOrderBy(sql: string, dir: string) {
      calls.push(['addOrder', sql, dir]);
      return qb;
    },
  };
  return {
    qb: qb as unknown as SelectQueryBuilder<ProductionEvent>,
    calls,
  };
}

const ID = '2f1b4a6e-1111-4c3d-8e9f-000000000001';
const DURATION_KEY =
  "COALESCE(event.durationSeconds, CAST('Infinity' AS numeric))";

describe('v2 event sort (UX E-1)', () => {
  it('sorts by start time on the column and by duration on the open-as-longest key', () => {
    expect(sortKeyOf('startTime', 'event')).toBe('event.startTime');
    expect(sortKeyOf('durationSeconds', 'event')).toBe(DURATION_KEY);
  });

  it('orders by the sort key then id in the same direction', () => {
    const { qb, calls } = recorder();
    applyEventOrder(qb, { field: 'durationSeconds', direction: 'DESC' });
    expect(calls).toEqual([
      ['order', DURATION_KEY, 'DESC'],
      ['addOrder', 'event.id', 'DESC'],
    ]);
  });

  it('encodes the duration, or Infinity for an event without an end, with the id', () => {
    const closed = { id: ID, startTime: new Date(), durationSeconds: 90.5 };
    const open = { id: ID, startTime: new Date(), durationSeconds: null };
    expect(CursorCodec.decode(cursorOf(closed, 'durationSeconds'))).toEqual({
      sortValue: 90.5,
      id: ID,
    });
    expect(CursorCodec.decode(cursorOf(open, 'durationSeconds'))).toEqual({
      sortValue: OPEN_DURATION_CURSOR,
      id: ID,
    });
  });

  it('encodes the start time as ISO for the start-time sort', () => {
    const start = new Date('2026-10-18T06:00:00.000Z');
    const cursor = cursorOf(
      { id: ID, startTime: start, durationSeconds: 5 },
      'startTime',
    );
    expect(CursorCodec.decode(cursor).sortValue).toBe(start.toISOString());
  });

  it('applies a duration cursor as a numeric row comparison (descending: <)', () => {
    const { qb, calls } = recorder();
    const cursor = CursorCodec.encode({ sortValue: 120, id: ID });
    applyEventKeyset(qb, cursor, {
      field: 'durationSeconds',
      direction: 'DESC',
    });
    expect(calls).toEqual([
      [
        'and',
        `(${DURATION_KEY}, event.id) < (CAST(:cursorSort AS numeric), :cursorId)`,
        { cursorSort: '120', cursorId: ID },
      ],
    ]);
  });

  it('continues inside the running events with the Infinity boundary (ascending: >)', () => {
    const { qb, calls } = recorder();
    const cursor = CursorCodec.encode({
      sortValue: OPEN_DURATION_CURSOR,
      id: ID,
    });
    applyEventKeyset(qb, cursor, {
      field: 'durationSeconds',
      direction: 'ASC',
    });
    expect(calls[0][1]).toContain('>');
    expect(calls[0][2]).toEqual({ cursorSort: 'Infinity', cursorId: ID });
  });

  it('keeps the start-time cursor as a timestamp comparison', () => {
    const { qb, calls } = recorder();
    const at = '2026-10-18T06:00:00.000Z';
    applyEventKeyset(qb, CursorCodec.encode({ sortValue: at, id: ID }), {
      field: 'startTime',
      direction: 'DESC',
    });
    expect(calls[0][1]).toBe(
      '(event.startTime, event.id) < (:cursorSort, :cursorId)',
    );
    expect(calls[0][2]).toEqual({ cursorSort: new Date(at), cursorId: ID });
  });

  it('refuses a cursor of the other sort or a negative duration (400 INVALID_CURSOR)', () => {
    const { qb } = recorder();
    const dateCursor = CursorCodec.encode({
      sortValue: '2026-10-18T06:00:00.000Z',
      id: ID,
    });
    const negative = CursorCodec.encode({ sortValue: -1, id: ID });
    const durationSort = {
      field: 'durationSeconds' as const,
      direction: 'DESC' as const,
    };
    expect(() => applyEventKeyset(qb, dateCursor, durationSort)).toThrow(
      BadRequestException,
    );
    expect(() => applyEventKeyset(qb, negative, durationSort)).toThrow(
      BadRequestException,
    );
  });

  it('adds nothing without a cursor', () => {
    const { qb, calls } = recorder();
    applyEventKeyset(qb, undefined, {
      field: 'durationSeconds',
      direction: 'ASC',
    });
    expect(calls).toEqual([]);
  });
});
