import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RCA } from '../rca/rca.entity';
import {
  RcaActionV2CreateDto,
  RcaActionV2UpdateDto,
} from '../v2/rca/rca-actions-v2.dto';
import { BaselineRequest, computeBaseline } from './action-baseline';
import { applyCompletion } from './action-completion';
import {
  actionColumns,
  assertActionConsistent,
  assertNoDeclaredBaseline,
} from './action-rules';
import { casePolicy } from './case-policy';
import { RcaActionV2View, toActionView } from './rca-action.view';
import { caseOutcome, RcaOutcomeV2View } from './rca-outcome';
import { findCase, notFound, RcaScope, scopeOf } from './rca-scope';
import { RcaVerificationService } from './rca-verification.service';

export type { RcaOutcomeV2View } from './rca-outcome';

const EMPTY_ACTION: Partial<RcaAction> = {
  description: null,
  ownerId: null,
  dueDate: null,
  actionType: null,
  completionEvidenceRef: null,
  completionAttachments: null,
  completedAt: null,
  completionVerifiedBy: null,
  verificationWindowStart: null,
  verificationWindowEnd: null,
  postAction: null,
  claimedAvoidedLoss: null,
  claimedCurrency: null,
};

const date = (value: string | null | undefined) =>
  value ? new Date(value) : null;

/**
 * Corrective actions of a case (RCA03; SME CA2–CA4): a done action carries its type, objective evidence
 * and a verifier who is not its owner; the baseline is computed by the server from history (a typed value
 * is refused) with the policy's acceptance criteria frozen in; verification yields an effectiveness verdict.
 */
@Injectable()
export class RcaActionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly verification: RcaVerificationService,
    private readonly policies: AccountingPoliciesService,
  ) {}

  async list(
    context: RequestContext,
    rcaId: string,
  ): Promise<RcaActionV2View[]> {
    const scope = scopeOf(context);
    await findCase(this.dataSource.manager, scope, rcaId);
    const rows = await this.dataSource.getRepository(RcaAction).find({
      where: { tenantId: scope.tenantId, rcaId },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: 500,
    });
    return rows.map((row) => toActionView(row));
  }

  async create(
    context: RequestContext,
    rcaId: string,
    body: RcaActionV2CreateDto,
  ): Promise<RcaActionV2View> {
    assertNoDeclaredBaseline(body);
    const scope = scopeOf(context);
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const rca = await findCase(manager, scope, rcaId, true);
      const repository = manager.getRepository(RcaAction);
      const action = repository.create({
        ...EMPTY_ACTION,
        status: 'open',
        ...actionColumns(body),
        tenantId: scope.tenantId,
        rcaId,
        createdBy: scope.userId,
      });
      await assertActionConsistent(manager, scope, action);
      applyCompletion({ status: 'open' }, action, {
        actorId: scope.userId,
        isSuperAdmin: context.isSuperAdmin,
        completedAt: date(body.completedAt),
        now,
      });
      action.baseline = body.baseline
        ? await this.baseline(manager, {
            rca,
            request: body.baseline,
            action,
            now,
          })
        : null;
      return toActionView(await repository.save(action), now);
    });
  }

  async update(
    context: RequestContext,
    target: { id: string; expectedRowVersion: number },
    body: RcaActionV2UpdateDto,
  ): Promise<RcaActionV2View> {
    assertNoDeclaredBaseline(body);
    const scope = scopeOf(context);
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const { action, rca } = await this.lockAction(manager, scope, target.id);
      assertRevision(action.rowVersion, target.expectedRowVersion);
      const next = {
        ...action,
        ...actionColumns(body),
        updatedBy: scope.userId,
      };
      await assertActionConsistent(manager, scope, next);
      applyCompletion(action, next, {
        actorId: scope.userId,
        isSuperAdmin: context.isSuperAdmin,
        completedAt: date(body.completedAt),
        now,
      });
      const windowMoved =
        next.verificationWindowStart?.getTime() !==
        action.verificationWindowStart?.getTime();
      if (body.baseline !== undefined || (windowMoved && next.baseline)) {
        const request =
          body.baseline === undefined ? next.baseline : body.baseline;
        next.baseline = request
          ? await this.baseline(manager, { rca, request, action: next, now })
          : null;
        next.postAction = null;
      }
      return toActionView(
        await manager.getRepository(RcaAction).save(next),
        now,
      );
    });
  }

  async verify(
    context: RequestContext,
    id: string,
    expectedRowVersion: number,
  ): Promise<RcaActionV2View> {
    const scope = scopeOf(context);
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const { action } = await this.lockAction(manager, scope, id);
      assertRevision(action.rowVersion, expectedRowVersion);
      return toActionView(
        await this.verification.evaluateIn(manager, action, now),
        now,
      );
    });
  }

  async outcome(
    context: RequestContext,
    rcaId: string,
  ): Promise<RcaOutcomeV2View> {
    const scope = scopeOf(context);
    await findCase(this.dataSource.manager, scope, rcaId);
    return caseOutcome(this.dataSource.manager, {
      tenantId: scope.tenantId,
      rcaId,
    });
  }

  /** The frozen CA3 baseline of an action under the case's policy in force now. */
  private async baseline(
    manager: EntityManager,
    input: { rca: RCA; request: BaselineRequest; action: RcaAction; now: Date },
  ) {
    const { rca } = input;
    return computeBaseline(manager, {
      tenantId: rca.tenantId ?? '',
      rcaId: rca.id,
      request: {
        metric: input.request.metric,
        windowDays: input.request.windowDays,
      },
      windowStart: input.action.verificationWindowStart,
      policy: await casePolicy(manager, this.policies, rca, input.now),
      consequenceClass: rca.consequenceClass ?? null,
      now: input.now,
    });
  }

  /** An action of the caller's scope, locked, with its case (404 for anything else). */
  async lockAction(
    manager: EntityManager,
    scope: RcaScope,
    id: string,
  ): Promise<{ action: RcaAction; rca: RCA }> {
    const action = await manager
      .getRepository(RcaAction)
      .createQueryBuilder('a')
      .setLock('pessimistic_write')
      .where('a.id = :id AND a.tenantId = :tenantId', {
        id,
        tenantId: scope.tenantId,
      })
      .getOne();
    if (!action) throw notFound('RCA action');
    const rca = await findCase(manager, scope, action.rcaId).catch(() => {
      throw notFound('RCA action');
    });
    return { action, rca };
  }
}
