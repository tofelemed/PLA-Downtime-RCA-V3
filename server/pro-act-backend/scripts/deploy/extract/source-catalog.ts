/**
 * Catalogue reads of the source (dev) database for the reference extraction: table names, column
 * types, primary keys and single-column foreign keys of schema `public`.
 */
import type { Client } from 'pg';
import type { ForeignKey } from './fk-order';
import type { ColumnType } from './sql-writer';

export type Queryable = Pick<Client, 'query'>;

export interface ColumnInfo {
  name: string;
  type: ColumnType;
}

export async function tableNames(db: Queryable): Promise<Set<string>> {
  const result = await db.query<{ name: string }>(
    `SELECT table_name AS name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  return new Set(result.rows.map((row) => row.name));
}

/** Insertable columns (generated columns left out) in ordinal order. */
export async function tableColumns(
  db: Queryable,
  table: string,
): Promise<ColumnInfo[]> {
  const result = await db.query<{
    name: string;
    data_type: string;
    udt_name: string;
  }>(
    `SELECT column_name AS name, data_type, udt_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND is_generated = 'NEVER'
      ORDER BY ordinal_position`,
    [table],
  );
  return result.rows.map((row) => ({
    name: row.name,
    type: { dataType: row.data_type, udtName: row.udt_name },
  }));
}

export async function primaryKey(
  db: Queryable,
  table: string,
): Promise<string[]> {
  const result = await db.query<{ name: string }>(
    `SELECT a.attname AS name
       FROM pg_constraint c
       JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS k(attnum, position) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
      WHERE c.contype = 'p' AND c.conrelid = format('public.%I', $1::text)::regclass
      ORDER BY k.position`,
    [table],
  );
  if (result.rows.length === 0)
    throw new Error(`table ${table} has no primary key`);
  return result.rows.map((row) => row.name);
}

interface FkRow {
  table: string;
  columns: string[];
  references: string;
  referenced: string[];
}

/** Foreign keys of `public` whose referencing table is one of `tables`; multi-column keys are refused. */
export async function foreignKeys(
  db: Queryable,
  tables: string[],
): Promise<ForeignKey[]> {
  const result = await db.query<FkRow>(
    `SELECT src.relname AS "table", ref.relname AS "references",
            ARRAY(SELECT attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, p)
                  JOIN pg_attribute ON attrelid = c.conrelid AND attnum = k.n ORDER BY k.p) AS columns,
            ARRAY(SELECT attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n, p)
                  JOIN pg_attribute ON attrelid = c.confrelid AND attnum = k.n ORDER BY k.p) AS referenced
       FROM pg_constraint c
       JOIN pg_class src ON src.oid = c.conrelid
       JOIN pg_class ref ON ref.oid = c.confrelid
       JOIN pg_namespace n ON n.oid = src.relnamespace
      WHERE c.contype = 'f' AND n.nspname = 'public' AND src.relname = ANY($1::text[])
      ORDER BY src.relname, c.conname`,
    [tables],
  );
  return result.rows.map((row) => {
    if (row.columns.length !== 1) {
      throw new Error(
        `multi-column foreign key on ${row.table} (${row.columns.join(', ')}) is not supported`,
      );
    }
    return {
      table: row.table,
      column: row.columns[0],
      references: row.references,
      referencedColumn: row.referenced[0],
    };
  });
}
