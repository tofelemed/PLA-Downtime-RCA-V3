import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { ApprovalState } from '../domain/plans/plan.types';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { PlanProductSlice } from './entities/plan-product-slice.entity';
import { PlanScenario } from './entities/plan-scenario.entity';
import { PlanVersion } from './entities/plan-version.entity';
import {
  assertNotAuthor,
  conflict,
  invalidTransition,
  isExclusionViolation,
  notFound,
  PlanConflict,
  planOverlap,
} from './plan-errors';
import { recordPlanApproved } from './plan-events';
import { PlanVersionsService } from './plan-versions.service';

export interface ApproveCommand {
  expectedVersion: number;
  reason?: string | null;
}

/** v1 approval labels of the header for each version state (legacy screens, C4). */
const LEGACY_LABEL: Record<ApprovalState, string> = {
  draft: 'Draft',
  submitted: 'Pending Approval',
  approved: 'Approved',
  superseded: 'Approved',
};

/**
 * `PlanVersionService.approve` of plan 2.3 (PLAN04): approves the plan's open version once its periods
 * are generated, unless an approved version of another plan in the same scenario plans the same unit and
 * product in an overlapping interval (409 `PLAN_OVERLAP`, backed by the exclusion constraint), and never by
 * the version's author (`createdBy`, 403 `SEPARATION_OF_DUTIES`, also through the v1 bridge). The plan's
 * previous approved version becomes `superseded` (its periods stay frozen) and an outbox message carries
 * the restatement hint for 2.4/2.8. Header approval columns are written from the identity, never from
 * client strings.
 */
@Injectable()
export class PlanApprovalService {
  constructor(
    @InjectRepository(PlanVersion)
    private readonly versions: Repository<PlanVersion>,
    private readonly plans: PlanVersionsService,
  ) {}

  async approve(
    context: RequestContext,
    planId: string,
    command: ApproveCommand,
  ): Promise<PlanVersion> {
    const target = await this.plans.getVersion(
      context,
      planId,
      command.expectedVersion,
    );
    try {
      return await this.versions.manager.transaction((manager) =>
        this.approveLocked(manager, context, target, command.reason ?? null),
      );
    } catch (error: unknown) {
      if (isExclusionViolation(error)) throw planOverlap([]);
      throw error;
    }
  }

  /** draft ↔ submitted (v1 "Pending Review/Approval" and "Draft/Rejected"). */
  async setOpenState(
    context: RequestContext,
    planId: string,
    to: 'draft' | 'submitted',
  ): Promise<PlanVersion> {
    const { version } = await this.plans.getPlan(context, planId);
    return this.versions.manager.transaction(async (manager) => {
      const locked = await lock(manager, version.id);
      if (locked.approvalState === to) return locked;
      if (
        locked.approvalState !== 'draft' &&
        locked.approvalState !== 'submitted'
      ) {
        throw invalidTransition('plan version', locked.approvalState, to);
      }
      locked.approvalState = to;
      locked.updatedBy = context.userId;
      const saved = await manager.save(locked);
      await syncHeader(manager, saved, context.userId);
      return saved;
    });
  }

  private async approveLocked(
    manager: EntityManager,
    context: RequestContext,
    target: PlanVersion,
    reason: string | null,
  ): Promise<PlanVersion> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `plan_approval:${target.scenarioId}:${target.unitId}`,
    ]);
    const version = assertApprovable(await lock(manager, target.id));
    assertNotAuthor(version, context.userId, 'plan version');
    const slices = await manager.findBy(PlanProductSlice, {
      planVersionId: version.id,
    });
    const conflicts = await overlapping(manager, version, slices);
    if (conflicts.length > 0) throw planOverlap(conflicts);
    const superseded = await supersedePrevious(
      manager,
      version,
      context.userId,
    );
    Object.assign(version, {
      approvalState: 'approved',
      approvedBy: context.userId,
      approvedAt: new Date(),
      supersedesVersionId: superseded?.id ?? null,
      changeReason: reason?.trim() || version.changeReason,
      updatedBy: context.userId,
    });
    const approved = await manager.save(version);
    await publishApproval(manager, approved, superseded, context.userId);
    return approved;
  }
}

/** An open version whose periods are generated (409 otherwise). */
function assertApprovable(version: PlanVersion): PlanVersion {
  if (
    version.approvalState !== 'draft' &&
    version.approvalState !== 'submitted'
  ) {
    throw invalidTransition('plan version', version.approvalState, 'approved');
  }
  if (!version.periodsGeneratedAt) {
    throw conflict(
      'PERIODS_NOT_GENERATED',
      'generate the periods of this version (generate-periods) before approving it',
    );
  }
  return version;
}

/** Slices enter the PLAN04 constraint, the header mirrors the approval, the outbox carries it. */
async function publishApproval(
  manager: EntityManager,
  approved: PlanVersion,
  superseded: PlanVersion | null,
  actorId: string | null,
): Promise<void> {
  await manager.update(
    PlanProductSlice,
    { planVersionId: approved.id },
    { isApproved: true },
  );
  await syncHeader(manager, approved, actorId);
  const scenario = await manager.findOneByOrFail(PlanScenario, {
    id: approved.scenarioId,
  });
  await recordPlanApproved(
    manager,
    approved,
    superseded,
    scenario.isAccountingBaseline,
  );
}

async function lock(manager: EntityManager, id: string): Promise<PlanVersion> {
  const found = await manager.findOne(PlanVersion, {
    where: { id },
    lock: { mode: 'pessimistic_write' },
  });
  if (!found) throw notFound('Plan version');
  return found;
}

/** Approved slices of other plans in the scenario, same unit and product, overlapping in time. */
async function overlapping(
  manager: EntityManager,
  version: PlanVersion,
  slices: readonly PlanProductSlice[],
): Promise<PlanConflict[]> {
  if (slices.length === 0) return [];
  const rows = await manager
    .createQueryBuilder(PlanProductSlice, 's')
    .innerJoin(PlanVersion, 'v', 'v.id = s.planVersionId')
    .select(['s.productId', 's.activeFrom', 's.activeTo'])
    .addSelect(['v.planId', 'v.version'])
    .where(
      's.isApproved AND s.scenarioId = :scenarioId AND s.unitId = :unitId',
      {
        scenarioId: version.scenarioId,
        unitId: version.unitId,
      },
    )
    .andWhere('v.planId <> :planId', { planId: version.planId })
    .andWhere('s.productId IN (:...products)', {
      products: slices.map((slice) => slice.productId),
    })
    .getRawMany<Record<string, unknown>>();
  return rows
    .map((row) => ({
      planId: String(row.v_plan_id),
      version: Number(row.v_version),
      productId: String(row.s_product_id),
      activeFrom: toDate(row.s_active_from),
      activeTo: toDate(row.s_active_to),
    }))
    .filter((row) =>
      slices.some(
        (slice) =>
          slice.productId === row.productId &&
          slice.activeFrom.getTime() < row.activeTo.getTime() &&
          row.activeFrom.getTime() < slice.activeTo.getTime(),
      ),
    );
}

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

/** The plan's approved version becomes superseded; its slices leave the PLAN04 constraint. */
async function supersedePrevious(
  manager: EntityManager,
  version: PlanVersion,
  actorId: string | null,
): Promise<PlanVersion | null> {
  const previous = await manager.findOne(PlanVersion, {
    where: { planId: version.planId, approvalState: In(['approved']) },
    lock: { mode: 'pessimistic_write' },
  });
  if (!previous) return null;
  await manager.update(
    PlanProductSlice,
    { planVersionId: previous.id },
    { isApproved: false },
  );
  previous.approvalState = 'superseded';
  previous.updatedBy = actorId;
  return manager.save(previous);
}

/** Header approval columns mirror the plan's current version, written from the identity. */
async function syncHeader(
  manager: EntityManager,
  version: PlanVersion,
  actorId: string | null,
): Promise<void> {
  const plan = await manager.findOneByOrFail(ProductionPlan, {
    id: version.planId,
  });
  if (plan.currentVersion !== version.version) return;
  const now = new Date();
  const columns: Partial<ProductionPlan> = {
    approvalStatus: LEGACY_LABEL[version.approvalState],
  };
  if (version.approvalState === 'approved') {
    Object.assign(columns, {
      approvedBy: actorId ?? undefined,
      approvedAt: now,
    });
  }
  if (version.approvalState === 'submitted') {
    Object.assign(columns, {
      submittedBy: actorId ?? undefined,
      submittedAt: now,
    });
  }
  await manager.update(ProductionPlan, plan.id, columns);
}
