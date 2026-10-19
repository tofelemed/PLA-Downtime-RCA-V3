import { In, EntityManager } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { AccountingPoliciesService } from '../../periods/accounting-policies.service';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { PeriodChangeProposal } from '../../reconciliation/entities/period-change-proposal.entity';
import {
  approvedValuesPart,
  ProposalValues,
} from '../../reconciliation/proposal-values';
import { loadRevisionState } from '../../reconciliation/revision-state';

/**
 * The loss value after an accepted change proposal (QA audit 2026-10-19, P-1): the default-view value of
 * the revision the acceptance opened, as it stands now (its lifecycle says whether it is approved yet).
 * Open and dismissed proposals have none — the value is known only once a revision exists.
 */
export interface ProposalAfterValues {
  revision: number;
  lifecycle: string;
  values: ProposalValues | null;
}

/** One revision state per accepted proposal of the page (a period has few proposals). */
export async function proposalAfterValues(
  manager: EntityManager,
  policies: AccountingPoliciesService,
  proposals: readonly PeriodChangeProposal[],
): Promise<Map<string, ProposalAfterValues>> {
  const accepted = proposals.filter(
    (p) => p.state === 'accepted' && p.createdRevisionId !== null,
  );
  const result = new Map<string, ProposalAfterValues>();
  if (accepted.length === 0) return result;
  const revisions = await manager.findBy(AccountingRevision, {
    id: In(accepted.map((p) => p.createdRevisionId as string)),
  });
  const periods = await manager.findBy(ProductionPeriod, {
    id: In([...new Set(accepted.map((p) => p.periodId))]),
  });
  for (const proposal of accepted) {
    const revision = revisions.find((r) => r.id === proposal.createdRevisionId);
    const period = periods.find((p) => p.id === proposal.periodId);
    if (!revision || !period) continue;
    const state = await loadRevisionState(manager, period, revision, policies);
    result.set(proposal.id, {
      revision: revision.revision,
      lifecycle: revision.lifecycle,
      values: approvedValuesPart(state).values ?? null,
    });
  }
  return result;
}
