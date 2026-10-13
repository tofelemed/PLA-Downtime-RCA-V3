import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CloseBlocker, closeBlockers } from '../domain/rca/close-gate';
import { RcaAction } from '../rca/entities/rca-action.entity';

const FIELDS: Readonly<Record<CloseBlocker, string>> = {
  ROOT_CAUSE_MISSING: 'rootCause',
  ACTIONS_NOT_DONE: 'actions',
};

const MESSAGES: Readonly<Record<CloseBlocker, string>> = {
  ROOT_CAUSE_MISSING: 'write down the root cause before closing the case',
  ACTIONS_NOT_DONE:
    'finish every action (done, or cancelled with a reason) before closing the case',
};

/** RCA-01: 422 CLOSE_BLOCKED, naming what is missing, when a case may not close yet. */
export async function assertClosable(
  manager: EntityManager,
  rca: { id: string; tenantId?: string | null },
  rootCause: string | null,
): Promise<void> {
  const actions = await manager.find(RcaAction, {
    select: { status: true },
    where: {
      rcaId: rca.id,
      ...(rca.tenantId ? { tenantId: rca.tenantId } : {}),
    },
  });
  const blockers = closeBlockers({
    rootCause,
    actionStatuses: actions.map((action) => action.status),
  });
  if (blockers.length === 0) return;
  throw new UnprocessableEntityException({
    code: 'CLOSE_BLOCKED',
    message: blockers.map((blocker) => MESSAGES[blocker]),
    fieldErrors: blockers.map((blocker) => ({
      field: FIELDS[blocker],
      message: MESSAGES[blocker],
    })),
  });
}
