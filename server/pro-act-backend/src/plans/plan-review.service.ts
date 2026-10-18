import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RequestContext } from '../common/context/request-context';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { PlanVersion } from './entities/plan-version.entity';
import { assertNotAuthor, invalidTransition, notFound } from './plan-errors';
import { PlanVersionsService } from './plan-versions.service';

export interface ReviewCommand {
  /** number of the open version the user read */
  expectedVersion: number;
}

export interface ReturnCommand extends ReviewCommand {
  reason: string;
}

/**
 * Review of a plan's open version before approval (the v1 "Submit for review" / "Reject with a reason",
 * kept on v2): the author submits a draft (draft → submitted); a manager approver who is not the author
 * returns a submitted version with a reason (submitted → draft). The review trail lives on the plan
 * header (`submitted_*`, `reviewed_*`, `rejection_reason`), written from the identity, never from the
 * client; approval itself stays `PlanApprovalService`.
 */
@Injectable()
export class PlanReviewService {
  constructor(
    @InjectRepository(PlanVersion)
    private readonly versions: Repository<PlanVersion>,
    private readonly plans: PlanVersionsService,
  ) {}

  async submit(
    context: RequestContext,
    planId: string,
    command: ReviewCommand,
  ): Promise<PlanVersion> {
    const target = await this.plans.getVersion(
      context,
      planId,
      command.expectedVersion,
    );
    return this.versions.manager.transaction(async (manager) => {
      const version = await lock(manager, target.id);
      if (version.approvalState === 'submitted') return version;
      if (version.approvalState !== 'draft') {
        throw invalidTransition(
          'plan version',
          version.approvalState,
          'submitted',
        );
      }
      version.approvalState = 'submitted';
      version.updatedBy = context.userId;
      const saved = await manager.save(version);
      await writeHeader(manager, saved, {
        approvalStatus: 'Pending Approval',
        submittedBy: context.userId ?? undefined,
        submittedAt: new Date(),
        rejectionReason: () => 'NULL',
      });
      return saved;
    });
  }

  async returnToAuthor(
    context: RequestContext,
    planId: string,
    command: ReturnCommand,
  ): Promise<PlanVersion> {
    const target = await this.plans.getVersion(
      context,
      planId,
      command.expectedVersion,
    );
    return this.versions.manager.transaction(async (manager) => {
      const version = await lock(manager, target.id);
      if (version.approvalState !== 'submitted') {
        throw invalidTransition(
          'plan version',
          version.approvalState,
          'returned',
        );
      }
      assertNotAuthor(
        version,
        context.userId,
        'plan version',
        context.isSuperAdmin,
      );
      version.approvalState = 'draft';
      version.updatedBy = context.userId;
      const saved = await manager.save(version);
      await writeHeader(manager, saved, {
        approvalStatus: 'Rejected',
        reviewedBy: context.userId ?? undefined,
        reviewedAt: new Date(),
        rejectionReason: command.reason.trim(),
      });
      return saved;
    });
  }
}

async function lock(manager: EntityManager, id: string): Promise<PlanVersion> {
  const found = await manager.findOne(PlanVersion, {
    where: { id },
    lock: { mode: 'pessimistic_write' },
  });
  if (!found) throw notFound('Plan version');
  return found;
}

/** The review columns of the plan header, when the version is the plan's current one. */
async function writeHeader(
  manager: EntityManager,
  version: PlanVersion,
  columns: QueryDeepPartialEntity<ProductionPlan>,
): Promise<void> {
  const plan = await manager.findOneByOrFail(ProductionPlan, {
    id: version.planId,
  });
  if (plan.currentVersion !== version.version) return;
  await manager.update(ProductionPlan, plan.id, columns);
}
