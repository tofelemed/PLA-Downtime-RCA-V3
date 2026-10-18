import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ZERO } from '../domain/actuals/decimal';
import {
  BridgeFinding,
  bridgeFindings,
  BridgeLine,
} from '../domain/reconciliation/bridge-limits';
import { bridgeLimitsOf } from '../periods/reconciliation-options';
import {
  ToleranceJustification,
  toleranceJustification,
} from '../uncertainty/tolerance-justification';
import { ApprovalAction } from './entities/approval-action.entity';
import { ShapedLine } from './line-shape';
import { decOf, RevisionState } from './revision-state';
import { lineInvalid, separationOfDuties } from './workflow-errors';

/** SME R8 state of a revision's bridges: which exceed the limit and who reviewed this submission. */
export interface BridgeReviewState {
  overLimit: 'second_review' | 'refuse';
  findings: BridgeFinding[];
  /** a second independent review is needed before approval */
  required: boolean;
  review: { by: string | null; at: string } | null;
  /** SME E4: the uncertainty budget behind the absolute limit (expanded uncertainty, evidence); null = none */
  justification: ToleranceJustification | null;
}

const OWN_BRIDGE_ACTIONS = new Set(['manual', 'replace']);

function slicesOf(state: RevisionState) {
  return state.reconciliation.slices.map((s) => ({
    sliceId: s.sliceId,
    target: s.target,
  }));
}

/** The saved bridge lines of the revision above their slice's limit (the tolerance policy the run used). */
export function revisionBridgeFindings(state: RevisionState): BridgeFinding[] {
  const lines: BridgeLine[] = state.lines
    .filter((l) => l.kind === 'bridge' && OWN_BRIDGE_ACTIONS.has(l.action))
    .map((l) => ({
      ref: l.id,
      sliceId: l.sliceId,
      quantity: decOf(l.quantity) ?? ZERO,
    }));
  return bridgeFindings(
    lines,
    slicesOf(state),
    bridgeLimitsOf(state.tolerance.body),
  );
}

/** Draft save (SME R8 `refuse`): a bridge above the limit is refused with its line index (422 BRIDGE_OVER_LIMIT). */
export function assertBridgesWithinLimit(
  state: RevisionState,
  shaped: readonly ShapedLine[],
): void {
  const limits = bridgeLimitsOf(state.tolerance.body);
  if (limits.overLimit !== 'refuse') return;
  const lines: BridgeLine[] = shaped
    .filter((l) => l.kind === 'bridge' && l.quantity)
    .map((l) => ({
      ref: String(l.index),
      sliceId: l.sliceId,
      quantity: l.quantity ?? ZERO,
    }));
  const [first] = bridgeFindings(lines, slicesOf(state), limits);
  if (!first) return;
  throw lineInvalid(
    'BRIDGE_OVER_LIMIT',
    Number(first.ref),
    `a bridge of ${first.quantity} is above the ${first.basis} limit ${first.limit} of this unit: explain the loss instead`,
  );
}

/** The latest bridge review of the revision's current submission (same submitted hash), if any. */
async function latestReview(
  manager: EntityManager,
  state: RevisionState,
): Promise<ApprovalAction | null> {
  const { revision } = state;
  if (!revision.submittedHash) return null;
  return manager.findOne(ApprovalAction, {
    where: {
      revisionId: revision.id,
      action: 'bridge_review',
      submittedHash: revision.submittedHash,
    },
    order: { createdAt: 'DESC' },
  });
}

export async function bridgeReviewOf(
  manager: EntityManager,
  state: RevisionState,
): Promise<BridgeReviewState> {
  const limits = bridgeLimitsOf(state.tolerance.body);
  const { overLimit } = limits;
  const findings = revisionBridgeFindings(state);
  const review = await latestReview(manager, state);
  const justification = await toleranceJustification(
    manager,
    state.period.tenantId,
    {
      ...state.tolerance.body,
      value: limits.absolute ?? 0,
      uncertaintyBudgetId: limits.uncertaintyBudgetId,
    },
  );
  return {
    justification,
    overLimit,
    findings,
    required: overLimit === 'second_review' && findings.length > 0,
    review: review
      ? { by: review.actorId, at: review.createdAt.toISOString() }
      : null,
  };
}

/**
 * Approval gate (SME R8 `second_review`): a submission with a bridge above the limit needs a bridge review
 * of that submission by a second independent reviewer (409 BRIDGE_REVIEW_REQUIRED); the reviewer never
 * approves it as well (403 SEPARATION_OF_DUTIES), except SuperAdmin who may perform both steps.
 */
export async function assertBridgeReviewed(
  manager: EntityManager,
  state: RevisionState,
  approver: string,
  isSuperAdmin = false,
): Promise<void> {
  const current = await bridgeReviewOf(manager, state);
  if (!current.required) return;
  if (!current.review) {
    throw new ConflictException({
      code: 'BRIDGE_REVIEW_REQUIRED',
      message:
        'a bridge is above the unit limit: a second independent reviewer reviews it before approval',
      details: { findings: current.findings },
    });
  }
  if (!isSuperAdmin && current.review.by === approver)
    throw separationOfDuties();
}
