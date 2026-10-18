import {
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  SelectQueryBuilder,
} from 'typeorm';
import { VersionRef, VersionState } from '../domain/profiles/profile.types';
import { planApproval } from '../domain/profiles/version-window';
import {
  assertNotAuthor,
  invalidTransition,
  isExclusionViolation,
  notFound,
  versionOverlap,
} from './profile-errors';

/** Columns shared by profiles, unit-product rates and valuation rates. */
export interface Versioned extends ObjectLiteral {
  id: string;
  version: number;
  state: VersionState;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  /** the draft's author: requires another approver unless SuperAdmin (403 SEPARATION_OF_DUTIES) */
  createdBy: string | null;
  updatedBy: string | null;
}

/** The identity of a version family: property → value (null = IS NULL). */
export type VersionKey = Record<string, string | null>;

export interface ApproveCommand {
  id: string;
  key: VersionKey;
  supersede: boolean;
  actorId: string | null;
  /** Resolved by authentication, never accepted from the request body. */
  isSuperAdmin?: boolean;
}

export interface ApproveResult<T> {
  approved: T;
  /** the predecessor closed at the approved version's `from` */
  superseded: T | null;
}

export function refOf(row: Versioned): VersionRef {
  return {
    id: row.id,
    version: row.version,
    from: row.effectiveFrom,
    to: row.effectiveTo,
  };
}

/** Serialises writers of one version family for the rest of the transaction. */
async function lockKey(
  manager: EntityManager,
  table: string,
  key: VersionKey,
): Promise<void> {
  const parts = Object.keys(key)
    .sort()
    .map((property) => `${property}=${key[property] ?? ''}`);
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `${table}:${parts.join(':')}`,
  ]);
}

function whereKey<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  key: VersionKey,
): SelectQueryBuilder<T> {
  Object.entries(key).forEach(([property, value], i) => {
    if (value === null) qb.andWhere(`v.${property} IS NULL`);
    else qb.andWhere(`v.${property} = :key${i}`, { [`key${i}`]: value });
  });
  return qb;
}

/** Next version number of a family (1 for the first), under the family lock. */
export async function nextVersion<T extends Versioned>(
  manager: EntityManager,
  target: EntityTarget<T>,
  key: VersionKey,
): Promise<number> {
  await lockKey(manager, manager.getRepository(target).metadata.tableName, key);
  const qb = whereKey(
    manager
      .createQueryBuilder(target, 'v')
      .select('COALESCE(MAX(v.version), 0)', 'max'),
    key,
  );
  const row = await qb.getRawOne<{ max: number | string }>();
  return Number(row?.max ?? 0) + 1;
}

/**
 * Approves a draft (plan 2.2): refused with 403 `SEPARATION_OF_DUTIES` when a non-SuperAdmin actor created the draft,
 * and with 409 `VERSION_OVERLAP` (naming the conflicting versions)
 * when it would overlap an approved version of its family, unless `supersede` lets it close its one
 * predecessor exactly at its `from` (half-open, so no instant is covered twice or lost). The exclusion
 * constraint backs this up against concurrent approvals.
 */
export async function approveVersion<T extends Versioned>(
  manager: EntityManager,
  target: EntityTarget<T>,
  command: ApproveCommand,
  what: string,
): Promise<ApproveResult<T>> {
  const table = manager.getRepository(target).metadata.tableName;
  await lockKey(manager, table, command.key);
  const row = await lockRow(manager, target, command.id, what);
  if (row.state !== 'draft')
    throw invalidTransition(what, row.state, 'approved');
  assertNotAuthor(row, command.actorId, what, command.isSuperAdmin);
  const approved = await whereKey(
    manager
      .createQueryBuilder(target, 'v')
      .where(`v.state = 'approved' AND v.id <> :id`, { id: row.id }),
    command.key,
  ).getMany();
  const plan = planApproval(refOf(row), approved.map(refOf), command.supersede);
  if (plan.conflicts.length > 0) throw versionOverlap(what, plan.conflicts);
  const predecessor = plan.supersede
    ? (approved.find((v) => v.id === plan.supersede?.id) ?? null)
    : null;
  try {
    if (predecessor && plan.supersede) {
      predecessor.effectiveTo = plan.supersede.effectiveTo;
      predecessor.updatedBy = command.actorId;
      await manager.save(predecessor);
    }
    Object.assign(row, {
      state: 'approved',
      approvedBy: command.actorId,
      approvedAt: new Date(),
      updatedBy: command.actorId,
    });
    return { approved: await manager.save(row), superseded: predecessor };
  } catch (error: unknown) {
    if (isExclusionViolation(error)) throw versionOverlap(what, []);
    throw error;
  }
}

/** draft or approved → retired (an approved row is never edited otherwise). */
export async function retireVersion<T extends Versioned>(
  manager: EntityManager,
  target: EntityTarget<T>,
  command: { id: string; actorId: string | null },
  what: string,
): Promise<T> {
  const row = await lockRow(manager, target, command.id, what);
  if (row.state === 'retired')
    throw invalidTransition(what, row.state, 'retired');
  row.state = 'retired';
  row.updatedBy = command.actorId;
  return manager.save(row);
}

async function lockRow<T extends Versioned>(
  manager: EntityManager,
  target: EntityTarget<T>,
  id: string,
  what: string,
): Promise<T> {
  const row = await manager
    .createQueryBuilder(target, 'v')
    .setLock('pessimistic_write')
    .where('v.id = :id', { id })
    .getOne();
  if (!row) throw notFound(what);
  return row;
}
