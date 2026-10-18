import { SelectQueryBuilder } from 'typeorm';
import { ProductionEvent } from '../../production-event/production-event.entity';
import {
  applyMinDurationFilter,
  applyVerificationFilter,
  containsPattern,
} from './production-event-v2.query';

describe('containsPattern (v2 event text search)', () => {
  it('wraps the text in wildcards', () => {
    expect(containsPattern('pump')).toBe('%pump%');
  });

  it('takes LIKE wildcards and the escape character literally', () => {
    expect(containsPattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});

type Call = [string, unknown?];

function recorder(): {
  qb: SelectQueryBuilder<ProductionEvent>;
  calls: Call[];
} {
  const calls: Call[] = [];
  const qb = {
    andWhere(sql: string, params?: unknown) {
      calls.push(params === undefined ? [sql] : [sql, params]);
      return qb;
    },
  };
  return {
    qb: qb as unknown as SelectQueryBuilder<ProductionEvent>,
    calls,
  };
}

describe('applyMinDurationFilter (UX E-1)', () => {
  const asOf = new Date('2026-10-18T12:00:00.000Z');

  it('compares closed events on the duration key and running events on the elapsed time to asOf', () => {
    const { qb, calls } = recorder();
    applyMinDurationFilter(qb, 3600, { alias: 'event', asOf });
    expect(calls).toEqual([
      [
        "((event.endTime IS NOT NULL AND COALESCE(event.durationSeconds, CAST('Infinity' AS numeric)) >= :minDurationSeconds) OR " +
          '(event.endTime IS NULL AND event.startTime <= :openStartedBy))',
        {
          minDurationSeconds: 3600,
          openStartedBy: new Date('2026-10-18T11:00:00.000Z'),
        },
      ],
    ]);
  });

  it('adds nothing when the filter is absent', () => {
    const { qb, calls } = recorder();
    applyMinDurationFilter(qb, undefined, { alias: 'event', asOf });
    expect(calls).toEqual([]);
  });

  it('applies 0 (every event)', () => {
    const { qb, calls } = recorder();
    applyMinDurationFilter(qb, 0, { alias: 'event', asOf });
    expect(calls).toHaveLength(1);
  });
});

describe('applyVerificationFilter (UX E-7)', () => {
  it('filters on verified_at', () => {
    const verified = recorder();
    applyVerificationFilter(verified.qb, ['verified'], 'event');
    expect(verified.calls).toEqual([['event.verifiedAt IS NOT NULL']]);

    const open = recorder();
    applyVerificationFilter(open.qb, ['not_verified'], 'event');
    expect(open.calls).toEqual([['event.verifiedAt IS NULL']]);
  });

  it('adds nothing for none or both states', () => {
    const none = recorder();
    applyVerificationFilter(none.qb, undefined, 'event');
    const both = recorder();
    applyVerificationFilter(both.qb, ['verified', 'not_verified'], 'event');
    expect([...none.calls, ...both.calls]).toEqual([]);
  });
});
