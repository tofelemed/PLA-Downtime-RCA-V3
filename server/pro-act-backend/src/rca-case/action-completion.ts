import { ForbiddenException } from '@nestjs/common';
import { RcaAction, RcaActionType } from '../rca/entities/rca-action.entity';
import { invalidBody } from './rca-scope';

/**
 * CA4 objective evidence expected per action type (shown with the action; the plant confirms the
 * checklist). A photo can supplement evidence but is not proof on its own.
 */
export const ACTION_EVIDENCE: Readonly<Record<RcaActionType, string>> = {
  repair: 'work-order operation and acceptance test',
  design_change: 'approved drawing / change record and commissioning evidence',
  procedure_change:
    'released procedure revision and implementation or training record',
  instrument_change: 'calibration or test results',
  training: 'attendance record and competence check',
  other: 'a reference to the record that proves the action was carried out',
};

const MIN_REFERENCE = 3;

/** A completion is evidenced by a written reference or an attached file (CA4). */
export function hasCompletionEvidence(action: {
  completionEvidenceRef: string | null;
  completionAttachments?: ReadonlyArray<unknown> | null;
}): boolean {
  const reference = action.completionEvidenceRef?.trim() ?? '';
  return (
    reference.length >= MIN_REFERENCE ||
    (action.completionAttachments?.length ?? 0) > 0
  );
}

/**
 * CA4 completion of an action (status becoming `done`): its type, objective evidence and a verifier who
 * is not its owner (the named verifier when the action names one); the completion date is the one given (never in the future) or now. Leaving `done`
 * clears the completion. Other edits leave the completion as it is.
 */
export function applyCompletion(
  previous: Pick<RcaAction, 'status'>,
  next: RcaAction,
  input: {
    actorId: string | null;
    completedAt: Date | null;
    now: Date;
    isSuperAdmin?: boolean;
  },
): void {
  if (next.status !== 'done') {
    if (previous.status === 'done') {
      next.completedAt = null;
      next.completionVerifiedBy = null;
    }
    return;
  }
  if (previous.status === 'done') {
    if (!hasCompletionEvidence(next)) throw evidenceRequired(next);
    return;
  }
  if (!next.actionType) {
    throw invalidBody(
      'ACTION_TYPE_REQUIRED',
      'actionType',
      'say what kind of action this is to know the evidence it needs',
    );
  }
  if (!hasCompletionEvidence(next)) throw evidenceRequired(next);
  if (!input.isSuperAdmin && next.ownerId && input.actorId === next.ownerId) {
    throw new ForbiddenException({
      code: 'SEPARATION_OF_DUTIES',
      message:
        'an action is marked done by someone who checks its evidence, not by its owner',
    });
  }
  if (
    !input.isSuperAdmin &&
    next.verifierId &&
    input.actorId !== next.verifierId
  ) {
    throw new ForbiddenException({
      code: 'NOT_THE_VERIFIER',
      message:
        'this action names its verifier; only that person checks the evidence and marks it done',
    });
  }
  if (input.completedAt && input.completedAt.getTime() > input.now.getTime()) {
    throw invalidBody(
      'INVALID_RANGE',
      'completedAt',
      'the completion date cannot be in the future',
    );
  }
  next.completedAt = input.completedAt ?? input.now;
  next.completionVerifiedBy = input.actorId;
}

function evidenceRequired(action: RcaAction) {
  const expected = action.actionType
    ? ACTION_EVIDENCE[action.actionType]
    : ACTION_EVIDENCE.other;
  return invalidBody(
    'EVIDENCE_REQUIRED',
    'completionEvidenceRef',
    `a done action needs objective evidence: ${expected}`,
  );
}
