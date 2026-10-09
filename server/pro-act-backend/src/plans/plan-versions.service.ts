import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { assertRevision } from '../common/concurrency/revision';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { OPEN_STATES } from '../domain/plans/plan.types';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { PlanProductSlice } from './entities/plan-product-slice.entity';
import { PlanScenario } from './entities/plan-scenario.entity';
import { PlanVersion } from './entities/plan-version.entity';
import {
  contentOf,
  PlanContent,
  sliceRows,
  versionColumns,
  windowOf,
} from './plan-content';
import { conflict, invalid, notFound } from './plan-errors';
import { PlanReferences } from './plan-references';
import { PlanScenariosService } from './plan-scenarios.service';

export type NewPlan = PlanContent & { name: string; scenarioId?: string };

export interface PlanState {
  plan: ProductionPlan;
  version: PlanVersion;
}

/**
 * Plan headers and versions (plan 2.3, PLAN02/PLAN04): a plan is created with draft version 1; after an
 * approval a change is a **new** draft version (at most one open version per plan); drafts are edited with
 * If-Match and lose their periods on any change. Every read and write is scoped through the plan's current
 * version (tenant and unit scope): a plan outside the caller's scope answers 404.
 */
@Injectable()
export class PlanVersionsService {
  constructor(
    @InjectRepository(PlanVersion)
    private readonly versions: Repository<PlanVersion>,
    @InjectRepository(PlanProductSlice)
    private readonly slices: Repository<PlanProductSlice>,
    private readonly references: PlanReferences,
    private readonly scenarios: PlanScenariosService,
  ) {}

  async createPlan(
    context: RequestContext,
    input: NewPlan,
  ): Promise<PlanState> {
    const tenantId = requireTenantId(context);
    await this.assertContent(context, input);
    if (input.scenarioId) {
      await this.references.assertScenario(context, input.scenarioId);
    }
    return this.versions.manager.transaction(async (manager) => {
      const scenarioId =
        input.scenarioId ??
        (await this.scenarios.baselineScenario(manager, tenantId)).id;
      const plan = await manager.save(
        manager.create(ProductionPlan, {
          name: input.name.trim(),
          tenantId,
          scenarioId,
          approvalStatus: 'Draft',
          ...headerColumns(input, 1),
        }),
      );
      const version = await this.insertVersion(manager, {
        plan,
        number: 1,
        content: input,
        actorId: context.userId,
      });
      return { plan, version };
    });
  }

  /** The tenant's accounting-baseline scenario (created on first use). */
  baselineScenario(
    manager: EntityManager,
    tenantId: string,
  ): Promise<PlanScenario> {
    return this.scenarios.baselineScenario(manager, tenantId);
  }

  /** The plan and its current version, within the caller's tenant and unit scope (404 otherwise). */
  async getPlan(context: RequestContext, planId: string): Promise<PlanState> {
    const version = await scopedQuery(this.versions, 'v', {
      context,
      unitProperty: 'unitId',
    })
      .innerJoin(
        ProductionPlan,
        'p',
        'p.id = v.planId AND p.currentVersion = v.version',
      )
      .andWhere('v.planId = :planId', { planId })
      .getOne();
    if (!version) throw notFound('Production plan');
    const plan = await this.versions.manager.findOneByOrFail(ProductionPlan, {
      id: planId,
    });
    return { plan, version };
  }

  /** One version of a visible plan (the version itself must be in the caller's unit scope). */
  async getVersion(
    context: RequestContext,
    planId: string,
    number: number,
  ): Promise<PlanVersion> {
    await this.getPlan(context, planId);
    const version = await scopedQuery(this.versions, 'v', {
      context,
      unitProperty: 'unitId',
    })
      .andWhere('v.planId = :planId AND v.version = :number', {
        planId,
        number,
      })
      .getOne();
    if (!version) throw notFound('Plan version');
    return version;
  }

  slicesOf(
    versionId: string,
    manager?: EntityManager,
  ): Promise<PlanProductSlice[]> {
    return (manager ?? this.slices.manager).find(PlanProductSlice, {
      where: { planVersionId: versionId },
      order: { position: 'ASC' },
    });
  }

  /** A new draft version from the current one plus `patch` (after an approval: PLAN04). */
  async newDraft(
    context: RequestContext,
    planId: string,
    patch: Partial<PlanContent>,
  ): Promise<PlanVersion> {
    const { version: current } = await this.getPlan(context, planId);
    const base = contentOf(current, await this.slicesOf(current.id));
    const content: PlanContent = { ...base, ...withoutUndefined(patch) };
    await this.assertContent(context, content);
    return this.versions.manager.transaction((manager) =>
      this.openDraft(manager, { planId, content, actorId: context.userId }),
    );
  }

  /** Edits an open draft (If-Match); its periods are discarded until the next generation. */
  async updateDraft(
    context: RequestContext,
    target: { planId: string; version: number; expectedRevision: number },
    patch: Partial<PlanContent>,
  ): Promise<PlanVersion> {
    const found = await this.getVersion(context, target.planId, target.version);
    const base = contentOf(found, await this.slicesOf(found.id));
    const content: PlanContent = { ...base, ...withoutUndefined(patch) };
    await this.assertContent(context, content);
    return this.versions.manager.transaction(async (manager) => {
      const locked = await lockVersion(manager, found.id);
      if (locked.approvalState !== 'draft') {
        throw conflict(
          'VERSION_NOT_DRAFT',
          'only a draft plan version is edited; create a new version',
        );
      }
      assertRevision(locked.rowVersion, target.expectedRevision);
      return this.writeDraft(manager, locked, content, context.userId);
    });
  }

  /**
   * Opens draft `currentVersion + 1` of a plan (409 `DRAFT_EXISTS` while one is open) and points the
   * header at it. Callers have checked scope and references.
   */
  async openDraft(
    manager: EntityManager,
    args: { planId: string; content: PlanContent; actorId: string | null },
  ): Promise<PlanVersion> {
    const plan = await manager.findOneOrFail(ProductionPlan, {
      where: { id: args.planId },
      lock: { mode: 'pessimistic_write' },
    });
    const open = await manager.countBy(PlanVersion, {
      planId: plan.id,
      approvalState: In([...OPEN_STATES]),
    });
    if (open > 0) {
      throw conflict(
        'DRAFT_EXISTS',
        'the plan already has an open version; edit it instead',
      );
    }
    const number = (plan.currentVersion ?? 0) + 1;
    const version = await this.insertVersion(manager, {
      plan,
      number,
      content: args.content,
      actorId: args.actorId,
    });
    await manager.update(ProductionPlan, plan.id, {
      ...headerColumns(args.content, number),
      approvalStatus: 'Draft',
    });
    return version;
  }

  /** Replaces a draft's content and slices (its periods go with the slices). */
  async writeDraft(
    manager: EntityManager,
    version: PlanVersion,
    content: PlanContent,
    actorId: string | null,
  ): Promise<PlanVersion> {
    Object.assign(version, versionColumns(content), { updatedBy: actorId });
    const saved = await manager.save(version);
    await manager.delete(PlanProductSlice, { planVersionId: saved.id });
    await insertSlices(
      manager,
      sliceRows(saved, windowOf(content), content.slices, actorId),
    );
    const plan = await manager.findOneByOrFail(ProductionPlan, {
      id: saved.planId,
    });
    if (plan.currentVersion === saved.version) {
      await manager.update(
        ProductionPlan,
        plan.id,
        headerColumns(content, saved.version),
      );
    }
    return saved;
  }

  /** Tenant, unit-scope and product checks of a content (422 INVALID_REFERENCE). */
  async assertContent(
    context: RequestContext,
    content: PlanContent,
  ): Promise<void> {
    windowOf(content);
    await this.references.assertUnit(context, content.unitId);
    await this.references.assertProducts(
      context,
      content.slices.map((slice) => slice.productId),
    );
    for (const slice of content.slices) {
      if (slice.profileId) {
        await this.references.assertProfilePin(context, {
          profileId: slice.profileId,
          unitId: content.unitId,
          productId: slice.productId,
        });
      }
    }
    for (const entry of content.manualTargets ?? []) {
      if (entry.slicePosition >= content.slices.length) {
        throw invalid(
          'UNKNOWN_SLICE',
          'manualTargets name a slice position that does not exist',
        );
      }
    }
  }

  private async insertVersion(
    manager: EntityManager,
    args: {
      plan: ProductionPlan;
      number: number;
      content: PlanContent;
      actorId: string | null;
    },
  ): Promise<PlanVersion> {
    const scenarioId = args.plan.scenarioId;
    if (!scenarioId) throw notFound('Plan scenario');
    const unit = await manager.query<Array<{ tenant_id: string }>>(
      `SELECT "tenant_id" FROM "units" WHERE "id" = $1`,
      [args.content.unitId],
    );
    const version = await manager.save(
      manager.create(PlanVersion, {
        ...versionColumns(args.content),
        tenantId: unit[0].tenant_id,
        planId: args.plan.id,
        version: args.number,
        scenarioId,
        approvalState: 'draft',
        createdBy: args.actorId,
        updatedBy: args.actorId,
      }),
    );
    await insertSlices(
      manager,
      sliceRows(
        version,
        windowOf(args.content),
        args.content.slices,
        args.actorId,
      ),
    );
    return version;
  }
}

/** v1 header columns that mirror the current version (legacy screens keep rendering, C4). */
export function headerColumns(
  content: PlanContent,
  currentVersion: number,
): Partial<ProductionPlan> {
  const window = windowOf(content);
  const productId = content.slices[0]?.productId;
  const columns: Partial<ProductionPlan> = {
    unitId: content.unitId,
    unitRefId: content.unitId,
    productId,
    productRefId: productId ?? null,
    startDate: window.from,
    endDate: window.to,
    currentVersion,
  };
  if (content.headerTarget !== null && content.headerTarget !== undefined) {
    columns.plannedQuantity = Number(content.headerTarget);
  }
  return columns;
}

async function insertSlices(
  manager: EntityManager,
  rows: Array<QueryDeepPartialEntity<PlanProductSlice>>,
): Promise<void> {
  if (rows.length > 0) await manager.insert(PlanProductSlice, rows);
}

async function lockVersion(
  manager: EntityManager,
  id: string,
): Promise<PlanVersion> {
  return manager.findOneOrFail(PlanVersion, {
    where: { id },
    lock: { mode: 'pessimistic_write' },
  });
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
