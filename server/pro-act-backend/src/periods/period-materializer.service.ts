import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ActualsJobsService } from './actuals-jobs.service';
import { ProductionPeriod } from './entities/production-period.entity';
import { SliceResolverService } from './slice-resolver.service';

export interface MaterializeRequest {
  tenantId: string;
  /** null = every unit of the tenant with an approved profile */
  unitIds: string[] | null;
  from: Date;
  to: Date;
}

export interface MaterializeResult {
  created: number;
  /** instances that overlap an existing period with other bounds (calendar regenerated after the fact) */
  skipped: number;
  periodIds: string[];
}

/**
 * `PeriodMaterializer` of plan 2.4 step 1: one production period per shift instance (stored UTC bounds,
 * operational date, shift name and exclusion copied) whose start lies in `[from, to)`, for units with an
 * approved profile in that range — set-based, idempotent (an existing period of the same start is kept)
 * and serialized per tenant (advisory lock). Instances overlapping a period with other bounds are not
 * forced in (the exclusion constraint keeps periods disjoint); they are counted as skipped. New periods
 * get their product slices at once. Existing periods of the range without a slice are re-resolved when
 * their unit is in declared mode (the policy may now name the accounting product); those that gain a
 * slice are queued for a recompute.
 */
@Injectable()
export class PeriodMaterializerService {
  constructor(
    private readonly slices: SliceResolverService,
    private readonly jobs: ActualsJobsService,
  ) {}

  async materialize(
    manager: EntityManager,
    request: MaterializeRequest,
  ): Promise<MaterializeResult> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `production_periods:${request.tenantId}`,
    ]);
    const unitIds = await this.unitsWithProfile(manager, request);
    if (unitIds.length === 0) return { created: 0, skipped: 0, periodIds: [] };
    const inserted: Array<{ id: string }> = await manager.query(
      `INSERT INTO "production_periods" ("tenant_id", "row_version", "unit_id", "shift_instance_id",
              "calendar_version_id", "utc_start", "utc_end", "local_date", "shift_name", "is_excluded", "exclusion_kind")
       SELECT si."tenant_id", 1, si."unit_id", si."id", si."calendar_version_id", si."utc_start", si."utc_end",
              si."local_date", si."shift_name", si."is_excluded", si."exclusion_kind"
         FROM "shift_instances" si
        WHERE si."tenant_id" = $1 AND si."unit_id" = ANY($2::uuid[]) AND si."utc_start" >= $3 AND si."utc_start" < $4
          AND NOT EXISTS (SELECT 1 FROM "production_periods" p WHERE p."unit_id" = si."unit_id"
                AND tstzrange(p."utc_start", p."utc_end", '[)') && tstzrange(si."utc_start", si."utc_end", '[)'))
        ORDER BY si."utc_start"
       RETURNING "id"`,
      [request.tenantId, unitIds, request.from, request.to],
    );
    const skipped = await this.countSkipped(manager, request, unitIds);
    const created = inserted.length
      ? await manager.find(ProductionPeriod, {
          where: { id: In(inserted.map((row) => row.id)) },
        })
      : [];
    await this.slices.resolve(manager, created);
    await this.reresolveSliceless(manager, request, unitIds);
    return {
      created: created.length,
      skipped,
      periodIds: created.map((period) => period.id),
    };
  }

  /** Open periods of the range without an active slice, re-resolved under the declared rule only. */
  private async reresolveSliceless(
    manager: EntityManager,
    request: MaterializeRequest,
    unitIds: string[],
  ): Promise<void> {
    const rows: Array<{ id: string }> = await manager.query(
      `SELECT p."id" FROM "production_periods" p
        WHERE p."tenant_id" = $1 AND p."unit_id" = ANY($2::uuid[]) AND p."utc_start" >= $3 AND p."utc_start" < $4
          AND p."state_readiness" <> 'reconciled'
          AND NOT EXISTS (SELECT 1 FROM "period_product_slices" s
                           WHERE s."period_id" = p."id" AND s."superseded_at" IS NULL)`,
      [request.tenantId, unitIds, request.from, request.to],
    );
    if (rows.length === 0) return;
    const periods = await manager.find(ProductionPeriod, {
      where: { id: In(rows.map((row) => row.id)) },
    });
    const changed = await this.slices.resolve(manager, periods, {
      declaredOnly: true,
    });
    if (changed.length === 0) return;
    await this.jobs.enqueueIds(
      manager,
      request.tenantId,
      changed,
      'declared_slice_resolved',
    );
  }

  private async unitsWithProfile(
    manager: EntityManager,
    request: MaterializeRequest,
  ): Promise<string[]> {
    const rows: Array<{ unit_id: string }> = await manager.query(
      `SELECT DISTINCT "unit_id" FROM "production_profiles"
        WHERE "tenant_id" = $1 AND "state" = 'approved' AND "effective_from" < $3
          AND ("effective_to" IS NULL OR "effective_to" > $2)
          AND ($4::uuid[] IS NULL OR "unit_id" = ANY($4::uuid[]))`,
      [request.tenantId, request.from, request.to, request.unitIds],
    );
    return rows.map((row) => row.unit_id);
  }

  private async countSkipped(
    manager: EntityManager,
    request: MaterializeRequest,
    unitIds: string[],
  ): Promise<number> {
    const rows: Array<{ count: number }> = await manager.query(
      `SELECT count(*)::int AS "count" FROM "shift_instances" si
        WHERE si."tenant_id" = $1 AND si."unit_id" = ANY($2::uuid[]) AND si."utc_start" >= $3 AND si."utc_start" < $4
          AND NOT EXISTS (SELECT 1 FROM "production_periods" p WHERE p."unit_id" = si."unit_id"
                AND p."utc_start" = si."utc_start" AND p."utc_end" = si."utc_end")`,
      [request.tenantId, unitIds, request.from, request.to],
    );
    return rows[0]?.count ?? 0;
  }
}
