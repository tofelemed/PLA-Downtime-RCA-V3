import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CursorCodec, invalidCursor } from '../../common/cursor-codec';
import { SortDirection } from '../../common/sort-spec';

/** A user as the directory returns it: directory columns only, never the password hash. */
export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  /** home plant */
  tenantId: string | null;
  organizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DirectoryRow {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  tenant_id: string | null;
  organization_id: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Which users a page reads: the members of a plant (home plant or a scope grant there, through the
 * `app_plant_user_directory` function) plus, for organization and super administrators, the users placed
 * in no plant of its organization; or every user (super administrators only, never row-restricted).
 */
export type UserSource =
  | { kind: 'plant'; tenantId: string; organizationId: string | null }
  | { kind: 'everyone' };

export type DirectorySortField = 'name' | 'createdAt';

export interface DirectoryPageOptions {
  q?: string;
  /** whether `q` also matches the e-mail (the users list) or only the name (pickers) */
  searchEmail: boolean;
  roles?: readonly string[];
  isActive?: boolean;
  sort: { field: DirectorySortField; direction: SortDirection };
  cursor?: string;
  limit: number;
}

const COLUMNS = `"u"."id", "u"."name", "u"."email", "u"."role", "u"."is_active", "u"."tenant_id",
  "u"."organization_id", "u"."created_at", "u"."updated_at"`;

const SORT_SQL: Record<
  DirectorySortField,
  { expression: string; cast: string }
> = {
  name: { expression: '"u"."name"', cast: 'text' },
  createdAt: {
    expression: `date_trunc('milliseconds', "u"."created_at")`,
    cast: 'timestamptz',
  },
};

/** Positional parameters of one raw statement. */
class SqlParams {
  readonly values: unknown[] = [];

  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

const toDirectoryUser = (row: DirectoryRow): DirectoryUser => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  isActive: row.is_active,
  tenantId: row.tenant_id,
  organizationId: row.organization_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function sourceSql(source: UserSource, params: SqlParams): string {
  if (source.kind === 'everyone') return `SELECT ${COLUMNS} FROM "users" "u"`;
  const members = `SELECT * FROM app_plant_user_directory(${params.add(source.tenantId)}::uuid)`;
  if (!source.organizationId) return members;
  return (
    `${members} UNION SELECT ${COLUMNS} FROM "users" "u" ` +
    `WHERE "u"."tenant_id" IS NULL AND "u"."organization_id" = ${params.add(source.organizationId)}::uuid`
  );
}

function filtersSql(
  options: DirectoryPageOptions,
  params: SqlParams,
): string[] {
  const where: string[] = [];
  if (options.q) {
    const q = params.add(`%${escapeLike(options.q)}%`);
    where.push(
      options.searchEmail
        ? `("u"."name" ILIKE ${q} OR "u"."email" ILIKE ${q})`
        : `"u"."name" ILIKE ${q}`,
    );
  }
  if (options.roles?.length) {
    where.push(`"u"."role" = ANY (${params.add(options.roles)}::varchar[])`);
  }
  if (options.isActive !== undefined) {
    where.push(`"u"."is_active" = ${params.add(options.isActive)}`);
  }
  return where;
}

function keysetSql(
  options: DirectoryPageOptions,
  params: SqlParams,
): string | null {
  if (!options.cursor) return null;
  const { sortValue, id } = CursorCodec.decode(options.cursor);
  if (sortValue === null) throw invalidCursor();
  const { expression, cast } = SORT_SQL[options.sort.field];
  const op = options.sort.direction === 'ASC' ? '>' : '<';
  const value = `CAST(${params.add(String(sortValue))} AS ${cast})`;
  return `(${expression} ${op} ${value} OR (${expression} = ${value} AND "u"."id" ${op} ${params.add(id)}::uuid))`;
}

/**
 * Reads of the plant user directory (owner decision 2026-10-12 "Plant admin should see the users"): the
 * reviewed SECURITY DEFINER functions of the `PlantUserDirectory` migration, the only way past the
 * row-level security on `users`. Callers pass the acting tenant of the request context, never a parameter
 * of the request; the functions refuse a tenant the session is not bound to.
 */
@Injectable()
export class PlantUserDirectory {
  constructor(private readonly dataSource: DataSource) {}

  /** Members of the plant (home plant or a scope grant there), optionally only these ids. */
  async members(
    tenantId: string,
    ids?: readonly string[],
  ): Promise<DirectoryUser[]> {
    if (ids && ids.length === 0) return [];
    const rows: DirectoryRow[] = await this.dataSource.query(
      `SELECT * FROM app_plant_user_directory($1::uuid, $2::uuid[])`,
      [tenantId, ids ? [...new Set(ids)] : null],
    );
    return rows.map(toDirectoryUser);
  }

  /** The user with exactly this e-mail in the plant's organization (a first grant into the plant). */
  async byEmail(
    tenantId: string,
    email: string,
  ): Promise<DirectoryUser | undefined> {
    const rows: DirectoryRow[] = await this.dataSource.query(
      `SELECT * FROM app_organization_user_by_email($1::uuid, $2)`,
      [tenantId, email],
    );
    return rows.length === 1 ? toDirectoryUser(rows[0]) : undefined;
  }

  /** One user of the source, or undefined. */
  async one(
    source: UserSource,
    id: string,
  ): Promise<DirectoryUser | undefined> {
    const params = new SqlParams();
    const from = sourceSql(source, params);
    const rows: DirectoryRow[] = await this.dataSource.query(
      `SELECT * FROM (${from}) "u" WHERE "u"."id" = ${params.add(id)}::uuid`,
      params.values,
    );
    return rows[0] ? toDirectoryUser(rows[0]) : undefined;
  }

  /** One keyset page (CONVENTIONS §4) of the source, ordered by `(sort key, id)`. */
  async page(
    source: UserSource,
    options: DirectoryPageOptions,
  ): Promise<{ items: DirectoryUser[]; nextCursor: string | null }> {
    const params = new SqlParams();
    const from = sourceSql(source, params);
    const where = filtersSql(options, params);
    const keyset = keysetSql(options, params);
    if (keyset) where.push(keyset);
    const { expression } = SORT_SQL[options.sort.field];
    const direction = options.sort.direction === 'ASC' ? 'ASC' : 'DESC';
    const sql =
      `SELECT * FROM (${from}) "u"` +
      (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
      ` ORDER BY ${expression} ${direction}, "u"."id" ${direction}` +
      ` LIMIT ${params.add(options.limit + 1)}`;
    const rows: DirectoryRow[] = await this.dataSource.query(
      sql,
      params.values,
    );
    const items = rows.slice(0, options.limit).map(toDirectoryUser);
    const last = items[items.length - 1];
    const nextCursor =
      rows.length > options.limit && last
        ? CursorCodec.encode({
            sortValue: sortValueOf(last, options),
            id: last.id,
          })
        : null;
    return { items, nextCursor };
  }
}

function sortValueOf(
  user: DirectoryUser,
  options: DirectoryPageOptions,
): string {
  return options.sort.field === 'name'
    ? user.name
    : new Date(user.createdAt).toISOString();
}

/** `%`, `_` and `\` of a search text match literally in ILIKE. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
