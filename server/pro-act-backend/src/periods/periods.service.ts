import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { invalid, invalidReference } from '../profiles/profile-errors';
import {
  MaterializeResult,
  PeriodMaterializerService,
} from './period-materializer.service';
import { assertBodyUnitsInScope, assertTenantWide } from './period-scope';

/** A backfill covers at most this many days (D07 pilot sizing: 5 units × 3 shifts × 92 days). */
const MATERIALIZE_MAX_DAYS = 92;
const DAY_MS = 86_400_000;

/**
 * On-demand period materialization (plan 2.4 step 1 backfill): `[from, to)` of shift starts, for the
 * named units (each of the tenant and of the caller's scope, 422 otherwise) or — tenant-wide callers
 * only (403 TENANT_SCOPE_REQUIRED) — every unit with an approved profile.
 */
@Injectable()
export class PeriodsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly materializer: PeriodMaterializerService,
  ) {}

  async materialize(
    context: RequestContext,
    body: { unitIds?: string[]; from: string; to: string },
  ): Promise<MaterializeResult> {
    const tenantId = requireTenantId(context);
    const from = new Date(body.from);
    const to = new Date(body.to);
    if (!(from < to)) throw invalid('INVALID_RANGE', 'from must be before to');
    if (to.getTime() - from.getTime() > MATERIALIZE_MAX_DAYS * DAY_MS) {
      throw invalid(
        'WINDOW_TOO_LARGE',
        `materialize at most ${MATERIALIZE_MAX_DAYS} days at once`,
      );
    }
    const unitIds = body.unitIds?.length ? [...new Set(body.unitIds)] : null;
    if (unitIds) {
      assertBodyUnitsInScope(context, unitIds);
      await this.assertTenantUnits(tenantId, unitIds);
    } else {
      assertTenantWide(context, 'Materializing every unit');
    }
    return this.dataSource.transaction((manager) =>
      this.materializer.materialize(manager, { tenantId, unitIds, from, to }),
    );
  }

  private async assertTenantUnits(
    tenantId: string,
    unitIds: string[],
  ): Promise<void> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "units" WHERE "id" = ANY($1::uuid[]) AND "tenant_id" = $2`,
      [unitIds, tenantId],
    );
    if (rows.length !== unitIds.length)
      throw invalidReference('unitIds', 'unit');
  }
}
