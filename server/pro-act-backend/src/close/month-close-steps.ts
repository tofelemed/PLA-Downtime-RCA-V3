import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  MonthCloseAction,
  MonthCloseState,
} from '../domain/close/month-close-machine';
import { MonthClose } from './entities/month-close.entity';

export interface MonthCloseStep {
  row: MonthClose;
  action: MonthCloseAction;
  to: MonthCloseState;
  actor: string;
  comment: string | null;
  /** materiality findings at this step (fixed on the quantity close) */
  materialityRequired: boolean;
}

/** A reopen clears every sign-off: the month is reconciled and closed again from scratch. */
const SIGN_OFFS_CLEARED: QueryDeepPartialEntity<MonthClose> = {
  quantitiesClosedBy: null,
  quantitiesClosedAt: null,
  financeSignedOffBy: null,
  financeSignedOffAt: null,
  materialityRequired: false,
  materialityReviewedBy: null,
  materialityReviewedAt: null,
};

function columnsOf(
  step: MonthCloseStep,
  at: Date,
): QueryDeepPartialEntity<MonthClose> {
  const { actor } = step;
  switch (step.action) {
    case 'close_quantities':
      return {
        quantitiesClosedBy: actor,
        quantitiesClosedAt: at,
        materialityRequired: step.materialityRequired,
      };
    case 'review_materiality':
      return { materialityReviewedBy: actor, materialityReviewedAt: at };
    case 'sign_off_finance':
      return { financeSignedOffBy: actor, financeSignedOffAt: at };
    case 'lock':
      return { lockedBy: actor, lockedAt: at };
    case 'reopen':
      return { ...SIGN_OFFS_CLEARED, reopenCount: step.row.reopenCount + 1 };
  }
}

/** The row columns of one allowed step (state, sign-off, comment). */
export async function applyStep(
  manager: EntityManager,
  step: MonthCloseStep,
): Promise<void> {
  await manager.update(MonthClose, step.row.id, {
    ...columnsOf(step, new Date()),
    state: step.to,
    comment: step.comment ?? step.row.comment,
    updatedBy: step.actor,
  });
}
