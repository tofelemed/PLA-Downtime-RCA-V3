import { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { staleRevision } from '../../../common/concurrency/revision';

/**
 * `UPDATE … WHERE id = :id AND row_version = :expected` (API02); the version column is bumped by TypeORM.
 * Nothing updated → 412 STALE_REVISION (the caller already checked that the row exists in its scope).
 * `changes` may hold `null` to clear an optional column (the legacy entities type them as `?: string`).
 */
export async function updateWithRevision<T extends ObjectLiteral>(
  manager: EntityManager,
  entity: EntityTarget<T>,
  target: { id: string; expectedVersion: number },
  changes: { [K in keyof T]?: T[K] | null },
): Promise<void> {
  const result = await manager
    .createQueryBuilder()
    .update(entity)
    .set(changes)
    .where('id = :id AND row_version = :expected', {
      id: target.id,
      expected: target.expectedVersion,
    })
    .execute();
  if (!result.affected) throw staleRevision();
}

/** Keeps only the keys whose value is not `undefined` (a PATCH changes only what it names). */
export function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

/** A required text field of a PATCH: `null` and `undefined` both mean "unchanged". */
export function keepUnlessGiven(
  value: string | null | undefined,
): string | undefined {
  return value === null ? undefined : value;
}
