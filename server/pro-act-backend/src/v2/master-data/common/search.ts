import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

/** `ILIKE` pattern of a free-text search: `%`, `_` and `\` are matched literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Narrows a list to rows whose code or name contains `q` (case-insensitive); a blank `q` is ignored. */
export function applySearch<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  q: string | undefined,
  nameProperty = 'name',
): SelectQueryBuilder<T> {
  const text = q?.trim();
  if (!text) return qb;
  return qb.andWhere(
    `(${alias}.code ILIKE :searchText OR ${alias}.${nameProperty} ILIKE :searchText)`,
    { searchText: containsPattern(text) },
  );
}
