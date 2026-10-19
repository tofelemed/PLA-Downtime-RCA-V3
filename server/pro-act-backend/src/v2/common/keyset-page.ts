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
  /**
   * id of a row to open (deep link): on the first page (no cursor) the page starts at that row — a keyset
   * seek to its stored sort key — so it is the page containing the row; `nextCursor` continues after it. A
   * row outside the query's filters or scope is ignored (the first page is returned).
   */
  focus?: string;
}

/** The stored sort value of the page's last row at full (microsecond) precision, as text. */
async function exactSortValue<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  column: string,
  id: string,
): Promise<string | null> {
  const metadata = qb.expressionMap.mainAlias?.metadata;
  if (!metadata) return null;
  const rows: Array<{ value: string | null }> = await qb.connection.query(
    `SELECT "${column}"::text AS "value" FROM ${metadata.tablePath
      .split('.')
      .map((part) => `"${part}"`)
      .join('.')} WHERE "id" = $1`,
    [id],
  );
  return rows[0]?.value ?? null;
}

/** Starts the page at the focus row: `(column, id) >= (its stored key)` in the sort direction. */
async function seekFocus<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  seek: {
    sortKey: string;
    alias: string;
    direction: SortDirection;
    focus: string;
  },
): Promise<void> {
  const id = `"${seek.alias}"."id"`;
  const row = await qb
    .clone()
    .andWhere(`${id} = :keysetFocusId`, { keysetFocusId: seek.focus })
    .select(`${seek.sortKey}::text`, 'value')
    .getRawOne<{ value: string | null }>();
  if (!row?.value) return;
  const op = seek.direction === 'ASC' ? '>=' : '<=';
  qb.andWhere(
    `(${seek.sortKey}, ${id}) ${op} (CAST(:keysetFocusAt AS timestamptz), :keysetFocusId)`,
    { keysetFocusAt: row.value, keysetFocusId: seek.focus },
  );
}

/**
 * One keyset page (CONVENTIONS §4) over a timestamp sort column: applies the cursor as a row comparison
 * `(column, id) < (cursor)`, orders by the raw `(column, id)` in one direction — so a
 * `(…, column, id)` index serves the page (DB-02 / DB-06) — fetches `limit + 1` and encodes the next
 * cursor with the stored value at microsecond precision, so rows sharing a millisecond are neither
 * skipped nor repeated. Cursors written before (milliseconds, ISO) still decode.
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
  const sortKey = `"${alias}"."${column}"`;
  if (!options.cursor && options.focus) {
    await seekFocus(qb, { sortKey, alias, direction, focus: options.focus });
  }
  if (options.cursor) {
    const { sortValue, id } = CursorCodec.decode(options.cursor);
    if (typeof sortValue !== 'string') throw invalidCursor();
    const op = direction === 'ASC' ? '>' : '<';
    qb.andWhere(
      `(${sortKey}, "${alias}"."id") ${op} (CAST(:keysetAt AS timestamptz), :keysetId)`,
      { keysetAt: sortValue, keysetId: id },
    );
  }
  const rows = await qb
    .orderBy(sortKey, direction)
    .addOrderBy(`"${alias}"."id"`, direction)
    .limit(options.limit + 1)
    .getMany();
  const items = rows.slice(0, options.limit);
  const last = items[items.length - 1];
  const more = rows.length > options.limit && last;
  const value = more ? await exactSortValue(qb, column, last.id) : null;
  const nextCursor =
    more && value
      ? CursorCodec.encode({ sortValue: value, id: last.id })
      : null;
  return { items, nextCursor };
}

/**
 * Cursor positioned at one row (`id`) of a `keysetPage` sort, with the stored sort value at microsecond
 * precision: lets a filtered scan stop in the middle of a fetched page and resume right after that row.
 */
export async function keysetCursorAt<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  property: string,
  id: string,
): Promise<string | null> {
  const column =
    qb.expressionMap.mainAlias?.metadata.findColumnWithPropertyName(
      property,
    )?.databaseName;
  if (!column) throw new Error(`keysetCursorAt: unknown property ${property}`);
  const value = await exactSortValue(qb, column, id);
  return value ? CursorCodec.encode({ sortValue: value, id }) : null;
}
