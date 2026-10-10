import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  ChangeValues,
  MUTABLE_COLUMNS,
  MutableTable,
  RowChange,
} from './remediation-types';

/** Bookkeeping columns refreshed on every update (ETag / audit) — never part of a before/after guard. */
const TOUCH: Partial<Record<MutableTable, string>> = {
  production_events: `"updated_at" = now(), "row_version" = "row_version" + 1`,
  production_plans: `"updated_at" = now()`,
  feature_flags: `"updated_at" = now(), "row_version" = "row_version" + 1`,
};
const UNGUARDED: ReadonlySet<string> = new Set(['row_version']);

/** Rows affected by a TypeORM postgres query result (`[rows, count]` for UPDATE / DELETE). */
export function affectedRows(result: unknown): number {
  if (!Array.isArray(result)) return 0;
  if (typeof result[1] === 'number') return result[1];
  return result.length;
}

function assertColumns(table: MutableTable, values: ChangeValues): string[] {
  const allowed: readonly string[] = MUTABLE_COLUMNS[table] ?? [];
  const columns = Object.keys(values);
  const unknown = columns.filter((column) => !allowed.includes(column));
  if (unknown.length > 0 || allowed.length === 0) {
    throw new Error(`Column(s) ${unknown.join(', ')} of ${table} not writable`);
  }
  return columns;
}

/** `"c1" IS NOT DISTINCT FROM $n AND ...` over the guarded columns of `values`. */
function guard(
  values: ChangeValues,
  offset: number,
  params: unknown[],
): string {
  const parts = Object.keys(values)
    .filter((column) => !UNGUARDED.has(column))
    .map((column) => {
      params.push(values[column]);
      return `"${column}" IS NOT DISTINCT FROM $${offset + params.length}`;
    });
  return parts.length > 0 ? parts.join(' AND ') : 'TRUE';
}

/** UPDATE guarded by `expected`; throws 409 when the row changed meanwhile (or is gone). */
async function updateGuarded(
  manager: EntityManager,
  change: { table: MutableTable; rowId: string },
  set: ChangeValues,
  expected: ChangeValues,
): Promise<void> {
  const columns = assertColumns(change.table, set);
  const params: unknown[] = columns.map((column) => set[column]);
  const assignments = columns.map((column, i) => `"${column}" = $${i + 1}`);
  const touch = TOUCH[change.table];
  if (touch) assignments.push(touch);
  params.push(change.rowId);
  const idParam = params.length;
  const condition = guard(expected, 0, params);
  const result: unknown = await manager.query(
    `UPDATE "${change.table}" SET ${assignments.join(', ')} WHERE "id" = $${idParam} AND ${condition}`,
    params,
  );
  if (affectedRows(result) !== 1) {
    throw new ConflictException({
      code: 'MIGRATION_ROW_CHANGED',
      message: `${change.table} ${change.rowId} no longer holds the expected values; nothing was written`,
    });
  }
}

async function insertRow(
  manager: EntityManager,
  change: RowChange,
): Promise<void> {
  const columns = assertColumns(change.table, change.after);
  const params: unknown[] = [
    change.rowId,
    ...columns.map((column) => change.after[column]),
  ];
  const names = ['"id"', ...columns.map((column) => `"${column}"`)];
  const placeholders = params.map((_, i) => `$${i + 1}`);
  await manager.query(
    `INSERT INTO "${change.table}" (${names.join(', ')}) VALUES (${placeholders.join(', ')})`,
    params,
  );
}

/** Applies one planned change. */
export async function applyChange(
  manager: EntityManager,
  change: RowChange,
): Promise<void> {
  if (change.kind === 'insert') return insertRow(manager, change);
  await updateGuarded(manager, change, change.after, change.before ?? {});
}

/** Undoes one recorded change; refuses (409) when the row moved since the run. */
export async function undoChange(
  manager: EntityManager,
  change: RowChange,
): Promise<void> {
  if (change.kind === 'update') {
    await updateGuarded(manager, change, change.before ?? {}, change.after);
    return;
  }
  const params: unknown[] = [change.rowId];
  const condition = guard(change.after, 0, params);
  const result: unknown = await manager.query(
    `DELETE FROM "${change.table}" WHERE "id" = $1 AND ${condition}`,
    params,
  );
  if (affectedRows(result) !== 1) {
    throw new ConflictException({
      code: 'MIGRATION_ROW_CHANGED',
      message: `${change.table} ${change.rowId} changed after the run; revert refused`,
    });
  }
}

/** Multi-row INSERT ... ON CONFLICT DO NOTHING in chunks; returns how many rows were inserted. */
export async function bulkInsert(
  manager: EntityManager,
  table: string,
  columns: readonly string[],
  rows: ReadonlyArray<readonly unknown[]>,
): Promise<number> {
  const CHUNK = 500;
  let inserted = 0;
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const params: unknown[] = [];
    const tuples = chunk.map((row) => {
      const slots = row.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `(${slots.join(', ')})`;
    });
    const result: unknown = await manager.query(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES ${tuples.join(', ')} ON CONFLICT DO NOTHING RETURNING "id"`,
      params,
    );
    inserted += affectedRows(result);
  }
  return inserted;
}
