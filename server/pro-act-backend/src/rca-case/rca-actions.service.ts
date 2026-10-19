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
import { applyCancellation } from './action-cancellation';
import { applyCompletion } from './action-completion';
import {
  actionColumns,
  assertActionConsistent,
  assertNoDeclaredBaseline,
  assertRecommendationOf,
  assertWindowOpenForEdit,
} from './action-rules';
import { assertOwnerPatch } from './action-owner-access';
import { linkedTasks } from './action-tasks';
import {
  baselinePolicyVersion,
  policyVersionsAt,
} from './baseline-policy-version';
import { casePolicyVersion } from './case-policy';
import { childAudit, recordRcaAudit } from './rca-audit';
import { RcaActionV2View, toActionView } from './rca-action.view';
import { caseOutcome, RcaOutcomeV2View } from './rca-outcome';
import { findCase, notFound, RcaScope, scopeOf } from './rca-scope';
import { RcaVerificationService } from './rca-verification.service';
import { assertCaseNotClosed } from './case-closed';

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
  cancelReason: null,
  cancelledBy: null,
  cancelledAt: null,
  recommendationId: null,
  taskCompletedAt: null,
  verificationMethod: null,
  verifierId: null,
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
    const rca = await findCase(this.dataSource.manager, scope, rcaId);
    const rows = await this.dataSource.getRepository(RcaAction).find({
      where: { tenantId: scope.tenantId, rcaId },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: 500,
    });
    const tasks = await linkedTasks(
      this.dataSource.manager,
      scope.tenantId,
      rows.map((row) => row.id),
    );
    const versions = await policyVersionsAt(this.dataSource.manager, rca, rows);
    const now = new Date();
    return rows.map((row) => ({
      ...toActionView(row, now, tasks.get(row.id)),
      baselinePolicyVersion: baselinePolicyVersion(row, versions),
    }));
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
      assertCaseNotClosed(rca);
      assertRecommendationOf(rca, body.recommendationId);
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
      applyCancellation(null, action, {
        cancelReason: body.cancelReason,
        actorId: scope.userId,
        now,
      });
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
      const saved = await repository.save(action);
      await recordRcaAudit(manager, scope, [
        childAudit('rca_action', 'created', { before: null, after: saved }),
      ]);
      return toActionView(saved, now);
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
      assertOwnerPatch(context, action, body);
      assertRecommendationOf(rca, body.recommendationId);
      const next = {
        ...action,
        ...actionColumns(body),
        updatedBy: scope.userId,
      };
      assertWindowOpenForEdit(action, next);
      await assertActionConsistent(manager, scope, next);
      applyCancellation(action.status, next, {
        cancelReason: body.cancelReason,
        actorId: scope.userId,
        now,
      });
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
      const saved = await manager.getRepository(RcaAction).save(next);
      await recordRcaAudit(manager, scope, [
        childAudit(
          'rca_action',
          'updated',
          { before: action, after: saved },
          saved.status === 'cancelled' ? saved.cancelReason : null,
        ),
      ]);
      return this.view(manager, saved, now);
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
      const before = { ...action };
      const saved = await this.verification.evaluateIn(manager, action, now);
      await recordRcaAudit(manager, scope, [
        childAudit('rca_action', 'verified', { before, after: saved }),
      ]);
      return this.view(manager, saved, now);
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

  /** The view of one action with its linked task (item 5). */
  async view(
    manager: EntityManager,
    action: RcaAction,
    now: Date,
  ): Promise<RcaActionV2View> {
    const tasks = await linkedTasks(manager, action.tenantId, [action.id]);
    return toActionView(action, now, tasks.get(action.id));
  }

  /** The frozen CA3 baseline of an action under the case's policy in force now. */
  private async baseline(
    manager: EntityManager,
    input: { rca: RCA; request: BaselineRequest; action: RcaAction; now: Date },
  ) {
    const { rca } = input;
    const { policy, version } = await casePolicyVersion(
      manager,
      this.policies,
      rca,
      input.now,
    );
    return computeBaseline(manager, {
      tenantId: rca.tenantId ?? '',
      rcaId: rca.id,
      request: {
        metric: input.request.metric,
        windowDays: input.request.windowDays,
      },
      windowStart: input.action.verificationWindowStart,
      policy,
      policyVersion: version,
      consequenceClass: rca.consequenceClass ?? null,
      now: input.now,
    });
  }

  /** An action of the caller's scope, locked, with its open case (404 for anything else, 409 CASE_CLOSED). */
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
    assertCaseNotClosed(rca);
    return { action, rca };
  }
}
