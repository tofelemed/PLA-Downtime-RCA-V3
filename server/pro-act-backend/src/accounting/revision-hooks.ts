import { EntityManager } from 'typeorm';
import { PeriodAccounting } from '../domain/accounting/accounting.types';
import { RecomputeTrigger } from '../periods/period-recompute.port';
import { AccountingRevision } from './entities/accounting-revision.entity';

/** A recalculation found other inputs than the revision's run while the revision is not a draft. */
export interface InputsChange {
  inputHash: string;
  trigger: RecomputeTrigger;
  /** both ledgers from the new inputs, computed on demand and never written as a run */
  preview: () => PeriodAccounting;
}

/**
 * What happens when a period's inputs change while its latest revision is not a draft (plan 2.5 step 5,
 * bound by 2.8 to `WorkflowRevisionHooks`): an `in_review` revision is marked stale, an approved one is
 * never touched and gets a change proposal with before / after totals.
 */
export abstract class AccountingRevisionHooks {
  abstract onInputsChanged(
    manager: EntityManager,
    revision: AccountingRevision,
    change: InputsChange,
  ): Promise<void>;
}
