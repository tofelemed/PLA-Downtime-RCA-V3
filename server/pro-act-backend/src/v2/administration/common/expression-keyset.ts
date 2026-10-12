import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { CursorCodec, invalidCursor } from '../../common/cursor-codec';
import { SortDirection } from '../../common/sort-spec';

export type KeysetCast = 'text' | 'int' | 'timestamptz';

export interface ExpressionKeysetOptions<T> {
  alias: string;
  /** SQL of the sort key, e.g. `"u"."name"` or `COALESCE("t"."due_date", 'infinity')` */
  expression: string;
  cast: KeysetCast;
  direction: SortDirection;
  cursor?: string;
  limit: number;
  /** the sort key of a returned row, as the cursor stores it */
  valueOf: (row: T) => string | number;
}

/**
 * One keyset page (CONVENTIONS §4) over any sortable SQL expression (text, int, or a timestamp with a
 * COALESCE for nulls): orders by `(expression, id)`, fetches `limit + 1`, encodes the next cursor. The
 * timestamp variant `keysetPage` covers plain timestamp columns; this one covers names and orders.
 */
export async function expressionKeysetPage<
  T extends ObjectLiteral & { id: string },
>(
  qb: SelectQueryBuilder<T>,
  options: ExpressionKeysetOptions<T>,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const { alias, expression, cast, direction } = options;
  if (options.cursor) {
    const { sortValue, id } = CursorCodec.decode(options.cursor);
    if (sortValue === null) throw invalidCursor();
    const op = direction === 'ASC' ? '>' : '<';
    const value = `CAST(:keysetValue AS ${cast})`;
    qb.andWhere(
      `(${expression} ${op} ${value} OR (${expression} = ${value} AND "${alias}"."id" ${op} :keysetId))`,
      { keysetValue: String(sortValue), keysetId: id },
    );
  }
  const rows = await qb
    .orderBy(expression, direction)
    .addOrderBy(`${alias}.id`, direction)
    .limit(options.limit + 1)
    .getMany();
  const items = rows.slice(0, options.limit);
  const last = items[items.length - 1];
  const nextCursor =
    rows.length > options.limit && last
      ? CursorCodec.encode({ sortValue: options.valueOf(last), id: last.id })
      : null;
  return { items, nextCursor };
}
