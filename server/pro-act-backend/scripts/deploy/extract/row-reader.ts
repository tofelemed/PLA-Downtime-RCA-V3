/**
 * Row reads of the reference extraction: the filtered rows of one table in a deterministic order
 * (primary key; a self-referencing table by depth from its roots, then primary key), row counts, and
 * the references the seed could not satisfy.
 */
import type { ForeignKey } from './fk-order';
import type { Queryable } from './source-catalog';
import { quoteIdentifier } from './sql-writer';

export interface TableQuery {
  table: string;
  columns: string[];
  primaryKey: string[];
  filter: string;
  /** Self-referencing column and the column it references, when the table references itself. */
  selfReference: { column: string; referenced: string } | null;
}

const MAX_DEPTH = 1000;

function qualified(alias: string, columns: string[]): string {
  return columns
    .map((column) => `${alias}.${quoteIdentifier(column)}`)
    .join(', ');
}

export async function countRows(
  db: Queryable,
  table: string,
  filter: string,
): Promise<number> {
  const result = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${quoteIdentifier(table)} WHERE (${filter})`,
  );
  return result.rows[0].n;
}

function treeQuery(query: TableQuery): string {
  const self = query.selfReference;
  if (!self) throw new Error(`${query.table} does not reference itself`);
  const table = quoteIdentifier(query.table);
  const parent = quoteIdentifier(self.column);
  const key = quoteIdentifier(self.referenced);
  return `WITH RECURSIVE tree AS (
      SELECT ${key} AS node, 0 AS depth FROM ${table} WHERE (${query.filter}) AND ${parent} IS NULL
      UNION ALL
      SELECT c.${key}, tree.depth + 1 FROM ${table} c JOIN tree ON c.${parent} = tree.node
       WHERE (${query.filter}) AND tree.depth < ${MAX_DEPTH}
    )
    SELECT ${qualified('t', query.columns)} FROM ${table} t JOIN tree ON t.${key} = tree.node
     ORDER BY tree.depth, ${qualified('t', query.primaryKey)}`;
}

/** The rows in load order; a self-referencing table must reach every row from a root exactly once. */
export async function readRows(
  db: Queryable,
  query: TableQuery,
): Promise<Record<string, unknown>[]> {
  if (!query.selfReference) {
    const result = await db.query<Record<string, unknown>>(
      `SELECT ${qualified('t', query.columns)} FROM ${quoteIdentifier(query.table)} t
        WHERE (${query.filter}) ORDER BY ${qualified('t', query.primaryKey)}`,
    );
    return result.rows;
  }
  const result = await db.query<Record<string, unknown>>(treeQuery(query));
  const expected = await countRows(db, query.table, query.filter);
  if (result.rows.length !== expected) {
    throw new Error(
      `${query.table}: ${result.rows.length} of ${expected} rows reachable from a root ` +
        '(a parent outside the tenant, or a cycle)',
    );
  }
  return result.rows;
}

/**
 * `table.column -> references: n rows` for every foreign key whose value the seed would not contain:
 * a non-null reference to a table outside the plan, or to a row the plan's filter leaves out.
 */
export async function unsatisfiedReferences(
  db: Queryable,
  fks: ForeignKey[],
  filters: ReadonlyMap<string, string>,
): Promise<string[]> {
  const problems: string[] = [];
  for (const fk of fks) {
    const filter = filters.get(fk.table);
    if (filter === undefined) continue;
    const column = `src.${quoteIdentifier(fk.column)}`;
    const refFilter = filters.get(fk.references);
    const missing =
      refFilter === undefined
        ? 'true'
        : `NOT EXISTS (SELECT 1 FROM ${quoteIdentifier(fk.references)} r
           WHERE r.${quoteIdentifier(fk.referencedColumn ?? 'id')} = ${column} AND (${refFilter}))`;
    const result = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${quoteIdentifier(fk.table)} src
        WHERE (${filter}) AND ${column} IS NOT NULL AND ${missing}`,
    );
    const n = result.rows[0].n;
    if (n > 0)
      problems.push(`${fk.table}.${fk.column} -> ${fk.references}: ${n} rows`);
  }
  return problems;
}
