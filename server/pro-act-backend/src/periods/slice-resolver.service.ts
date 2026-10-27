import { Injectable } from '@nestjs/common';
import { EntityManager, In, IsNull } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AccountingPoliciesService } from './accounting-policies.service';
import { ActualsAdjustment } from './entities/actuals-adjustment.entity';
import { PeriodProductSlice } from './entities/period-product-slice.entity';
import {
  PeriodWarning,
  ProductionPeriod,
} from './entities/production-period.entity';
import { parseLossAccounting } from './loss-accounting-policy';
import { policyBodiesInForce } from './policy-bodies-in-force';
import {
  BaselinePlanRow,
  DesiredSlice,
  planSlices,
  ProfileRow,
  sameSlice,
  SlicePlan,
} from './slice-plan';
import { planDeclaredSlice } from './slice-plan-declared';

/** Bounds of a group of periods (one load of plan rows and profiles for all of them). */
interface Span {
  tenantId: string;
  unitIds: string[];
  from: Date;
  to: Date;
}

/**
 * Writes the product slices of periods (plan 2.4 step 1): loads the accounting-baseline plan periods and
 * approved profiles of the periods' units once, plans each period's slices (`planSlices`), keeps unchanged
 * slices, retires changed ones (`superseded_at`, results keep pointing at them) and inserts the new ones
 * with the actuals policy in force (profile pin, else unit, else tenant).
 */
@Injectable()
export class SliceResolverService {
  constructor(private readonly policies: AccountingPoliciesService) {}

  /**
   * Returns the ids of periods whose slice set changed. `declaredOnly` leaves every period whose unit is in
   * computed mode at its start untouched (the re-resolution of slice-less declared periods).
   */
  async resolve(
    manager: EntityManager,
    periods: readonly ProductionPeriod[],
    options: { declaredOnly?: boolean } = {},
  ): Promise<string[]> {
    if (periods.length === 0) return [];
    const span = spanOf(periods);
    const [planRows, profiles] = await Promise.all([
      this.baselineRows(manager, span),
      this.profiles(manager, span),
    ]);
    const active = await manager.find(PeriodProductSlice, {
      where: { periodId: In(periods.map((p) => p.id)), supersededAt: IsNull() },
    });
    const declared = await declaredProducts(manager, periods);
    const changed: string[] = [];
    for (const [index, period] of periods.entries()) {
      const product = declared[index];
      if (options.declaredOnly && product === undefined) continue;
      const plan: SlicePlan =
        product === undefined
          ? planSlices(period, planRows, profiles)
          : planDeclaredSlice(period, planRows, profiles, product);
      const current = active.filter((slice) => slice.periodId === period.id);
      if (await this.apply(manager, period, plan.slices, current)) {
        changed.push(period.id);
      }
      await manager.update(ProductionPeriod, period.id, {
        selectedPlanVersionId: plan.planVersionId,
        // jsonb column: TypeORM's deep-partial type cannot express open records
        warnings: plan.warnings as QueryDeepPartialEntity<PeriodWarning>[],
        slicesResolvedAt: new Date(),
      });
    }
    return changed;
  }

  private async apply(
    manager: EntityManager,
    period: ProductionPeriod,
    desired: readonly DesiredSlice[],
    current: readonly PeriodProductSlice[],
  ): Promise<boolean> {
    const stale = current.filter(
      (slice) => !desired.some((d) => sameSlice(d, slice)),
    );
    const fresh = desired.filter(
      (d) => !current.some((slice) => sameSlice(d, slice)),
    );
    if (stale.length === 0 && fresh.length === 0) return false;
    if (stale.length > 0) {
      await manager.update(
        PeriodProductSlice,
        { id: In(stale.map((slice) => slice.id)) },
        { supersededAt: new Date() },
      );
    }
    const inserted = new Map<string, string>();
    for (const slice of fresh) {
      inserted.set(slice.productId, await this.insert(manager, period, slice));
    }
    await this.carryAdjustments(manager, stale, inserted);
    return true;
  }

  private async insert(
    manager: EntityManager,
    period: ProductionPeriod,
    slice: DesiredSlice,
  ): Promise<string> {
    const policyId =
      slice.pinnedPolicyId ??
      (await this.policies.sourceAuthorityId(
        manager,
        { tenantId: period.tenantId, unitId: period.unitId },
        slice.windowFrom,
      ));
    const result = await manager.insert(PeriodProductSlice, {
      tenantId: period.tenantId,
      periodId: period.id,
      productId: slice.productId,
      profileId: slice.profileId,
      planPeriodId: slice.planPeriodId,
      source: slice.source,
      windowFrom: slice.windowFrom,
      windowTo: slice.windowTo,
      campaignFrom: slice.campaignFrom,
      campaignTo: slice.campaignTo,
      quantityUom: slice.quantityUom,
      actualsPolicyId: policyId,
    });
    return String(result.identifiers[0].id);
  }

  /** Adjustments of a retired slice follow the new slice of the same product (they describe the product). */
  private async carryAdjustments(
    manager: EntityManager,
    stale: readonly PeriodProductSlice[],
    inserted: ReadonlyMap<string, string>,
  ): Promise<void> {
    for (const slice of stale) {
      const successor = inserted.get(slice.productId);
      if (!successor) continue;
      await manager.update(
        ActualsAdjustment,
        { sliceId: slice.id },
        { sliceId: successor },
      );
    }
  }

  private async baselineRows(
    manager: EntityManager,
    span: Span,
  ): Promise<BaselinePlanRow[]> {
    const rows: Array<Record<string, unknown>> = await manager.query(
      `SELECT pp."id", pp."plan_version_id", pp."unit_id", pp."profile_id", pp."quantity_uom", pp."utc_start",
              pp."utc_end", sl."product_id", sl."campaign_from", sl."campaign_to"
         FROM "plan_periods" pp
         JOIN "plan_versions" v ON v."id" = pp."plan_version_id" AND v."approval_state" = 'approved'
         JOIN "plan_scenarios" s ON s."id" = v."scenario_id" AND s."is_accounting_baseline"
         JOIN "plan_product_slices" sl ON sl."id" = pp."slice_id"
        WHERE pp."tenant_id" = $1 AND pp."unit_id" = ANY($2::uuid[]) AND pp."utc_start" < $4 AND pp."utc_end" > $3
        ORDER BY pp."utc_start", sl."position"`,
      [span.tenantId, span.unitIds, span.from, span.to],
    );
    return rows.map((row) => ({
      planPeriodId: row.id as string,
      planVersionId: row.plan_version_id as string,
      unitId: row.unit_id as string,
      productId: row.product_id as string,
      profileId: (row.profile_id as string | null) ?? null,
      quantityUom: (row.quantity_uom as string | null) ?? null,
      utcStart: new Date(row.utc_start as string),
      utcEnd: new Date(row.utc_end as string),
      campaignFrom: dateOrNull(row.campaign_from),
      campaignTo: dateOrNull(row.campaign_to),
    }));
  }

  private async profiles(
    manager: EntityManager,
    span: Span,
  ): Promise<ProfileRow[]> {
    const rows: Array<Record<string, unknown>> = await manager.query(
      `SELECT "id", "unit_id", "product_id", "quantity_uom", "effective_from", "effective_to", "actuals_policy_id"
         FROM "production_profiles"
        WHERE "tenant_id" = $1 AND "unit_id" = ANY($2::uuid[]) AND "state" = 'approved'
          AND "operating_mode" = 'normal' AND "effective_from" < $4
          AND ("effective_to" IS NULL OR "effective_to" > $3)`,
      [span.tenantId, span.unitIds, span.from, span.to],
    );
    return rows.map((row) => ({
      id: row.id as string,
      unitId: row.unit_id as string,
      productId: row.product_id as string,
      quantityUom: (row.quantity_uom as string | null) ?? null,
      effectiveFrom: new Date(row.effective_from as string),
      effectiveTo: dateOrNull(row.effective_to),
      actualsPolicyId: (row.actuals_policy_id as string | null) ?? null,
    }));
  }
}

/**
 * Per period: `undefined` when the unit's `loss_accounting` in force at the period start is computed (or
 * none is stored), else the policy's `accountingProductId` (null = none) — the declared slice rule applies.
 */
async function declaredProducts(
  manager: EntityManager,
  periods: readonly ProductionPeriod[],
): Promise<Array<string | null | undefined>> {
  const bodies = await policyBodiesInForce(
    manager,
    'loss_accounting',
    periods.map((p) => ({
      tenantId: p.tenantId,
      unitId: p.unitId,
      at: p.utcStart,
    })),
  );
  return bodies.map((body) => {
    if (body === undefined) return undefined;
    const policy = parseLossAccounting(body);
    return policy.lossBasis === 'declared'
      ? policy.accountingProductId
      : undefined;
  });
}

function spanOf(periods: readonly ProductionPeriod[]): Span {
  return {
    tenantId: periods[0].tenantId,
    unitIds: [...new Set(periods.map((p) => p.unitId))],
    from: new Date(Math.min(...periods.map((p) => p.utcStart.getTime()))),
    to: new Date(Math.max(...periods.map((p) => p.utcEnd.getTime()))),
  };
}

function dateOrNull(value: unknown): Date | null {
  return value === null || value === undefined
    ? null
    : new Date(value as string);
}
