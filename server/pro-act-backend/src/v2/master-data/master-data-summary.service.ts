import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { restrictedUnitIds } from '../../common/query/scoped-query';
import { organizationOfTenant } from './common/master-data-writer';

/** `GET /api/v2/master-data/summary`: active record counts of the acting plant (the Master Data overview). */
export interface MasterDataSummaryV2View {
  units: number;
  assets: number;
  /** products of the plant plus the organisation's shared products */
  products: number;
  rcaTemplates: number;
  rcaCauses: number;
  verificationChecklists: number;
}

const COUNTS_SQL = `
  SELECT
    (SELECT count(*)::int FROM "units" u WHERE u."tenant_id" = $1::uuid AND u."retired_at" IS NULL
       AND ($3::text[] IS NULL OR u."id"::text = ANY($3::text[]))) AS units,
    (SELECT count(*)::int FROM "assets" a WHERE a."tenant_id" = $1::text AND a."retired_at" IS NULL
       AND ($3::text[] IS NULL OR a."unit_id" = ANY($3::text[]))) AS assets,
    (SELECT count(*)::int FROM "products" p WHERE p."is_active"
       AND (p."tenant_id" = $1::text OR (p."tenant_id" IS NULL AND p."organization_id" = $2::text))) AS products,
    (SELECT count(*)::int FROM "rca_templates" t WHERE t."tenant_id" = $1::uuid AND t."is_active") AS "rcaTemplates",
    (SELECT count(*)::int FROM "rca_cause_codes" c WHERE c."tenant_id" = $1::uuid AND c."is_active") AS "rcaCauses",
    (SELECT count(*)::int FROM "verification_status_codes" v WHERE v."tenant_id" = $1::uuid AND v."is_active")
      AS "verificationChecklists"`;

@Injectable()
export class MasterDataSummaryV2Service {
  constructor(@InjectEntityManager() private readonly manager: EntityManager) {}

  /** One round trip of six indexed counts; unit-scoped callers count their units and their assets. */
  async summary(context: RequestContext): Promise<MasterDataSummaryV2View> {
    const tenantId = requireTenantId(context);
    const organizationId = await organizationOfTenant(this.manager, tenantId);
    const unitIds = restrictedUnitIds(context, tenantId);
    const rows = await this.manager.query<MasterDataSummaryV2View[]>(
      COUNTS_SQL,
      [tenantId, organizationId, unitIds],
    );
    return rows[0];
  }
}
