import { EffectivenessVerdict } from '../domain/rca/effectiveness';
import { ActionBaseline } from '../domain/rca/rca-verification';
import {
  CompletionAttachment,
  RcaAction,
  RcaActionType,
  StoredPostAction,
} from '../rca/entities/rca-action.entity';
import { ACTION_EVIDENCE, hasCompletionEvidence } from './action-completion';

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
  /** who checked the evidence and marked it done (never the owner) */
  completionVerifiedBy: string | null;
  verificationWindowStart: string | null;
  verificationWindowEnd: string | null;
  baseline: ActionBaseline | null;
  postAction: StoredPostAction | null;
  verificationStatus: VerificationStatus;
  /** CA2 verdict once evaluated (null before, and for baselines typed before CA3) */
  verdict: EffectivenessVerdict | null;
  /** the owner's claim, never added to approved or realized figures */
  claimedAvoidedLoss: { amount: string; currency: string | null } | null;
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
    verificationWindowStart: iso(action.verificationWindowStart),
    verificationWindowEnd: iso(action.verificationWindowEnd),
    baseline: action.baseline,
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
    createdAt: action.createdAt.toISOString(),
    rowVersion: action.rowVersion,
  };
}
