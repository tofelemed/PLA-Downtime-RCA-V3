import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { ChangeRow, ChangeSource, FieldSpec } from './change-types';

/**
 * A kind whose pending record has an approved / effective predecessor: the explicit link the workflow
 * stores (`basedOnId`, `supersedesVersionId`, `supersedesId`) or else the latest approved version of the
 * same family (the version key the approve command locks) that starts at or before the pending one.
 */
export interface FamilyKind {
  entity: EntityTarget<ObjectLiteral>;
  /** version family properties; empty = only the explicit link */
  family: readonly string[];
  /** SQL on alias `v` selecting approved versions */
  approved: string;
  /** property holding the effective start (default `effectiveFrom`) */
  effective?: string;
  /** property of the pending record linking its predecessor */
  link?: string;
  beforeLabel?: string;
  project?: (row: ObjectLiteral) => ChangeRow;
  /** adds values read from related records (one query for every row) */
  decorate?: (
    manager: EntityManager,
    tenantId: string,
    rows: ChangeRow[],
  ) => Promise<void>;
  specs:
    | FieldSpec[]
    | ((after: ChangeRow, before: ChangeRow | null) => FieldSpec[]);
}

const byIds = (
  manager: EntityManager,
  kind: FamilyKind,
  tenantId: string,
  ids: readonly string[],
) =>
  ids.length === 0
    ? Promise.resolve([] as ObjectLiteral[])
    : manager
        .createQueryBuilder(kind.entity, 'r')
        .where('r.tenantId = :tenantId', { tenantId })
        .andWhere('r.id IN (:...ids)', { ids })
        .getMany();

/** Pending id → predecessor id over the version family, one query for every pending record. */
async function familyPredecessors(
  manager: EntityManager,
  kind: FamilyKind,
  tenantId: string,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (kind.family.length === 0 || ids.length === 0) return new Map();
  const effective = kind.effective ?? 'effectiveFrom';
  const same = kind.family
    .map((property) => `v.${property} IS NOT DISTINCT FROM d.${property}`)
    .join(' AND ');
  const rows = await manager
    .createQueryBuilder(kind.entity, 'd')
    .innerJoin(
      manager.connection.getMetadata(kind.entity).tablePath,
      'v',
      `v.tenantId = d.tenantId AND v.id <> d.id AND ${same} AND ${kind.approved} AND v.${effective} <= d.${effective}`,
    )
    .select('d.id', 'pendingId')
    .addSelect('v.id', 'predecessorId')
    .where('d.tenantId = :tenantId', { tenantId })
    .andWhere('d.id IN (:...ids)', { ids })
    .distinctOn(['d.id'])
    .orderBy('d.id')
    .addOrderBy(`v.${effective}`, 'DESC')
    .getRawMany<{ pendingId: string; predecessorId: string }>();
  return new Map(rows.map((row) => [row.pendingId, row.predecessorId]));
}

const plain = (row: ObjectLiteral): ChangeRow => ({ ...row });

/** Pending records of one family kind with their predecessors (three queries at most, plus `decorate`). */
export async function loadFamilyChanges(
  manager: EntityManager,
  kind: FamilyKind,
  tenantId: string,
  ids: readonly string[],
): Promise<ChangeSource[]> {
  const pending = await byIds(manager, kind, tenantId, ids);
  const linked = new Map<string, string>();
  for (const row of pending) {
    const target = kind.link ? (row[kind.link] as string | null) : null;
    if (target) linked.set(row.id as string, target);
  }
  const unlinked = pending
    .map((row) => row.id as string)
    .filter((id) => !linked.has(id));
  const found = await familyPredecessors(manager, kind, tenantId, unlinked);
  const predecessorOf = new Map([...found, ...linked]);
  const previous = await byIds(manager, kind, tenantId, [
    ...new Set(predecessorOf.values()),
  ]);
  const project = kind.project ?? plain;
  const rows = new Map(
    [...pending, ...previous].map((row) => [row.id as string, project(row)]),
  );
  await kind.decorate?.(manager, tenantId, [...rows.values()]);
  return pending.map((row) => {
    const after = rows.get(row.id as string) ?? {};
    const predecessorId = predecessorOf.get(row.id as string);
    const before = predecessorId ? (rows.get(predecessorId) ?? null) : null;
    const specs =
      typeof kind.specs === 'function' ? kind.specs(after, before) : kind.specs;
    return {
      id: row.id as string,
      after,
      before,
      specs,
      beforeLabel: kind.beforeLabel,
    };
  });
}
