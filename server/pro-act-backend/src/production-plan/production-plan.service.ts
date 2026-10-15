import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RequestContext } from '../common/context/request-context';
import { findOrThrow } from '../common/helpers/find-or-throw';
import { PlanLegacyBridge } from '../plans/plan-legacy-bridge.service';
import { invalid } from '../plans/plan-errors';
import { ProductionPlan } from './production-plan.entity';

/** Approval columns the client may no longer write (plan 2.3: they come from the identity). */
const CLIENT_APPROVAL_FIELDS = [
  'approvedBy',
  'approvedAt',
  'submittedBy',
  'submittedAt',
  'reviewedBy',
  'reviewedAt',
] as const;

/**
 * v1 plan headers (legacy screens, C4). Since plan 2.3 writes are limited to the caller's tenant and unit
 * scope, every create or content edit keeps a draft plan version in step (`PlanLegacyBridge`), and an
 * approval label change goes through the version approval service.
 */
@Injectable()
export class ProductionPlanService {
  constructor(
    @InjectRepository(ProductionPlan)
    private readonly planRepository: Repository<ProductionPlan>,
    private readonly bridge: PlanLegacyBridge,
  ) {}

  findAll(): Promise<ProductionPlan[]> {
    return this.planRepository.find();
  }

  findOne(id: string): Promise<ProductionPlan | null> {
    return this.planRepository.findOne({
      where: { id },
    });
  }

  async create(
    context: RequestContext,
    data: Partial<ProductionPlan>,
  ): Promise<ProductionPlan | null> {
    const refs = await this.bridge.assertCreatable(context, {
      unitId: data.unitId ?? '',
      productId: data.productId ?? null,
    });
    assertDateRange(data);
    const { approvalStatus, rest } = splitApproval(data);
    const plan = await this.planRepository.save(
      this.planRepository.create({
        ...rest,
        id: data.id ?? randomUUID(),
        tenantId: refs.tenantId,
        approvalStatus: 'Draft',
      }),
    );
    await this.bridge.syncFromHeader(context, null, plan);
    await this.applyApprovalLabel(context, plan.id, approvalStatus, 'Draft');
    return this.findOne(plan.id);
  }

  async update(
    context: RequestContext,
    id: string,
    data: Partial<ProductionPlan>,
  ): Promise<ProductionPlan | null> {
    const before = await findOrThrow(this.findOne(id), 'ProductionPlan', id);
    await this.bridge.assertWritable(context, before);
    assertDateRange({ ...before, ...data });
    if (data.unitId !== undefined || data.productId !== undefined) {
      await this.bridge.assertCreatable(context, {
        unitId: data.unitId ?? before.unitId,
        productId: data.productId ?? before.productId ?? null,
      });
    }
    const { approvalStatus, rest } = splitApproval(data);
    if (Object.keys(rest).length > 0)
      await this.planRepository.update(id, rest);
    const after = await this.planRepository.findOneByOrFail({ id });
    await this.bridge.syncFromHeader(context, before, after);
    await this.applyApprovalLabel(
      context,
      id,
      approvalStatus,
      before.approvalStatus,
    );
    return this.findOne(id);
  }

  async remove(context: RequestContext, id: string): Promise<void> {
    const plan = await findOrThrow(this.findOne(id), 'ProductionPlan', id);
    await this.bridge.assertDeletable(context, plan);
    await this.planRepository.delete(id);
  }

  findByTenant(tenantId: string): Promise<ProductionPlan[]> {
    return this.planRepository.find({
      where: { tenantId },
    });
  }

  findByStatus(status: string): Promise<ProductionPlan[]> {
    return this.planRepository.find({
      where: { status },
    });
  }

  /** Runs the label's version transition (approve / submit / reopen); stores the label it returns. */
  private async applyApprovalLabel(
    context: RequestContext,
    id: string,
    label: string | undefined,
    previous: string | null | undefined,
  ): Promise<void> {
    if (label === undefined) return;
    const plan = await this.planRepository.findOneByOrFail({ id });
    plan.approvalStatus = label;
    const stored = await this.bridge.applyApprovalLabel(
      context,
      plan,
      previous,
    );
    if (stored !== null) {
      await this.planRepository.update(id, { approvalStatus: stored });
    }
  }
}

/** Validate the merged header before saving; equal endpoints remain valid in v1. */
function assertDateRange(data: Partial<ProductionPlan>): void {
  if (
    data.startDate &&
    data.endDate &&
    new Date(data.endDate).getTime() < new Date(data.startDate).getTime()
  ) {
    throw invalid('INVALID_DATE_RANGE', 'endDate must not be before startDate');
  }
}

function splitApproval(data: Partial<ProductionPlan>): {
  approvalStatus: string | undefined;
  rest: Partial<ProductionPlan>;
} {
  const rest: Partial<ProductionPlan> = { ...data };
  const approvalStatus = rest.approvalStatus;
  delete rest.approvalStatus;
  delete rest.id;
  for (const field of CLIENT_APPROVAL_FIELDS) delete rest[field];
  return { approvalStatus, rest };
}
