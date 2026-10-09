import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { ProfileReferences } from '../profiles/profile-references';
import { invalidReference } from './plan-errors';

/**
 * Body references of plan 2.3 checked against the acting tenant and the caller's unit scope: a foreign,
 * unknown or out-of-scope id is 422 `INVALID_REFERENCE`, never a hint that it exists elsewhere.
 */
@Injectable()
export class PlanReferences {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly profileReferences: ProfileReferences,
  ) {}

  assertUnit(context: RequestContext, unitId: string): Promise<void> {
    return this.profileReferences.assertUnit(context, unitId);
  }

  async assertProducts(
    context: RequestContext,
    productIds: readonly string[],
  ): Promise<void> {
    for (const [i, productId] of [...new Set(productIds)].entries()) {
      await this.profileReferences.assertProduct(
        context,
        productId,
        `slices[${i}].productId`,
      );
    }
  }

  async assertScenario(
    context: RequestContext,
    scenarioId: string,
  ): Promise<void> {
    const rows = await this.dataSource.query<unknown[]>(
      `SELECT 1 FROM "plan_scenarios" WHERE "id" = $1 AND "tenant_id" = $2`,
      [scenarioId, requireTenantId(context)],
    );
    if (rows.length === 0) throw invalidReference('scenarioId', 'scenario');
  }

  /** A pinned profile must be of the tenant and of the plan's unit and the slice's product. */
  async assertProfilePin(
    context: RequestContext,
    pin: { profileId: string; unitId: string; productId: string },
  ): Promise<void> {
    const rows = await this.dataSource.query<unknown[]>(
      `SELECT 1 FROM "production_profiles" WHERE "id" = $1 AND "tenant_id" = $2 AND "unit_id" = $3 AND "product_id" = $4`,
      [pin.profileId, requireTenantId(context), pin.unitId, pin.productId],
    );
    if (rows.length === 0) {
      throw invalidReference(
        'profileId',
        'profile of the plan unit and slice product',
      );
    }
  }
}
