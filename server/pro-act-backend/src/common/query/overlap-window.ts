import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface IntervalColumns {
  alias: string;
  /** property name of the interval start (e.g. `startTime`) */
  start: string;
  /** property name of the nullable interval end (e.g. `endTime`) */
  end: string;
}

/**
 * Half-open overlap filter: `start < :to AND (end IS NULL OR end > :from)`.
 * Either bound may be omitted; running intervals (null end) match every window after their start.
 */
export function applyOverlapWindow<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  columns: IntervalColumns,
  from?: string | Date,
  to?: string | Date,
): SelectQueryBuilder<T> {
  if (from) {
    qb.andWhere(
      `(${columns.alias}.${columns.end} IS NULL OR ${columns.alias}.${columns.end} > :windowStart)`,
      {
        windowStart: new Date(from),
      },
    );
  }
  if (to) {
    qb.andWhere(`${columns.alias}.${columns.start} < :windowEnd`, {
      windowEnd: new Date(to),
    });
  }
  return qb;
}
