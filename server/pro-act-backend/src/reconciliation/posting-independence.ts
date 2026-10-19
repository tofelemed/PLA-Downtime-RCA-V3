import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { PeriodChangeProposal } from './entities/period-change-proposal.entity';
import { manualDetailOf } from './manual-proposal';

/** Why the proposer of a correction does not set the posting of its restatement (inbox and 403). */
export const POSTING_PROPOSER_REASON =
  'This restatement comes from your change proposal; a different finance approver must set its posting date and treatment.';

/**
 * Separation of duties of a restatement posting (owner decision 2026-10-19): the finance approver who sets
 * the posting date and treatment is not the person who proposed the correction (the manual change proposal
 * whose acceptance opened the revision). Restatements a recalculation, a late event or a valuation change
 * opened have no human proposer, so they never conflict. SuperAdmin may decide, as for other self-decisions.
 * 403 SEPARATION_OF_DUTIES.
 */
export async function assertPostingIndependent(
  manager: EntityManager,
  context: RequestContext,
  revision: { id: string; tenantId: string },
): Promise<void> {
  if (context.isSuperAdmin || !context.userId) return;
  const proposal = await manager.findOne(PeriodChangeProposal, {
    where: { tenantId: revision.tenantId, createdRevisionId: revision.id },
    order: { createdAt: 'ASC' },
  });
  const manual = proposal ? manualDetailOf(proposal) : null;
  if (manual?.proposedBy !== context.userId) return;
  throw new ForbiddenException({
    code: 'SEPARATION_OF_DUTIES',
    message: POSTING_PROPOSER_REASON,
  });
}
