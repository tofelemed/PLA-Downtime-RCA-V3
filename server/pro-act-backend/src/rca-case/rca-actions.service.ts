import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { assertRevision } from '../common/concurrency/revision';
import { RequestContext } from '../common/context/request-context';
import { Dec, formatDec } from '../domain/actuals/decimal';
import { RcaAction } from '../rca/entities/rca-action.entity';
import {
  RcaActionV2CreateDto,
  RcaActionV2UpdateDto,
} from '../v2/rca/rca-actions-v2.dto';
import {
  actionColumns,
  assertActionConsistent,
  resolveBaseline,
} from './action-rules';
import { approvedImpact, ApprovedImpact } from './approved-impact';
import { RcaActionV2View, toActionView } from './rca-action.view';
import { findCase, notFound, RcaScope, scopeOf } from './rca-scope';
import { RcaVerificationService } from './rca-verification.service';

/** RCA03 outcome of a case: three numbers that are never added or netted. */
export interface RcaOutcomeV2View {
  rcaId: string;
  /** approved historical loss of the linked events and loss lines (ledger, approved revisions only) */
  approvedHistoricalLoss: ApprovedImpact;
  /** the action owners' claims, per currency */
  claimedAvoided: Array<{ currency: string; amount: string; actions: number }>;
  /** what verification observed after each evaluated action vs its baseline */
  realized: Array<{
    actionId: string;
    title: string;
    metric: string;
    expected: string;
    observed: string;
    difference: string;
  }>;
  note: string;
}

const OUTCOME_NOTE =
  'Claimed avoided loss (owners), approved historical loss (ledger) and realized difference (verification ' +
  'vs baseline) are separate figures with different bases; they are never added together.';

@Injectable()
export class RcaActionsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly verification: RcaVerificationService,
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
    const scope = scopeOf(context);
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      await findCase(manager, scope, rcaId, true);
      const columns: Partial<RcaAction> = {
        status: 'open',
        ...actionColumns(body, now),
      };
      await assertActionConsistent(manager, scope, columns);
      const repository = manager.getRepository(RcaAction);
      const action = repository.create({
        description: null,
        ownerId: null,
        dueDate: null,
        completionEvidenceRef: null,
        completedAt: null,
        verificationWindowStart: null,
        verificationWindowEnd: null,
        postAction: null,
        claimedAvoidedLoss: null,
        claimedCurrency: null,
        ...columns,
        tenantId: scope.tenantId,
        rcaId,
        createdBy: scope.userId,
        baseline: body.baseline
          ? await resolveBaseline(manager, {
              tenantId: scope.tenantId,
              rcaId,
              baseline: body.baseline,
              windowStart: columns.verificationWindowStart ?? null,
            })
          : null,
      });
      return toActionView(await repository.save(action), now);
    });
  }

  async update(
    context: RequestContext,
    target: { id: string; expectedRowVersion: number },
    body: RcaActionV2UpdateDto,
  ): Promise<RcaActionV2View> {
    const scope = scopeOf(context);
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const action = await this.lockAction(manager, scope, target.id);
      assertRevision(action.rowVersion, target.expectedRowVersion);
      const next = {
        ...action,
        ...actionColumns(body, now),
        updatedBy: scope.userId,
      };
      await assertActionConsistent(manager, scope, next);
      if (body.baseline !== undefined) {
        next.baseline = body.baseline
          ? await resolveBaseline(manager, {
              tenantId: scope.tenantId,
              rcaId: action.rcaId,
              baseline: body.baseline,
              windowStart: next.verificationWindowStart,
            })
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
      const action = await this.lockAction(manager, scope, id);
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
    const manager = this.dataSource.manager;
    await findCase(manager, scope, rcaId);
    const links: Array<{ link_type: string; target_id: string }> =
      await manager.query(
        `SELECT "link_type"::text AS "link_type", "target_id" FROM "rca_case_links"
        WHERE "tenant_id" = $1 AND "rca_id" = $2 AND "link_type" IN ('event', 'loss_line')`,
        [scope.tenantId, rcaId],
      );
    const ids = (type: string) =>
      links.filter((l) => l.link_type === type).map((l) => l.target_id);
    const actions = await manager
      .getRepository(RcaAction)
      .find({ where: { tenantId: scope.tenantId, rcaId } });
    return {
      rcaId,
      approvedHistoricalLoss: await this.approvedOf(
        manager,
        scope.tenantId,
        ids('event'),
        ids('loss_line'),
      ),
      claimedAvoided: claimsOf(actions),
      realized: actions
        .filter((a) => a.postAction)
        .map((a) => ({
          actionId: a.id,
          title: a.title,
          ...(a.postAction as NonNullable<RcaAction['postAction']>).realized,
        })),
      note: OUTCOME_NOTE,
    };
  }

  /** Approved loss of the linked events plus linked loss lines that are not caused by a linked event. */
  private async approvedOf(
    manager: EntityManager,
    tenantId: string,
    eventIds: string[],
    lineIds: string[],
  ) {
    if (lineIds.length === 0)
      return approvedImpact(manager, tenantId, { eventIds });
    const extra: Array<{ id: string }> = await manager.query(
      `SELECT "id"::text AS "id" FROM "loss_lines" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])
          AND ("cause_event_id" IS NULL OR NOT ("cause_event_id" = ANY($3::uuid[])))`,
      [tenantId, lineIds, eventIds],
    );
    const own: Array<{ id: string }> = eventIds.length
      ? await manager.query(
          `SELECT "id"::text AS "id" FROM "loss_lines" WHERE "tenant_id" = $1 AND "cause_event_id" = ANY($2::uuid[])`,
          [tenantId, eventIds],
        )
      : [];
    return approvedImpact(manager, tenantId, {
      lineIds: [...own, ...extra].map((row) => row.id),
    });
  }

  private async lockAction(
    manager: EntityManager,
    scope: RcaScope,
    id: string,
  ): Promise<RcaAction> {
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
    await findCase(manager, scope, action.rcaId).catch(() => {
      throw notFound('RCA action');
    });
    return action;
  }
}

function claimsOf(actions: RcaAction[]): RcaOutcomeV2View['claimedAvoided'] {
  const sums = new Map<string, { amount: Dec; actions: number }>();
  for (const action of actions) {
    if (action.claimedAvoidedLoss === null || !action.claimedCurrency) continue;
    const entry = sums.get(action.claimedCurrency) ?? {
      amount: new Dec(0),
      actions: 0,
    };
    sums.set(action.claimedCurrency, {
      amount: entry.amount.plus(new Dec(action.claimedAvoidedLoss)),
      actions: entry.actions + 1,
    });
  }
  return [...sums.entries()].map(([currency, entry]) => ({
    currency,
    amount: formatDec(entry.amount),
    actions: entry.actions,
  }));
}
