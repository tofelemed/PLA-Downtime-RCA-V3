import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { CursorCodec, invalidCursor } from './cursor-codec';
import { SortDirection } from './sort-spec';

export interface KeysetOptions {
  alias: string;
  /** entity property of a timestamp column; `id` is the tiebreak */
  property: string;
  direction: SortDirection;
  cursor?: string;
  limit: number;
}

/**
 * One keyset page (CONVENTIONS §4) over a timestamp sort column: applies the cursor, orders by
 * `(column, id)` in one direction, fetches `limit + 1` and encodes the next cursor. Columns filled by
 * `now()` carry microseconds while cursors carry milliseconds, so order and comparison both use the
 * column truncated to milliseconds (no row is skipped or repeated across pages).
 */
export async function keysetPage<T extends ObjectLiteral & { id: string }>(
  qb: SelectQueryBuilder<T>,
  options: KeysetOptions,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const { alias, property, direction } = options;
  const column =
    qb.expressionMap.mainAlias?.metadata.findColumnWithPropertyName(
      property,
    )?.databaseName;
  if (!column) throw new Error(`keysetPage: unknown property ${property}`);
  const sortKey = `date_trunc('milliseconds', "${alias}"."${column}")`;
  if (options.cursor) {
    const { sortValue, id } = CursorCodec.decode(options.cursor);
    if (typeof sortValue !== 'string') throw invalidCursor();
    const op = direction === 'ASC' ? '>' : '<';
    qb.andWhere(
      `(${sortKey} ${op} :keysetAt OR (${sortKey} = :keysetAt AND "${alias}"."id" ${op} :keysetId))`,
      { keysetAt: new Date(sortValue), keysetId: id },
    );
  }
  const rows = await qb
    .orderBy(sortKey, direction)
    .addOrderBy(`${alias}.id`, direction)
    .limit(options.limit + 1)
    .getMany();
  const items = rows.slice(0, options.limit);
  const last = items[items.length - 1];
  const value = last ? (last[property] as Date | null) : null;
  const nextCursor =
    rows.length > options.limit && last && value
      ? CursorCodec.encode({
          sortValue: new Date(value).toISOString(),
          id: last.id,
        })
      : null;
  return { items, nextCursor };
}
