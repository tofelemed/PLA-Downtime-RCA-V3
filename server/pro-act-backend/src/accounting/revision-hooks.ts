import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AccountingRevision } from './entities/accounting-revision.entity';

/**
 * What happens when a period's inputs change while its latest revision is not a draft (plan 2.5 step 5,
 * interface for 2.8): an `in_review` revision is marked stale, an approved one is never touched and gets a
 * restatement proposal. 2.8 binds its implementation to this token; 2.5 only records the fact.
 */
export abstract class AccountingRevisionHooks {
  abstract onInputsChanged(
    manager: EntityManager,
    revision: AccountingRevision,
    inputHash: string,
  ): Promise<void>;
}

/** 2.5 binding: no workflow yet, so the change is logged and nothing is written. */
@Injectable()
export class DeferredRevisionHooks extends AccountingRevisionHooks {
  private readonly logger = new Logger(DeferredRevisionHooks.name);

  onInputsChanged(
    _manager: EntityManager,
    revision: AccountingRevision,
    inputHash: string,
  ): Promise<void> {
    this.logger.warn(
      `Inputs of period ${revision.periodId} changed (hash ${inputHash.slice(0, 12)}) while revision ${revision.revision} is ${revision.lifecycle}; stale marking and restatement proposals come with 2.8`,
    );
    return Promise.resolve();
  }
}
