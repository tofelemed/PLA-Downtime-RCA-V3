import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { requireTenantRole } from '../auth/roles/require-tenant-role';
import { appendAudit } from '../common/audit/audit-trail';
import { Clock } from '../common/clock/clock';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import {
  materialityFindings,
  MaterialityFinding,
} from '../domain/close/materiality';
import {
  decideMonthClose,
  MonthCloseAction as CloseAction,
  MonthCloseState,
} from '../domain/close/month-close-machine';
import { assertTenantWide } from '../periods/period-scope';
import { requireUser } from '../reconciliation/revision-access';
import {
  FINANCE_SIGNERS,
  MATERIALITY_REVIEWERS,
  MONTH_REOPENERS,
  QUANTITY_CLOSERS,
} from '../v2/close/close-roles';
import { MonthCloseAction } from './entities/month-close-action.entity';
import { MonthClose } from './entities/month-close.entity';
import {
  monthCloseRefused,
  monthNotEnded,
  notMaterialityReviewer,
} from './month-close-errors';
import { applyStep } from './month-close-steps';
import { loadMonthContext, MonthContext, MonthSelector } from './month-context';
import { ClosePrerequisites, monthCoverage } from './month-coverage';
import { lockMonthCloses } from './month-lock';
import { adjustmentTotals, monthPrerequisites } from './month-prerequisites';
import { WorkflowPoliciesService } from './workflow-policies.service';

/** A month as the API shows it: its context, prerequisites, materiality and history. */
export interface MonthCloseSnapshot {
  context: MonthContext;
  prerequisites: ClosePrerequisites;
  /** when the month is over (plant time zone, after its last shift) */
  endsAt: Date;
  findings: MaterialityFinding[];
  totals: Awaited<ReturnType<typeof adjustmentTotals>>;
  history: MonthCloseAction[];
  /** display names of the users the month names (signers, history actors) */
  names: Record<string, string>;
  asOf: Date;
}

export interface MonthCloseCommand {
  action: CloseAction;
  comment: string | null;
}

const HISTORY_LIMIT = 50;
const ACTION_ROLES: Record<CloseAction, readonly string[]> = {
  close_quantities: QUANTITY_CLOSERS,
  review_materiality: MATERIALITY_REVIEWERS,
  sign_off_finance: FINANCE_SIGNERS,
  lock: FINANCE_SIGNERS,
  reopen: MONTH_REOPENERS,
};

/**
 * Month close of a plant (SME R1 / R4, phase R-B). Reads never write a row (a month without one is open);
 * the first step creates it under the `month_close` version in force. Steps run under the plant's
 * exclusive month-close lock, re-check the prerequisites (every period of the month approved, no open
 * change proposal), keep finance independent of the quantity close, record history and audit, and need
 * a tenant-wide grant (403 TENANT_SCOPE_REQUIRED).
 */
@Injectable()
export class MonthCloseService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly policies: WorkflowPoliciesService,
    private readonly clock: Clock,
  ) {}

  snapshot(
    context: RequestContext,
    selector: MonthSelector,
  ): Promise<MonthCloseSnapshot> {
    const tenantId = requireTenantId(context);
    return this.dataSource.transaction((manager) =>
      this.read(manager, tenantId, selector, this.clock.now()),
    );
  }

  act(
    context: RequestContext,
    key: string,
    command: MonthCloseCommand,
  ): Promise<MonthCloseSnapshot> {
    const actor = requireUser(context);
    const tenantId = requireTenantId(context);
    assertTenantWide(context, 'A month close');
    requireTenantRole(context, ACTION_ROLES[command.action]);
    return this.dataSource.transaction(async (manager) => {
      await lockMonthCloses(manager, tenantId, 'exclusive');
      const now = this.clock.now();
      const before = await this.read(manager, tenantId, { key }, now);
      this.assertReviewer(context, command.action, before);
      const row = await this.rowFor(manager, before.context, actor);
      const blocked = isBlocked(before);
      const decision = decideMonthClose(command.action, row, {
        actor,
        blocked,
        isSuperAdmin: context.isSuperAdmin,
      });
      if (command.action === 'close_quantities' && now < before.endsAt) {
        const transitionAllowed =
          decision.ok || decision.refusal === 'CLOSE_PREREQUISITES';
        if (transitionAllowed)
          throw monthNotEnded(before.context.month.key, before.endsAt);
      }
      if (!decision.ok) {
        throw monthCloseRefused(
          decision.refusal,
          row.state,
          before.prerequisites,
        );
      }
      await this.record(manager, context, {
        row,
        command,
        to: decision.to,
        snapshot: before,
      });
      return this.read(manager, tenantId, { key }, now);
    });
  }

  private async read(
    manager: EntityManager,
    tenantId: string,
    selector: MonthSelector,
    now: Date,
  ): Promise<MonthCloseSnapshot> {
    const context = await loadMonthContext(manager, this.policies, {
      tenantId,
      selector,
      now,
    });
    const dates = { tenantId, ...context.month };
    const { endsAt, ...coverage } = await monthCoverage(
      manager,
      dates,
      context.calendar.timezone,
    );
    const prerequisites = {
      ...(await monthPrerequisites(manager, dates)),
      ...coverage,
    };
    const totals = await adjustmentTotals(manager, dates);
    const history = context.row
      ? await manager.find(MonthCloseAction, {
          where: { monthCloseId: context.row.id },
          order: { createdAt: 'DESC', id: 'DESC' },
          take: HISTORY_LIMIT,
        })
      : [];
    return {
      context,
      prerequisites,
      endsAt,
      totals,
      findings: materialityFindings(totals, context.policy.policy.materiality),
      history,
      names: await namesOf(manager, context.row, history),
      asOf: now,
    };
  }

  /** The month's row, created under the policy version in force on the first step; locked. */
  private async rowFor(
    manager: EntityManager,
    context: MonthContext,
    actor: string,
  ): Promise<MonthClose> {
    if (!context.row) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(MonthClose)
        .values({
          tenantId: context.tenantId,
          calendar: context.month.calendar,
          monthKey: context.month.key,
          firstDate: context.month.firstDate,
          endDate: context.month.endDate,
          state: 'open',
          policyId: context.policy.id,
          policyVersion: context.policy.version,
          createdBy: actor,
        })
        .orIgnore()
        .execute();
    }
    return manager
      .getRepository(MonthClose)
      .createQueryBuilder('mc')
      .where('mc.tenantId = :tenantId AND mc.firstDate = :firstDate', {
        tenantId: context.tenantId,
        firstDate: context.month.firstDate,
      })
      .setLock('pessimistic_write')
      .getOneOrFail();
  }

  /** The materiality review needs one of the policy's reviewer roles (on top of the route's roles). */
  private assertReviewer(
    context: RequestContext,
    action: CloseAction,
    snapshot: MonthCloseSnapshot,
  ): void {
    if (action !== 'review_materiality') return;
    const roles = snapshot.context.policy.policy.materiality.reviewerRoles;
    try {
      requireTenantRole(context, roles);
    } catch (error) {
      if (error instanceof ForbiddenException)
        throw notMaterialityReviewer(roles);
      throw error;
    }
  }

  private async record(
    manager: EntityManager,
    context: RequestContext,
    step: {
      row: MonthClose;
      command: MonthCloseCommand;
      to: MonthCloseState;
      snapshot: MonthCloseSnapshot;
    },
  ): Promise<void> {
    const actor = context.userId as string;
    const detail = evidenceOf(step.snapshot);
    await applyStep(manager, {
      row: step.row,
      action: step.command.action,
      to: step.to,
      actor,
      comment: step.command.comment,
      materialityRequired: step.snapshot.findings.length > 0,
    });
    await manager.save(
      manager.create(MonthCloseAction, {
        tenantId: step.row.tenantId,
        monthCloseId: step.row.id,
        action: step.command.action,
        fromState: step.row.state,
        toState: step.to,
        actorId: actor,
        reason: step.command.comment,
        detail,
        createdBy: actor,
      }),
    );
    await appendAudit(manager, [
      {
        tenantId: step.row.tenantId,
        actorId: actor,
        action: `month_close.${step.command.action}`,
        entityType: 'month_close',
        entityId: step.row.id,
        reason: step.command.comment,
        correlationId: context.correlationId || null,
        detail: {
          month: step.row.monthKey,
          from: step.row.state,
          to: step.to,
          ...detail,
        },
      },
    ]);
  }
}

/** Display names of the month's signers and history actors (one query). */
async function namesOf(
  manager: EntityManager,
  row: MonthClose | null,
  history: readonly MonthCloseAction[],
): Promise<Record<string, string>> {
  const ids = [
    row?.quantitiesClosedBy,
    row?.financeSignedOffBy,
    row?.materialityReviewedBy,
    row?.lockedBy,
    ...history.map((h) => h.actorId),
  ].filter((id): id is string => typeof id === 'string');
  if (ids.length === 0) return {};
  const rows: Array<{ id: string; name: string }> = await manager.query(
    `SELECT "id"::text AS "id", "name" FROM "users" WHERE "id" = ANY($1::uuid[])`,
    [[...new Set(ids)]],
  );
  return Object.fromEntries(rows.map((r) => [r.id, r.name]));
}

/**
 * Prerequisites unmet: a scheduled period not yet created, a period not approved, a production day not certified (when the policy requires day
 * certification), or an open change proposal when the policy blocks on them.
 */
function isBlocked(snapshot: MonthCloseSnapshot): boolean {
  const { prerequisites, context } = snapshot;
  if (prerequisites.pendingCount > 0) return true;
  if (prerequisites.missingPeriodCount > 0) return true;
  if (
    context.policy.policy.requireCertifiedDays &&
    prerequisites.certifiedDays < prerequisites.days
  )
    return true;
  return (
    context.policy.policy.blockOnOpenProposals &&
    prerequisites.openProposalCount > 0
  );
}

/** What the step saw: counts and findings, kept on the history row. */
function evidenceOf(snapshot: MonthCloseSnapshot): Record<string, unknown> {
  return {
    periods: snapshot.prerequisites.periods,
    approved: snapshot.prerequisites.approved,
    missingPeriods: snapshot.prerequisites.missingPeriodCount,
    days: snapshot.prerequisites.days,
    certifiedDays: snapshot.prerequisites.certifiedDays,
    openProposals: snapshot.prerequisites.openProposalCount,
    materiality: snapshot.findings,
    policyVersion: snapshot.context.policy.version,
  };
}
