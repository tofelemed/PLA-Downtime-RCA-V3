import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { closedMonthOf } from '../close/month-lock';
import { RequestContext } from '../common/context/request-context';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { CORRECTION_PROPOSERS } from '../v2/periods/period-roles';
import { PeriodChangeProposal } from './entities/period-change-proposal.entity';
import { EvidenceType } from './line-evidence-rules';
import { beforeOf, upsertProposal } from './proposal-writer';
import {
  latestRevision,
  lockPeriod,
  periodInScope,
  publishedRevision,
} from './revision-access';
import { loadRevisionState } from './revision-state';
import { revisionMismatch } from './workflow-errors';
import { actorOf } from './workflow-recorder';

export const MANUAL_TRIGGER = 'manual_correction' as const;

export interface ManualProposalRequest {
  periodId: string;
  /** the published approved revision number the correction concerns */
  approvedRevision: number;
  reason: string;
  evidenceType: EvidenceType;
  evidenceRef: string;
}

/** What a user wrote on a manual proposal (kept in `detail.manual`). */
export interface ManualProposalDetail {
  proposedBy: string;
  reason: string;
  evidenceType: EvidenceType;
  evidenceRef: string;
}

/** The manual part of a proposal, or null for a system proposal. */
export function manualDetailOf(
  proposal: Pick<PeriodChangeProposal, 'detail'>,
): ManualProposalDetail | null {
  const manual = proposal.detail?.manual;
  if (!manual || typeof manual !== 'object') return null;
  return manual as ManualProposalDetail;
}

/**
 * Separation of duties of a manual proposal: whoever proposed the correction never accepts or dismisses it
 * (403 SEPARATION_OF_DUTIES, all non-SuperAdmin roles).
 */
export function assertNotProposer(
  proposal: PeriodChangeProposal,
  userId: string,
  isSuperAdmin = false,
): void {
  const manual = manualDetailOf(proposal);
  if (!isSuperAdmin && manual && manual.proposedBy === userId) {
    throw new ForbiddenException({
      code: 'SEPARATION_OF_DUTIES',
      message:
        'a manual change proposal is accepted or dismissed by someone other than its proposer',
    });
  }
}

/** 409 PROPOSAL_OPEN: one open proposal per approved revision (system or manual). */
function proposalOpen(id: string): ConflictException {
  return new ConflictException({
    code: 'PROPOSAL_OPEN',
    message:
      'a change proposal of this approved revision is already open; decide it first',
    details: { proposalId: id },
  });
}

/**
 * Opens a manual change proposal (SME R4): a user proposes a correction of the published approved revision of
 * a period in a closing or locked month, with a reason and evidence. The figures before are the approved
 * ones; the figures after are calculated when the proposal is accepted (a revise draft, marked `afterClose`
 * in a locked month). Audited; outbox `PeriodChangeProposed`.
 */
export async function proposeCorrection(
  manager: EntityManager,
  context: RequestContext & { userId: string },
  request: ManualProposalRequest,
  policies: AccountingPoliciesService,
): Promise<PeriodChangeProposal> {
  const period = await periodInScope(
    manager,
    context,
    request.periodId,
    CORRECTION_PROPOSERS,
  );
  await lockPeriod(manager, period.id);
  await closedMonthOf(manager, period);
  const approved = await publishedRevision(manager, period.id);
  if (!approved || approved.revision !== request.approvedRevision) {
    throw revisionMismatch('published', approved?.revision ?? null);
  }
  const latest = await latestRevision(manager, period.id);
  if (latest && latest.id !== approved.id) {
    throw new ConflictException({
      code: 'REVISION_OPEN',
      message: `revision ${latest.revision} of the period is ${latest.lifecycle}; finish or cancel it first`,
    });
  }
  const open = await manager.findOneBy(PeriodChangeProposal, {
    approvedRevisionId: approved.id,
    state: 'open',
  });
  if (open) throw proposalOpen(open.id);
  const state = await loadRevisionState(manager, period, approved, policies);
  const manual: ManualProposalDetail = {
    proposedBy: context.userId,
    reason: request.reason,
    evidenceType: request.evidenceType,
    evidenceRef: request.evidenceRef.trim(),
  };
  return upsertProposal(
    manager,
    {
      period,
      approved,
      trigger: MANUAL_TRIGGER,
      inputHash: null,
      before: beforeOf(state),
      after: null,
      detail: { manual },
    },
    actorOf(context),
  );
}
