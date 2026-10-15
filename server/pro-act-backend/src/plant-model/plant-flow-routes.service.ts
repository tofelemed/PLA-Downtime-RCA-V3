import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { scopedQuery } from '../common/query/scoped-query';
import { invalid, notFound } from '../profiles/profile-errors';
import { ProfileReferences } from '../profiles/profile-references';
import { validityOf } from '../profiles/profiles.service';
import {
  approveVersion,
  nextVersion,
  retireVersion,
} from '../profiles/versioning';
import {
  FlowRouteRole,
  PlantFlowRoute,
} from './entities/plant-flow-route.entity';
import { recordPlantModelChange } from './plant-model-events';
import {
  assertRouteQuantities,
  CYCLE_SQL,
  RouteQuantities,
} from './plant-flow-rules';

export interface NewFlowRoute extends RouteQuantities {
  fromUnitId: string;
  toUnitId: string;
  routeRole?: FlowRouteRole;
  bufferName?: string | null;
  notes?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

const WHAT = 'flow route';

const keyOf = (row: { fromUnitId: string; toUnitId: string }) => ({
  fromUnitId: row.fromUnitId,
  toUnitId: row.toUnitId,
});

const text = (value: string | null | undefined) => value?.trim() || null;

/**
 * The plant's material-flow map (SME E2): routes between units with their buffers, drafted by master
 * data and approved by another user (maker-checker, 403 SEPARATION_OF_DUTIES), never overlapping an
 * approved version of the same route unless superseding it, never closing a cycle (422 FLOW_CYCLE).
 * Approving or retiring a route recalculates the downstream unit's periods over its validity.
 */
@Injectable()
export class PlantFlowRoutesService {
  constructor(
    @InjectRepository(PlantFlowRoute)
    private readonly routes: Repository<PlantFlowRoute>,
    private readonly references: ProfileReferences,
  ) {}

  async create(
    context: RequestContext,
    input: NewFlowRoute,
  ): Promise<PlantFlowRoute> {
    await this.references.assertUnit(context, input.fromUnitId, 'fromUnitId');
    await this.references.assertUnit(context, input.toUnitId, 'toUnitId');
    if (input.fromUnitId === input.toUnitId)
      throw invalid('SAME_UNIT', 'fromUnitId and toUnitId must differ');
    assertRouteQuantities(input);
    const validity = validityOf(input);
    return this.routes.manager.transaction(async (manager) => {
      const key = keyOf(input);
      const version = await nextVersion(manager, PlantFlowRoute, key);
      return manager.save(
        manager.create(PlantFlowRoute, {
          tenantId: requireTenantId(context),
          ...key,
          routeRole: input.routeRole ?? 'feed',
          yieldFactor: input.yieldFactor ?? '1',
          bufferName: text(input.bufferName),
          usableInventory: input.usableInventory ?? null,
          minOperatingLevel: input.minOperatingLevel ?? null,
          maxOperatingLevel: input.maxOperatingLevel ?? null,
          inventoryUom: text(input.inventoryUom),
          drawRatePerHour: input.drawRatePerHour ?? null,
          notes: text(input.notes),
          effectiveFrom: validity.from,
          effectiveTo: validity.to,
          version,
          state: 'draft',
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  async get(context: RequestContext, id: string): Promise<PlantFlowRoute> {
    const row = await scopedQuery(this.routes, 'r', {
      context,
      unitProperty: 'toUnitId',
    })
      .andWhere('r.id = :id', { id })
      .getOne();
    if (!row) throw notFound('Flow route');
    return row;
  }

  async approve(
    context: RequestContext,
    id: string,
    supersede: boolean,
  ): Promise<PlantFlowRoute> {
    const row = await this.get(context, id);
    return this.routes.manager.transaction(async (manager) => {
      await assertNoCycle(manager, row);
      const result = await approveVersion(
        manager,
        PlantFlowRoute,
        { id, key: keyOf(row), supersede, actorId: context.userId },
        WHAT,
      );
      await this.changed(manager, result.approved, 'approved');
      return result.approved;
    });
  }

  async retire(context: RequestContext, id: string): Promise<PlantFlowRoute> {
    const row = await this.get(context, id);
    return this.routes.manager.transaction(async (manager) => {
      const retired = await retireVersion(
        manager,
        PlantFlowRoute,
        { id: row.id, actorId: context.userId },
        WHAT,
      );
      if (row.state === 'approved')
        await this.changed(manager, retired, 'retired');
      return retired;
    });
  }

  private changed(
    manager: EntityManager,
    row: PlantFlowRoute,
    change: string,
  ): Promise<void> {
    return recordPlantModelChange(manager, {
      tenantId: row.tenantId,
      aggregateId: row.id,
      rowVersion: row.rowVersion,
      subject: 'plant_flow',
      change,
      unitId: row.toUnitId,
      from: row.effectiveFrom,
      to: row.effectiveTo,
    });
  }
}

/** 422 FLOW_CYCLE when an approved path already leads from the route's to-unit back to its from-unit. */
async function assertNoCycle(
  manager: EntityManager,
  row: PlantFlowRoute,
): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `plant_flow_routes:${row.tenantId}`,
  ]);
  const rows = await manager.query<unknown[]>(CYCLE_SQL, [
    row.tenantId,
    row.toUnitId,
    row.fromUnitId,
    row.effectiveFrom,
    row.effectiveTo,
  ]);
  if (rows.length > 0) {
    throw new UnprocessableEntityException({
      code: 'FLOW_CYCLE',
      message: 'the route would close a cycle in the material-flow map',
    });
  }
}
