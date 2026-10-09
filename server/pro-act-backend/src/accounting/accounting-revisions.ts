import { EntityManager } from 'typeorm';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { AccountingRevision } from './entities/accounting-revision.entity';

/**
 * The revision a recalculation writes into: the period's draft; revision 1 on the first run; a new draft
 * after a cancelled one. When the latest revision is `in_review` or `approved` it is returned as is and
 * the caller must not write a run into it (2.8 decides between stale marking and a restatement proposal).
 */
export async function draftRevisionOf(
  manager: EntityManager,
  period: ProductionPeriod,
  actorId: string | null,
): Promise<AccountingRevision> {
  const latest = await manager.findOne(AccountingRevision, {
    where: { periodId: period.id },
    order: { revision: 'DESC' },
  });
  if (latest && latest.lifecycle !== 'cancelled') return latest;
  return manager.save(
    manager.create(AccountingRevision, {
      tenantId: period.tenantId,
      periodId: period.id,
      revision: (latest?.revision ?? 0) + 1,
      lifecycle: 'draft',
      supersedesId: null,
      inputHash: null,
      currentRunId: null,
      createdBy: actorId,
    }),
  );
}
