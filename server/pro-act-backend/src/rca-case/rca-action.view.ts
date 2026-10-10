import { ActionBaseline } from '../domain/rca/rca-verification';
import { RcaAction, StoredPostAction } from '../rca/entities/rca-action.entity';

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
  completionEvidenceRef: string | null;
  completedAt: string | null;
  verificationWindowStart: string | null;
  verificationWindowEnd: string | null;
  baseline: ActionBaseline | null;
  postAction: StoredPostAction | null;
  verificationStatus: VerificationStatus;
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
    completionEvidenceRef: action.completionEvidenceRef,
    completedAt: iso(action.completedAt),
    verificationWindowStart: iso(action.verificationWindowStart),
    verificationWindowEnd: iso(action.verificationWindowEnd),
    baseline: action.baseline,
    postAction: action.postAction,
    verificationStatus: verificationStatusOf(action, now),
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
