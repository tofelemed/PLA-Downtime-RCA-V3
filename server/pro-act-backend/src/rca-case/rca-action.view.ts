import { isSelfDecision } from '../domain/approvals/self-decision';
import { EffectivenessVerdict } from '../domain/rca/effectiveness';
import { ActionBaseline } from '../domain/rca/rca-verification';
import {
  CompletionAttachment,
  RcaAction,
  RcaActionType,
  StoredPostAction,
} from '../rca/entities/rca-action.entity';
import { ACTION_EVIDENCE, hasCompletionEvidence } from './action-completion';
import { RcaActionTaskV2View } from './action-tasks';
import { frozenPolicyVersion } from './baseline-policy-version';

export type VerificationStatus =
  | 'not_planned'
  | 'pending'
  | 'due'
  | 'evaluated';

export interface RcaActionV2View {
  id: string;
  rcaId: string;
  title: string;
  description: string | null;
  ownerId: string | null;
  dueDate: string | null;
  status: string;
  /** CA4 */
  actionType: RcaActionType | null;
  /** the objective evidence this type of action needs (CA4 checklist) */
  evidenceExpected: string;
  completionEvidenceRef: string | null;
  completionAttachments: CompletionAttachment[];
  hasEvidence: boolean;
  completedAt: string | null;
  /** who checked the evidence and marked it done (never the owner, except a SuperAdmin) */
  completionVerifiedBy: string | null;
  /** item 1.3: marked done by its own owner — a SuperAdmin self-decision (owner decision 2026-10-16) */
  selfDecided: boolean;
  /** item 1.3: the baseline correction was decided by its proposer (SuperAdmin only) */
  baselineCorrectionSelfDecided: boolean;
  verificationWindowStart: string | null;
  verificationWindowEnd: string | null;
  /** CA4: how the completion is verified (null = not stated) */
  verificationMethod: string | null;
  /** CA4: the named verifier, never the owner (null = any RCA writer other than the owner) */
  verifierId: string | null;
  /** the verification window is fixed once the action is done (changes answer 409 VERIFICATION_WINDOW_LOCKED) */
  verificationWindowLocked: boolean;
  baseline: ActionBaseline | null;
  /**
   * QA L11: the RCA policy version the baseline's thresholds come from — frozen with them since 19 Oct 2026,
   * else (list reads) the version in force when the baseline was computed; null without a baseline
   */
  baselinePolicyVersion: number | null;
  postAction: StoredPostAction | null;
  verificationStatus: VerificationStatus;
  /** CA2 verdict once evaluated (null before, and for baselines typed before CA3) */
  verdict: EffectivenessVerdict | null;
  /** the owner's claim, never added to approved or realized figures */
  claimedAvoidedLoss: { amount: string; currency: string | null } | null;
  /** F-9: why, who and when, while the action is cancelled (null otherwise or when no reason was given) */
  cancelReason: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  /** item 5: the case recommendation this action implements */
  recommendationId: string | null;
  /** item 5: the task carrying out this action (null without one) */
  linkedTask: RcaActionTaskV2View | null;
  /** item 5: when the linked task was completed — recorded only, the action still needs its evidence */
  taskCompletedAt: string | null;
  createdAt: string;
  rowVersion: number;
}

const iso = (value: Date | null) => (value ? value.toISOString() : null);

export function verificationStatusOf(
  action: RcaAction,
  now: Date,
): VerificationStatus {
  if (action.postAction) return 'evaluated';
  if (!action.verificationWindowEnd || !action.baseline) return 'not_planned';
  return action.verificationWindowEnd.getTime() <= now.getTime()
    ? 'due'
    : 'pending';
}

export function toActionView(
  action: RcaAction,
  now = new Date(),
  task: RcaActionTaskV2View | null = null,
): RcaActionV2View {
  return {
    id: action.id,
    rcaId: action.rcaId,
    title: action.title,
    description: action.description,
    ownerId: action.ownerId,
    dueDate: iso(action.dueDate),
    status: action.status,
    actionType: action.actionType,
    evidenceExpected: ACTION_EVIDENCE[action.actionType ?? 'other'],
    completionEvidenceRef: action.completionEvidenceRef,
    completionAttachments: action.completionAttachments ?? [],
    hasEvidence: hasCompletionEvidence(action),
    completedAt: iso(action.completedAt),
    completionVerifiedBy: action.completionVerifiedBy,
    selfDecided: isSelfDecision(action.completionVerifiedBy, [action.ownerId]),
    baselineCorrectionSelfDecided: isSelfDecision(
      action.baseline?.correction?.decidedBy,
      [action.baseline?.correction?.proposedBy],
    ),
    verificationWindowStart: iso(action.verificationWindowStart),
    verificationWindowEnd: iso(action.verificationWindowEnd),
    verificationMethod: action.verificationMethod ?? null,
    verifierId: action.verifierId ?? null,
    verificationWindowLocked: action.status === 'done',
    baseline: action.baseline,
    baselinePolicyVersion: frozenPolicyVersion(action) ?? null,
    postAction: action.postAction,
    verificationStatus: verificationStatusOf(action, now),
    verdict: action.postAction?.effectiveness?.verdict ?? null,
    claimedAvoidedLoss:
      action.claimedAvoidedLoss === null
        ? null
        : {
            amount: action.claimedAvoidedLoss,
            currency: action.claimedCurrency,
          },
    cancelReason: action.cancelReason ?? null,
    cancelledBy: action.cancelledBy ?? null,
    cancelledAt: iso(action.cancelledAt ?? null),
    recommendationId: action.recommendationId ?? null,
    linkedTask: task,
    taskCompletedAt: iso(action.taskCompletedAt ?? null),
    createdAt: action.createdAt.toISOString(),
    rowVersion: action.rowVersion,
  };
}
