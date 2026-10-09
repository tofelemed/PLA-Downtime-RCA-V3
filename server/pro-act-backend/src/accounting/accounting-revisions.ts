import { EntityManager, Not } from 'typeorm';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import {
  AccountingRevision,
  RevisionLifecycle,
} from './entities/accounting-revision.entity';

/**
 * The revision a recalculation writes into: the latest revision that is not cancelled — the period's
 * draft, or an `in_review` / `approved` one that the caller must not write a run into (2.8 marks it stale
 * or opens a change proposal); revision 1 on the first run, a new draft when every revision so far was
 * cancelled. A revise draft over an approved revision is the latest one, so it is recalculated.
 */
export async function draftRevisionOf(
  manager: EntityManager,
  period: ProductionPeriod,
  actorId: string | null,
): Promise<AccountingRevision> {
  const current = await manager.findOne(AccountingRevision, {
    where: {
      periodId: period.id,
      lifecycle: Not<RevisionLifecycle>('cancelled'),
    },
    order: { revision: 'DESC' },
  });
  if (current) return current;
  const latest = await manager.findOne(AccountingRevision, {
    where: { periodId: period.id },
    order: { revision: 'DESC' },
  });
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
