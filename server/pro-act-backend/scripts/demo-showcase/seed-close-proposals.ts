/** Seed-only review of automatic proposals that changed metadata, not approved figures. */
import { isDeepStrictEqual } from 'node:util';
import type {
  MonthPrerequisites,
  OpenProposal,
} from '../../src/close/month-prerequisites';
import type { ProposalDecisionV2View } from '../../src/v2/reconciliation/change-proposals-v2.controller';
import type { ChangeProposalV2View } from '../../src/v2/reconciliation/reconciliation-v2.view';
import type { PersonaSession } from './showcase-client';
import type { ShowcaseContext } from './showcase-context';

interface ProposalMonth {
  monthKey: string;
  state: string;
  prerequisites: Pick<
    MonthPrerequisites,
    'openProposalCount' | 'openProposals'
  >;
}

const REASON =
  'Demo: independent manager review of an automatic event-change proposal. ' +
  'The before/after slices and ledgers are exactly unchanged and the preview has no issues; ' +
  'dismiss the metadata-only change and retain the approved accounting figures.';

function unchanged(proposal: ChangeProposalV2View): boolean {
  const { before, after } = proposal;
  if (!before || !after || !Array.isArray(after.issues) || after.issues.length)
    return false;
  return ['slices', 'ledgers'].every(
    (key) =>
      Array.isArray(before[key]) &&
      before[key].length > 0 &&
      Array.isArray(after[key]) &&
      isDeepStrictEqual(before[key], after[key]),
  );
}

async function review(
  manager: PersonaSession,
  item: OpenProposal,
): Promise<ChangeProposalV2View> {
  const proposal = await manager.get<ChangeProposalV2View>(
    `/v2/period-change-proposals/${item.proposalId}`,
  );
  if (
    proposal.id !== item.proposalId ||
    proposal.periodId !== item.periodId ||
    proposal.unitId !== item.unitId ||
    proposal.state !== 'open' ||
    proposal.trigger !== 'event_change' ||
    item.trigger !== 'event_change' ||
    item.manualReason !== null ||
    proposal.manual !== null ||
    Object.hasOwn(proposal.detail, 'manual') ||
    !unchanged(proposal)
  ) {
    throw new Error(
      `Month close blocked: proposal ${item.proposalId} is not an unchanged automatic event-change preview; review it manually`,
    );
  }
  return proposal;
}

async function dismiss(
  manager: PersonaSession,
  proposal: ChangeProposalV2View,
): Promise<void> {
  const result = await manager.post<ProposalDecisionV2View>(
    `/v2/period-change-proposals/${proposal.id}/dismiss`,
    { reason: REASON },
    `dismiss unchanged automatic event proposal ${proposal.id}`,
  );
  if (
    result.proposal.id !== proposal.id ||
    result.proposal.state !== 'dismissed' ||
    result.proposal.resolvedBy !== manager.userId ||
    result.proposal.resolutionReason !== REASON ||
    result.proposal.createdRevisionId !== null ||
    result.revision !== null
  ) {
    throw new Error(
      `Proposal ${proposal.id}: dismissal readback did not match`,
    );
  }
}

/** Never touches the deliberate manual proposal retained after the month is locked. */
export async function dismissUnchangedCloseProposals(
  ctx: Pick<ShowcaseContext, 'as' | 'tally'>,
  month: ProposalMonth,
): Promise<void> {
  if (month.state !== 'open') return;
  const { openProposalCount, openProposals } = month.prerequisites;
  if (
    !Array.isArray(openProposals) ||
    openProposalCount !== openProposals.length
  ) {
    throw new Error(
      `${month.monthKey}: incomplete open-proposal list; review manually`,
    );
  }
  if (openProposalCount === 0) return;
  const manager = ctx.as('managers', 1);
  if (!manager.userId) throw new Error('Proposal reviewer must be logged in');
  const reviewed: ChangeProposalV2View[] = [];
  for (const item of openProposals) reviewed.push(await review(manager, item));
  for (const proposal of reviewed) {
    await dismiss(manager, proposal);
    ctx.tally.add(
      'month close',
      1,
      0,
      `unchanged automatic proposal ${proposal.id} dismissed`,
    );
  }
}
