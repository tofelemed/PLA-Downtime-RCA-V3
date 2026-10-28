/**
 * Renders extracted rows as `INSERT … ON CONFLICT DO NOTHING` statements with Postgres literals, and
 * wraps them in a seed file (`SET search_path = forge, public;`, one transaction).
 */

/** Column type as `information_schema.columns` states it. */
export interface ColumnType {
  dataType: string;
  udtName: string;
}

export type ColumnTypes = Readonly<Record<string, ColumnType>>;

// Reserved and type-function keywords of PostgreSQL 15 (pg_get_keywords() catcode R and T).
const RESERVED = new Set(
  (
    'all analyse analyze and any array as asc asymmetric authorization binary both case cast check ' +
    'collate collation column concurrently constraint create cross current_catalog current_date ' +
    'current_role current_schema current_time current_timestamp current_user default deferrable desc ' +
    'distinct do else end except false fetch for foreign freeze from full grant group having ilike in ' +
    'initially inner intersect into is isnull join lateral leading left like limit localtime ' +
    'localtimestamp natural not notnull null offset on only or order outer overlaps placing primary ' +
    'references returning right select session_user similar some symmetric table tablesample then to ' +
    'trailing true union unique user using variadic verbose when where window with'
  ).split(' '),
);

const PLAIN_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const NUMERIC_TEXT = /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/;
const TIME_TYPES: Readonly<Record<string, string>> = {
  timestamptz: 'timestamptz',
  timestamp: 'timestamp',
  date: 'date',
};

/** The identifier as written in SQL: bare when lowercase and not reserved, else double-quoted. */
export function quoteIdentifier(name: string): string {
  if (PLAIN_IDENTIFIER.test(name) && !RESERVED.has(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteText(text: string): string {
  return `'${text.replace(/'/g, "''")}'`;
}

function isJsonColumn(type: ColumnType | undefined): boolean {
  return type?.udtName === 'jsonb' || type?.udtName === 'json';
}

function renderNumber(value: number, where: string): string {
  if (!Number.isFinite(value))
    throw new Error(`cannot render ${value} in ${where}`);
  return String(value);
}

function renderArray(
  values: unknown[],
  type: ColumnType | undefined,
  where: string,
): string {
  const items = values.map((item) => renderScalar(item, undefined, where));
  const element = type?.udtName.startsWith('_')
    ? type.udtName.slice(1)
    : undefined;
  return `ARRAY[${items.join(', ')}]${element ? `::${element}[]` : ''}`;
}

function renderString(value: string, type: ColumnType | undefined): string {
  if (type?.udtName === 'numeric' && NUMERIC_TEXT.test(value)) return value;
  const timeCast = type ? TIME_TYPES[type.udtName] : undefined;
  return timeCast ? `${quoteText(value)}::${timeCast}` : quoteText(value);
}

function renderScalar(
  value: unknown,
  type: ColumnType | undefined,
  where: string,
): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return renderNumber(value, where);
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'string') return renderString(value, type);
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()))
      throw new Error(`cannot render an invalid date in ${where}`);
    return `${quoteText(value.toISOString())}::timestamptz`;
  }
  if (Array.isArray(value)) return renderArray(value, type, where);
  if (Buffer.isBuffer(value))
    throw new Error(`cannot render binary data in ${where}`);
  if (typeof value === 'object')
    return `${quoteText(JSON.stringify(value))}::jsonb`;
  throw new Error(`cannot render a ${typeof value} in ${where}`);
}

/** One value as a Postgres literal; json/jsonb columns always render as `'<json>'::jsonb` (or `::json`). */
export function renderValue(
  value: unknown,
  type: ColumnType | undefined,
  where: string,
): string {
  if (type && isJsonColumn(type) && value !== null && value !== undefined) {
    const json = typeof value === 'string' ? value : JSON.stringify(value);
    return `${quoteText(json)}::${type.udtName}`;
  }
  return renderScalar(value, type, where);
}

/** `INSERT INTO <table> (…) VALUES (…) ON CONFLICT DO NOTHING;` for one row. */
export function insertStatement(
  table: string,
  columns: string[],
  row: Record<string, unknown>,
  types: ColumnTypes = {},
): string {
  const names = columns.map(quoteIdentifier).join(', ');
  const values = columns
    .map((column) =>
      renderValue(row[column], types[column], `${table}.${column}`),
    )
    .join(', ');
  return `INSERT INTO ${quoteIdentifier(table)} (${names}) VALUES (${values}) ON CONFLICT DO NOTHING;`;
}

/** A seed file: header comment, search path, the statements in one transaction. */
export function sqlFile(header: string, statements: readonly string[]): string {
  return [
    header,
    'SET search_path = forge, public;',
    'BEGIN;',
    ...statements,
    'COMMIT;',
    '',
  ].join('\n');
}
