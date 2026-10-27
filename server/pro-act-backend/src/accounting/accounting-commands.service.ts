import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../common/context/request-context';
import { ActualsJobsService } from '../periods/actuals-jobs.service';
import {
  assertBodyUnitsInScope,
  assertTenantWide,
  periodScopeUnits,
} from '../periods/period-scope';
import { invalid, invalidReference } from '../profiles/profile-errors';

/** One request recalculates at most this window (same bound as the 2.4 backfill). */
const RECALCULATE_MAX_DAYS = 92;
const DAY_MS = 86_400_000;

export interface RecalculateRequest {
  unitIds?: string[];
  from: string;
  to: string;
}

/**
 * Window recalculation (plan 2.5 step 5, `PeriodRecalculateRequested` on demand): queues one leased
 * calculation job per period of the named units overlapping `[from, to)`. Body unit ids must be units of
 * the tenant and of the caller's scope (422 INVALID_REFERENCE); without unit ids every unit is affected,
 * which needs a tenant-wide grant (403 TENANT_SCOPE_REQUIRED). Jobs record the requester's unit scope and
 * the worker re-checks it before writing.
 */
@Injectable()
export class AccountingCommandsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly jobs: ActualsJobsService,
  ) {}

  async recalculate(
    context: RequestContext,
    body: RecalculateRequest,
  ): Promise<{ queued: number }> {
    const tenantId = requireTenantId(context);
    const from = new Date(body.from);
    const to = new Date(body.to);
    if (!(from < to)) throw invalid('INVALID_RANGE', 'from must be before to');
    if (to.getTime() - from.getTime() > RECALCULATE_MAX_DAYS * DAY_MS) {
      throw invalid(
        'WINDOW_TOO_LARGE',
        `recalculate at most ${RECALCULATE_MAX_DAYS} days at once`,
      );
    }
    const unitIds = body.unitIds?.length ? [...new Set(body.unitIds)] : null;
    if (unitIds) {
      assertBodyUnitsInScope(context, unitIds);
      await this.assertTenantUnits(tenantId, unitIds);
    } else {
      assertTenantWide(context, 'Recalculating every unit');
    }
    const queued = await this.jobs.enqueue(this.dataSource.manager, {
      tenantId,
      unitIds,
      from,
      to,
      trigger: 'manual_recalculate',
      scopeUnitIds: periodScopeUnits(context),
      requestedBy: context.userId,
    });
    return { queued };
  }

  private async assertTenantUnits(
    tenantId: string,
    unitIds: string[],
  ): Promise<void> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "units" WHERE "id" = ANY($1::uuid[]) AND "tenant_id" = $2`,
      [unitIds, tenantId],
    );
    if (rows.length !== unitIds.length) {
      throw invalidReference('unitIds', 'unit');
    }
  }
}
