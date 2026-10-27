import {
  BaselinePlanRow,
  DesiredSlice,
  inForce,
  planSlices,
  ProfileRow,
  SlicePlan,
} from './slice-plan';

interface PeriodWindow {
  unitId: string;
  utcStart: Date;
  utcEnd: Date;
}

const overlapMs = (period: PeriodWindow, row: BaselinePlanRow): number =>
  Math.min(row.utcEnd.getTime(), period.utcEnd.getTime()) -
  Math.max(row.utcStart.getTime(), period.utcStart.getTime());

/** The plan period covering most of the window (the earliest on a tie). */
function mainRow(
  period: PeriodWindow,
  rows: readonly BaselinePlanRow[],
): BaselinePlanRow {
  return rows.reduce((best, row) =>
    overlapMs(period, row) > overlapMs(period, best) ? row : best,
  );
}

/** One plan slice widened to the whole period; several plan versions are still reported. */
function fromPlan(
  period: PeriodWindow,
  rows: readonly BaselinePlanRow[],
  profiles: readonly ProfileRow[],
): SlicePlan {
  const row = mainRow(period, rows);
  const planned = planSlices(period, [row], profiles);
  const versions = [...new Set(rows.map((r) => r.planVersionId))];
  return {
    slices: planned.slices.map((slice) => ({
      ...slice,
      windowFrom: period.utcStart,
      windowTo: period.utcEnd,
    })),
    planVersionId: row.planVersionId,
    warnings:
      versions.length > 1
        ? [
            {
              code: 'several_plan_versions',
              message:
                'the period is planned by several baseline plan versions',
              detail: { versions },
            },
          ]
        : [],
  };
}

/** The policy's accounting product over the whole period, with its approved profile when it has one. */
function policySlice(
  period: PeriodWindow,
  profiles: readonly ProfileRow[],
  productId: string,
): DesiredSlice {
  const profile = profiles.find(
    (p) =>
      p.unitId === period.unitId &&
      p.productId === productId &&
      inForce(p, period.utcStart),
  );
  return {
    productId,
    profileId: profile?.id ?? null,
    planPeriodId: null,
    source: 'profile_default',
    windowFrom: period.utcStart,
    windowTo: period.utcEnd,
    campaignFrom: null,
    campaignTo: null,
    quantityUom: profile?.quantityUom ?? null,
    pinnedPolicyId: profile?.actualsPolicyId ?? null,
  };
}

/**
 * Declared mode (spec D4): exactly one slice over the whole period — the product of the accounting-baseline
 * plan period covering most of it, else of the unit's single approved profile, else the loss-accounting
 * policy's `accountingProductId`; without any of them the period keeps no slice and the computed warning
 * (`no_profile`, `ambiguous_default_product`). A campaign change inside the period does not split it.
 */
export function planDeclaredSlice(
  period: PeriodWindow,
  planRows: readonly BaselinePlanRow[],
  profiles: readonly ProfileRow[],
  accountingProductId: string | null,
): SlicePlan {
  const rows = planRows.filter(
    (row) =>
      row.unitId === period.unitId &&
      row.utcStart < period.utcEnd &&
      row.utcEnd > period.utcStart,
  );
  if (rows.length > 0) return fromPlan(period, rows, profiles);
  const fallback = planSlices(period, [], profiles);
  if (fallback.slices.length > 0 || accountingProductId === null) {
    return fallback;
  }
  return {
    slices: [policySlice(period, profiles, accountingProductId)],
    planVersionId: null,
    warnings: [],
  };
}
