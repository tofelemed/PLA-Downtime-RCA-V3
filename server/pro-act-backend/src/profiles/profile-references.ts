import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { restrictedUnitIds } from '../common/query/scoped-query';
import { invalidReference } from './profile-errors';

/**
 * Body references of plan 2.2 checked against the acting tenant (and the caller's unit scope): a foreign
 * or unknown id is 422 `INVALID_REFERENCE`, never a hint that it exists elsewhere.
 */
@Injectable()
export class ProfileReferences {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async assertUnit(
    context: RequestContext,
    unitId: string,
    field = 'unitId',
  ): Promise<void> {
    const tenantId = requireTenantId(context);
    const allowed = restrictedUnitIds(context, tenantId);
    const found = await this.exists(
      `SELECT 1 FROM "units" WHERE "id" = $1 AND "tenant_id" = $2`,
      [unitId, tenantId],
    );
    if (!found || (allowed && !allowed.includes(unitId))) {
      throw invalidReference(field, 'unit');
    }
  }

  async assertProduct(
    context: RequestContext,
    productId: string,
    field = 'productId',
  ): Promise<void> {
    const found = await this.exists(
      `SELECT 1 FROM "products" WHERE "id" = $1 AND "tenant_id" = $2::uuid`,
      [productId, requireTenantId(context).toLowerCase()],
    );
    if (!found) throw invalidReference(field, 'product');
  }

  async assertImpactCode(
    context: RequestContext,
    impactCodeId: string,
  ): Promise<void> {
    const found = await this.exists(
      `SELECT 1 FROM "impact_codes" WHERE "id" = $1 AND "tenant_id"::text = $2`,
      [impactCodeId, requireTenantId(context)],
    );
    if (!found) throw invalidReference('impactCodeId', 'impact code');
  }

  private async exists(sql: string, params: unknown[]): Promise<boolean> {
    const rows = await this.dataSource.query<unknown[]>(sql, params);
    return rows.length > 0;
  }
}
