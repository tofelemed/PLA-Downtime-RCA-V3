import { EntityManager, Not } from 'typeorm';
import {
  AccountingRevision,
  RevisionLifecycle,
} from '../accounting/entities/accounting-revision.entity';
import { RequestContext } from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { notFound } from '../profiles/profile-errors';
import { userRequired } from './workflow-errors';

/** The caller's user id (403 USER_REQUIRED without one). */
export function requireUser(context: RequestContext): string {
  if (!context.userId) throw userRequired();
  return context.userId;
}

/** A period of the acting tenant and the caller's unit scope; 404 otherwise (no existence leak, WF05). */
export async function periodInScope(
  manager: EntityManager,
  context: RequestContext,
  periodId: string,
): Promise<ProductionPeriod> {
  const period = await scopedQuery(
    manager.getRepository(ProductionPeriod),
    'p',
    { context, unitProperty: 'unitId' },
  )
    .andWhere('p.id = :periodId', { periodId })
    .getOne();
  if (!period) throw notFound('Production period');
  return period;
}

/**
 * Serializes a workflow command with the period's calculation runs (same advisory key as plan 2.5) and
 * locks the period row, so a recalculation never interleaves with a save, a submission or an approval.
 */
export async function lockPeriod(
  manager: EntityManager,
  periodId: string,
): Promise<void> {
  await manager.query(
    `SELECT pg_advisory_xact_lock(hashtext('calculation_run:' || $1))`,
    [periodId],
  );
  await manager.query(
    `SELECT 1 FROM "production_periods" WHERE "id" = $1 FOR UPDATE`,
    [periodId],
  );
}

/** Revision `number` of the period (404 when there is none), read after `lockPeriod`. */
export async function revisionNumbered(
  manager: EntityManager,
  periodId: string,
  revision: number,
): Promise<AccountingRevision> {
  const found = await manager.findOneBy(AccountingRevision, {
    periodId,
    revision,
  });
  if (!found) throw notFound('Accounting revision');
  return found;
}

/** The latest revision that is not cancelled (the open one, else the published approved one). */
export function latestRevision(
  manager: EntityManager,
  periodId: string,
): Promise<AccountingRevision | null> {
  return manager.findOne(AccountingRevision, {
    where: { periodId, lifecycle: Not<RevisionLifecycle>('cancelled') },
    order: { revision: 'DESC' },
  });
}

/** The published revision: the latest approved one, or null. */
export function publishedRevision(
  manager: EntityManager,
  periodId: string,
): Promise<AccountingRevision | null> {
  return manager.findOne(AccountingRevision, {
    where: { periodId, lifecycle: 'approved' },
    order: { revision: 'DESC' },
  });
}
