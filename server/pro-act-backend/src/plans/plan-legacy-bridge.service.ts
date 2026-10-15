import { HttpException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { OPEN_STATES } from '../domain/plans/plan.types';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { PlanVersion } from './entities/plan-version.entity';
import {
  approvalIntent,
  contentChanged,
  contentFromHeader,
  LegacyApprovalIntent,
} from './legacy-plan-mapping';
import { PlanApprovalService } from './plan-approval.service';
import { contentOf, PlanContent } from './plan-content';
import { conflict, invalidReference, notFound } from './plan-errors';
import { PlanPeriodGeneratorService } from './plan-period-generator.service';
import { assertRole, PLAN_APPROVER_ROLE } from './plan-scope';
import { PlanVersionsService } from './plan-versions.service';

/** The unit (and its tenant) a v1 header points at, when it resolves. */
interface ResolvedRefs {
  tenantId: string;
  unitId: string;
  productId: string | null;
}

/**
 * Legacy bridge of plan 2.3 step 5 (C4: the v1 plan screens keep working). v1 writes are limited to the
 * caller's tenant and unit scope (404 / 422 INVALID_REFERENCE); a v1 create or content edit (unit, product,
 * dates, `plannedQuantity`) creates or updates the plan's **draft** version — a new version when the
 * current one is approved — and regenerates its periods synchronously (a refusal is stored on the draft,
 * the v1 save still succeeds); v1 approval labels drive the same approval service as v2 (manager
 * approver, periods required, PLAN04 overlap) and the header approval columns come from the identity.
 */
@Injectable()
export class PlanLegacyBridge {
  private readonly logger = new Logger(PlanLegacyBridge.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly versions: PlanVersionsService,
    private readonly approval: PlanApprovalService,
    private readonly generator: PlanPeriodGeneratorService,
  ) {}

  /** v1 POST: the unit (and product, when given) must be of the caller's tenant and unit scope. */
  async assertCreatable(
    context: RequestContext,
    header: { unitId: string; productId?: string | null },
  ): Promise<ResolvedRefs> {
    const refs = await this.resolve(header.unitId, header.productId ?? null);
    if (!refs || !this.inScope(context, refs.tenantId, refs.unitId)) {
      throw invalidReference('unitId', 'unit');
    }
    if (header.productId && !refs.productId) {
      throw invalidReference('productId', 'product');
    }
    return refs;
  }

  /** v1 PUT/DELETE: a plan outside the caller's tenant or unit scope answers 404. */
  async assertWritable(
    context: RequestContext,
    plan: ProductionPlan,
  ): Promise<void> {
    const refs = await this.resolve(plan.unitId, null);
    if (refs) {
      if (!this.inScope(context, refs.tenantId, refs.unitId))
        throw notFound('Production plan');
      return;
    }
    const tenant = plan.tenantId?.trim().toLowerCase() ?? null;
    const sameTenant =
      context.isSuperAdmin || (tenant !== null && tenant === context.tenantId);
    if (
      !sameTenant ||
      (context.tenantId && restrictedUnitIds(context, context.tenantId))
    ) {
      throw notFound('Production plan');
    }
  }

  /** v1 DELETE: plans with an approved (or superseded) version are accounting baselines and stay. */
  async assertDeletable(
    context: RequestContext,
    plan: ProductionPlan,
  ): Promise<void> {
    await this.assertWritable(context, plan);
    const approved = await this.dataSource.manager.countBy(PlanVersion, {
      planId: plan.id,
      approvalState: In(['approved', 'superseded']),
    });
    if (approved > 0) {
      throw conflict(
        'PLAN_APPROVED',
        'an approved plan is never deleted; create a new version',
      );
    }
  }

  /** After a v1 save: keeps the version model in step with the header (create or content edit). */
  async syncFromHeader(
    context: RequestContext,
    before: ProductionPlan | null,
    after: ProductionPlan,
  ): Promise<void> {
    const refs = await this.resolve(after.unitId, after.productId ?? null);
    if (!refs) return;
    const hasVersions = (after.currentVersion ?? null) !== null;
    if (hasVersions && before && !contentChanged(before, after)) return;
    const acting = actingContext(context, refs.tenantId);
    let draftId: string;
    try {
      draftId = await this.dataSource.transaction(async (manager) => {
        await this.attachHeader(manager, after, refs);
        const draft = await this.writeDraft(manager, after, refs, acting);
        return draft.id;
      });
    } catch (error: unknown) {
      // A legacy header the version model cannot take (e.g. equal endpoints) keeps the v1 save working.
      if (!(error instanceof HttpException)) throw error;
      this.logger.warn(`Plan ${after.id}: no draft version (${error.message})`);
      return;
    }
    await this.tryRegenerate(draftId);
  }

  /**
   * v1 approval label change → approve / submit / reopen through the version services. Returns the label
   * the header should store, or null when the version services already wrote it (or nothing changes).
   */
  async applyApprovalLabel(
    context: RequestContext,
    plan: ProductionPlan,
    previousLabel: string | null | undefined,
  ): Promise<string | null> {
    const label = plan.approvalStatus ?? null;
    const intent: LegacyApprovalIntent = approvalIntent(label);
    const refs = await this.resolve(plan.unitId, null);
    if (!intent || !refs || (plan.currentVersion ?? null) === null)
      return label;
    if (intent === 'approve') {
      if (intent === approvalIntent(previousLabel)) return null;
      await this.approveCurrent(context, plan.id, refs.tenantId);
      return null;
    }
    const acting = actingContext(context, refs.tenantId);
    const { version } = await this.versions.getPlan(acting, plan.id);
    if (
      version.approvalState === 'draft' ||
      version.approvalState === 'submitted'
    ) {
      await this.approval.setOpenState(
        acting,
        plan.id,
        intent === 'submit' ? 'submitted' : 'draft',
      );
    }
    return label;
  }

  private async approveCurrent(
    context: RequestContext,
    planId: string,
    tenantId: string,
  ): Promise<void> {
    assertRole(context, PLAN_APPROVER_ROLE);
    const acting = actingContext(context, tenantId);
    const { version } = await this.versions.getPlan(acting, planId);
    if (!version.periodsGeneratedAt) {
      await this.dataSource.transaction((manager) =>
        this.generator.regenerate(manager, version.id, null),
      );
    }
    await this.approval.approve(acting, planId, {
      expectedVersion: version.version,
      reason: 'approved on the v1 plan screen',
    });
  }

  private async attachHeader(
    manager: EntityManager,
    plan: ProductionPlan,
    refs: ResolvedRefs,
  ): Promise<void> {
    const scenarioId =
      plan.scenarioId ??
      (await this.versions.baselineScenario(manager, refs.tenantId)).id;
    await manager.update(ProductionPlan, plan.id, {
      scenarioId,
      unitRefId: refs.unitId,
      productRefId: refs.productId,
    });
    plan.scenarioId = scenarioId;
  }

  /** Updates the open version, or opens a new draft when there is none (current one approved). */
  private async writeDraft(
    manager: EntityManager,
    plan: ProductionPlan,
    refs: ResolvedRefs,
    acting: RequestContext,
  ): Promise<PlanVersion> {
    const open = await manager.findOne(PlanVersion, {
      where: { planId: plan.id, approvalState: In([...OPEN_STATES]) },
      lock: { mode: 'pessimistic_write' },
    });
    const latest = open ?? (await this.latestVersion(manager, plan.id));
    const base: PlanContent | null = latest
      ? contentOf(latest, await this.versions.slicesOf(latest.id, manager))
      : null;
    const content = contentFromHeader(plan, refs, base);
    await this.versions.assertContent(acting, content);
    if (open)
      return this.versions.writeDraft(manager, open, content, acting.userId);
    return this.versions.openDraft(manager, {
      planId: plan.id,
      content,
      actorId: acting.userId,
    });
  }

  private latestVersion(
    manager: EntityManager,
    planId: string,
  ): Promise<PlanVersion | null> {
    return manager.findOne(PlanVersion, {
      where: { planId },
      order: { version: 'DESC' },
    });
  }

  /** Generation refusals of a v1 save are stored on the draft (shown by the 3.4 UI), not thrown. */
  private async tryRegenerate(versionId: string): Promise<void> {
    try {
      await this.dataSource.transaction((manager) =>
        this.generator.regenerate(manager, versionId, null),
      );
    } catch (error: unknown) {
      if (!(error instanceof HttpException)) throw error;
      const body = error.getResponse();
      const code =
        typeof body === 'object' && body !== null && 'code' in body
          ? String(body.code)
          : `HTTP_${error.getStatus()}`;
      this.logger.warn(`Draft ${versionId}: generation refused (${code})`);
      await this.dataSource.manager.update(PlanVersion, versionId, {
        generationError: {
          code,
          message: error.message,
          at: new Date().toISOString(),
        },
      });
    }
  }

  private inScope(
    context: RequestContext,
    tenantId: string,
    unitId: string,
  ): boolean {
    if (context.isSuperAdmin) return true;
    if (context.tenantId !== tenantId) return false;
    const allowed = restrictedUnitIds(context, tenantId);
    return !allowed || allowed.includes(unitId);
  }

  /** The v1 varchar ids as rows of one tenant (product only when of the unit's tenant). */
  private async resolve(
    unitId: string,
    productId: string | null,
  ): Promise<ResolvedRefs | null> {
    const units = await this.dataSource.query<
      Array<{ id: string; tenant_id: string }>
    >(
      `SELECT "id", "tenant_id" FROM "units" WHERE "id"::text = lower(btrim($1)) AND "tenant_id" IS NOT NULL`,
      [unitId ?? ''],
    );
    if (units.length === 0) return null;
    const products = productId
      ? await this.dataSource.query<Array<{ id: string }>>(
          `SELECT "id" FROM "products" WHERE "id"::text = lower(btrim($1)) AND "tenant_id" = $2::uuid`,
          [productId, units[0].tenant_id],
        )
      : [];
    return {
      tenantId: units[0].tenant_id,
      unitId: units[0].id,
      productId: products[0]?.id ?? null,
    };
  }
}

/**
 * The caller acting inside the plan's tenant: equal to the caller's tenant for everyone but a SuperAdmin
 * (scope checked in `assertCreatable` / `assertWritable`).
 */
function actingContext(
  context: RequestContext,
  tenantId: string,
): RequestContext {
  return { ...context, tenantId };
}
