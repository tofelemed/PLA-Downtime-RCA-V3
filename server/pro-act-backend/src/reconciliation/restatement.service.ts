import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { AccountingRevision } from '../accounting/entities/accounting-revision.entity';
import { appendAudit } from '../common/audit/audit-trail';
import { RequestContext } from '../common/context/request-context';
import {
  restatementDelta,
  RestatementDelta,
} from '../domain/reconciliation/restatement-delta';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { ProductionPeriod } from '../periods/entities/production-period.entity';
import { invalid } from '../profiles/profile-errors';
import { POSTING_DECIDERS } from '../v2/close/close-roles';
import {
  PostingTreatment,
  RestatementPosting,
} from './entities/restatement-posting.entity';
import { approvedValuesPart } from './proposal-values';
import { figuresOf } from './restatement-figures';
import { restatementValues, RestatementValues } from './restatement-values';
import { assertPostingIndependent } from './posting-independence';
import {
  latestRevision,
  lockPeriod,
  periodInScope,
  requireUser,
  revisionNumbered,
} from './revision-access';
import { loadRevisionState } from './revision-state';

export interface Restatement {
  period: ProductionPeriod;
  revision: AccountingRevision;
  superseded: AccountingRevision;
  delta: RestatementDelta;
  /** loss value per currency, each side in its own default valuation view (QA audit P-2) */
  values: RestatementValues | null;
  posting: RestatementPosting | null;
  /** display name of the finance approver who decided the posting */
  decidedByName: string | null;
}

export interface PostingDecision {
  postingDate: string;
  treatment: PostingTreatment;
  note: string | null;
}

/**
 * Owner decision 2026-10-19 (closed records are frozen): a decided posting is final — 409 POSTING_DECIDED.
 * The correction path is a new restatement: propose a correction of the period, whose new approved revision
 * gets its own posting decision; the decided row is never overwritten.
 */
function assertPostingOpen(posting: RestatementPosting | null): void {
  if (!posting) return;
  throw new ConflictException({
    code: 'POSTING_DECIDED',
    message:
      'finance has already decided the posting of this restatement; correct it through a new restatement (propose a correction of the period)',
  });
}

async function nameOf(
  manager: EntityManager,
  userId: string,
): Promise<string | null> {
  const rows: Array<{ name: string }> = await manager.query(
    'SELECT "name" FROM "users" WHERE "id" = $1::uuid',
    [userId],
  );
  return rows[0]?.name ?? null;
}

/**
 * Restatements of approved periods (SME R5, phase R-D): the delta of a revision against the approved
 * revision it supersedes (old vs new totals, actuals and lines, both from the reviewed content), and
 * finance's posting decision — a financial posting date and treatment kept apart from the operational
 * effective date (the period's date), never by the proposer of the correction behind it, decided once. The original
 * approved revision stays as it was.
 */
@Injectable()
export class RestatementService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: AccountingPoliciesService,
  ) {}

  read(
    context: RequestContext,
    periodId: string,
    revision: number | undefined,
  ): Promise<Restatement> {
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(manager, context, periodId);
      return this.restatementOf(manager, period, revision);
    });
  }

  decidePosting(
    context: RequestContext,
    periodId: string,
    revisionNumber: number,
    decision: PostingDecision,
  ): Promise<Restatement> {
    const actor = requireUser(context);
    return this.dataSource.transaction(async (manager) => {
      const period = await periodInScope(
        manager,
        context,
        periodId,
        POSTING_DECIDERS,
      );
      await lockPeriod(manager, period.id);
      const current = await this.restatementOf(manager, period, revisionNumber);
      assertPostingOpen(current.posting);
      await assertPostingIndependent(manager, context, current.revision);
      const values = {
        operationalEffectiveDate: period.localDate,
        postingDate: decision.postingDate,
        treatment: decision.treatment,
        note: decision.note,
        decidedBy: actor,
        decidedAt: new Date(),
        updatedBy: actor,
      };
      await manager.insert(RestatementPosting, {
        ...values,
        tenantId: period.tenantId,
        revisionId: current.revision.id,
        periodId: period.id,
        createdBy: actor,
      });
      await appendAudit(manager, [
        {
          tenantId: period.tenantId,
          actorId: actor,
          action: 'accounting_revision.posting_decided',
          entityType: 'accounting_revision',
          entityId: current.revision.id,
          revision: current.revision.revision,
          reason: decision.note,
          correlationId: context.correlationId || null,
          detail: {
            periodId: period.id,
            postingDate: decision.postingDate,
            treatment: decision.treatment,
            operationalEffectiveDate: period.localDate,
          },
        },
      ]);
      return this.restatementOf(manager, period, revisionNumber);
    });
  }

  private async restatementOf(
    manager: EntityManager,
    period: ProductionPeriod,
    number: number | undefined,
  ): Promise<Restatement> {
    const revision =
      number === undefined
        ? await latestRevision(manager, period.id)
        : await revisionNumbered(manager, period.id, number);
    if (!revision?.supersedesId || revision.lifecycle === 'cancelled') {
      throw invalid(
        'NOT_A_RESTATEMENT',
        'the revision does not restate an approved revision',
      );
    }
    const superseded = await manager.findOneByOrFail(AccountingRevision, {
      id: revision.supersedesId,
    });
    const before = await loadRevisionState(
      manager,
      period,
      superseded,
      this.policies,
    );
    const after = await loadRevisionState(
      manager,
      period,
      revision,
      this.policies,
    );
    const posting = await manager.findOneBy(RestatementPosting, {
      revisionId: revision.id,
    });
    return {
      period,
      revision,
      superseded,
      delta: restatementDelta(figuresOf(before), figuresOf(after)),
      values: restatementValues(
        approvedValuesPart(before).values,
        approvedValuesPart(after).values,
      ),
      posting,
      decidedByName: posting ? await nameOf(manager, posting.decidedBy) : null,
    };
  }
}
