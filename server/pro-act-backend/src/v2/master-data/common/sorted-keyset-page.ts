import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { CursorCodec, invalidCursor } from '../../common/cursor-codec';
import { keysetPage } from '../../common/keyset-page';
import { parseSort, SortSpec } from '../../common/sort-spec';
import {
  MASTER_DATA_SORTS,
  MasterDataSortField,
} from './master-data-list-query.dto';

export interface SortedPageOptions {
  alias: string;
  sort: string | undefined;
  cursor?: string;
  limit: number;
  /** entity property per sort field when it differs from the field name */
  properties?: Partial<Record<MasterDataSortField, string>>;
}

const DEFAULT_SORT: SortSpec<MasterDataSortField> = {
  field: 'createdAt',
  direction: 'ASC',
};

/**
 * One keyset page of a master-data list (CONVENTIONS §4) sorted by code, name or creation time, `id` as
 * the tiebreak. Timestamps reuse `keysetPage`; text columns compare `(column, id)` against the cursor.
 */
export async function sortedKeysetPage<
  T extends ObjectLiteral & { id: string },
>(
  qb: SelectQueryBuilder<T>,
  options: SortedPageOptions,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const sort = parseSort(options.sort, MASTER_DATA_SORTS, DEFAULT_SORT);
  const property = options.properties?.[sort.field] ?? sort.field;
  if (sort.field === 'createdAt') {
    return keysetPage(qb, {
      alias: options.alias,
      property,
      direction: sort.direction,
      cursor: options.cursor,
      limit: options.limit,
    });
  }
  const column = `${options.alias}.${property}`;
  const op = sort.direction === 'ASC' ? '>' : '<';
  if (options.cursor) {
    const { sortValue, id } = CursorCodec.decode(options.cursor);
    if (typeof sortValue !== 'string') throw invalidCursor();
    qb.andWhere(
      `(${column} ${op} :keysetText OR (${column} = :keysetText AND ${options.alias}.id ${op} :keysetId))`,
      { keysetText: sortValue, keysetId: id },
    );
  }
  const rows = await qb
    .orderBy(column, sort.direction)
    .addOrderBy(`${options.alias}.id`, sort.direction)
    .limit(options.limit + 1)
    .getMany();
  const items = rows.slice(0, options.limit);
  const last = items[items.length - 1];
  const nextCursor =
    rows.length > options.limit && last
      ? CursorCodec.encode({ sortValue: String(last[property]), id: last.id })
      : null;
  return { items, nextCursor };
}
