import { PeriodWarning } from './entities/production-period.entity';
import { SliceSource } from './entities/period-product-slice.entity';

/** An accounting-baseline plan period of the period's unit (approved version, baseline scenario). */
export interface BaselinePlanRow {
  planPeriodId: string;
  planVersionId: string;
  unitId: string;
  productId: string;
  profileId: string | null;
  quantityUom: string | null;
  utcStart: Date;
  utcEnd: Date;
  campaignFrom: Date | null;
  campaignTo: Date | null;
}

/** An approved production profile (normal mode) of the period's unit. */
export interface ProfileRow {
  id: string;
  unitId: string;
  productId: string;
  quantityUom: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  actualsPolicyId: string | null;
}

export interface DesiredSlice {
  productId: string;
  profileId: string | null;
  planPeriodId: string | null;
  source: SliceSource;
  windowFrom: Date;
  windowTo: Date;
  campaignFrom: Date | null;
  campaignTo: Date | null;
  quantityUom: string | null;
  /** policy pinned on the profile (`production_profiles.actuals_policy_id`), else resolved by scope */
  pinnedPolicyId: string | null;
}

export interface SlicePlan {
  slices: DesiredSlice[];
  planVersionId: string | null;
  warnings: PeriodWarning[];
}

/**
 * Product slices of one period (plan 2.4, §3.1): from the accounting-baseline plan periods overlapping it
 * (each clipped to the period; concurrent products → slices of the same window, campaigns → slices of
 * their part), else from the unit's single approved profile in force at the period start (its product is
 * the default). Several default candidates or none leave the period without slices and say why.
 */
export function planSlices(
  period: { unitId: string; utcStart: Date; utcEnd: Date },
  planRows: readonly BaselinePlanRow[],
  profiles: readonly ProfileRow[],
): SlicePlan {
  const rows = planRows.filter(
    (row) =>
      row.unitId === period.unitId &&
      row.utcStart < period.utcEnd &&
      row.utcEnd > period.utcStart,
  );
  if (rows.length > 0) return fromPlan(period, rows, profiles);
  const candidates = profiles.filter(
    (p) => p.unitId === period.unitId && inForce(p, period.utcStart),
  );
  if (candidates.length === 1) {
    return {
      slices: [defaultSlice(period, candidates[0])],
      planVersionId: null,
      warnings: [],
    };
  }
  const warning: PeriodWarning =
    candidates.length === 0
      ? {
          code: 'no_profile',
          message:
            'no approved production profile for the unit at the period start',
        }
      : {
          code: 'ambiguous_default_product',
          message:
            'several approved profiles and no accounting-baseline plan: approve a plan to choose the product',
          detail: { productIds: candidates.map((p) => p.productId) },
        };
  return { slices: [], planVersionId: null, warnings: [warning] };
}

function fromPlan(
  period: { unitId: string; utcStart: Date; utcEnd: Date },
  rows: readonly BaselinePlanRow[],
  profiles: readonly ProfileRow[],
): SlicePlan {
  const versions = [...new Set(rows.map((row) => row.planVersionId))];
  const warnings: PeriodWarning[] =
    versions.length > 1
      ? [
          {
            code: 'several_plan_versions',
            message: 'the period is planned by several baseline plan versions',
            detail: { versions },
          },
        ]
      : [];
  const slices = rows.map((row): DesiredSlice => {
    const windowFrom = new Date(
      Math.max(row.utcStart.getTime(), period.utcStart.getTime()),
    );
    const profile = profileFor(profiles, row, windowFrom);
    return {
      productId: row.productId,
      profileId: row.profileId ?? profile?.id ?? null,
      planPeriodId: row.planPeriodId,
      source: 'plan',
      windowFrom,
      windowTo: new Date(
        Math.min(row.utcEnd.getTime(), period.utcEnd.getTime()),
      ),
      campaignFrom: row.campaignFrom,
      campaignTo: row.campaignTo,
      quantityUom: row.quantityUom ?? profile?.quantityUom ?? null,
      pinnedPolicyId: profile?.actualsPolicyId ?? null,
    };
  });
  return { slices, planVersionId: versions[0], warnings };
}

function profileFor(
  profiles: readonly ProfileRow[],
  row: BaselinePlanRow,
  at: Date,
): ProfileRow | undefined {
  if (row.profileId) return profiles.find((p) => p.id === row.profileId);
  return profiles.find(
    (p) =>
      p.unitId === row.unitId &&
      p.productId === row.productId &&
      inForce(p, at),
  );
}

function defaultSlice(
  period: { utcStart: Date; utcEnd: Date },
  profile: ProfileRow,
): DesiredSlice {
  return {
    productId: profile.productId,
    profileId: profile.id,
    planPeriodId: null,
    source: 'profile_default',
    windowFrom: period.utcStart,
    windowTo: period.utcEnd,
    campaignFrom: null,
    campaignTo: null,
    quantityUom: profile.quantityUom,
    pinnedPolicyId: profile.actualsPolicyId,
  };
}

export function inForce(profile: ProfileRow, at: Date): boolean {
  return (
    profile.effectiveFrom <= at &&
    (profile.effectiveTo === null || profile.effectiveTo > at)
  );
}

/** Same product, window, plan period and profile: an unchanged slice is kept as it is. */
export function sameSlice(
  a: Pick<
    DesiredSlice,
    'productId' | 'windowFrom' | 'windowTo' | 'planPeriodId' | 'profileId'
  >,
  b: Pick<
    DesiredSlice,
    'productId' | 'windowFrom' | 'windowTo' | 'planPeriodId' | 'profileId'
  >,
): boolean {
  return (
    a.productId === b.productId &&
    a.windowFrom.getTime() === b.windowFrom.getTime() &&
    a.windowTo.getTime() === b.windowTo.getTime() &&
    a.planPeriodId === b.planPeriodId &&
    a.profileId === b.profileId
  );
}
