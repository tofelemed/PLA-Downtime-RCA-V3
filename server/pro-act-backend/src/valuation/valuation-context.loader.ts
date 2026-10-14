import { EntityManager } from 'typeorm';
import { ValuationBasis } from '../domain/profiles/profile.types';
import {
  DemandStatusSnapshot,
  FxRateSnapshot,
  VALUATION_ENGINE_VERSION,
  ValuationContext,
  ValuationPolicySnapshot,
  ValuationRateSnapshot,
} from '../domain/valuation/valuation.types';
import { PolicyVersionRef } from '../periods/entities/actuals-run.entity';
import { resolveValuationPolicy, snapshotOf } from './valuation-policy.store';

interface RateRow {
  id: string;
  version: number;
  owner_id: string;
  basis: ValuationBasis;
  value: string;
  currency: string;
  per_uom: string;
  effective_from: Date;
  effective_to: Date | null;
}

interface FxRow {
  id: string;
  version: number;
  from_currency: string;
  to_currency: string;
  rate: string;
  effective_from: Date;
  effective_to: Date | null;
}

interface DemandRow {
  id: string;
  version: number;
  product_id: string;
  status: string;
  effective_from: Date;
  effective_to: Date | null;
}

/** Bases a v1 / v2 policy reads (kept, so their contexts and run hashes are unchanged). */
const CLASSIC_BASES: ValuationBasis[] = [
  'contribution_margin',
  'standard_cost',
  'cost_per_hour',
];

const RATES_SQL = `SELECT "id", "version", COALESCE("profile_id", "impact_code_id") AS "owner_id", "basis",
       "value"::text AS "value", "currency", "per_uom", "effective_from", "effective_to"
  FROM "valuation_rates"
 WHERE "tenant_id" = $1 AND "state" = 'approved'
   AND ("profile_id" = ANY($2::uuid[]) OR "impact_code_id" = ANY($3::uuid[]))
   AND "effective_from" < $5 AND ("effective_to" IS NULL OR "effective_to" > $4)
   AND ($6::text[] IS NULL OR "basis"::text = ANY($6::text[]))
 ORDER BY "id"`;

const FX_SQL = `SELECT "id", "version", "from_currency", "to_currency", "rate"::text AS "rate", "effective_from", "effective_to"
  FROM "fx_rates"
 WHERE "tenant_id" = $1 AND "state" = 'approved' AND "rate_type" = $4
   AND "effective_from" < $3 AND ("effective_to" IS NULL OR "effective_to" > $2)
 ORDER BY "id"`;

const DEMAND_SQL = `SELECT "id", "version", "product_id", "status", "effective_from", "effective_to"
  FROM "demand_statuses"
 WHERE "tenant_id" = $1 AND "state" = 'approved' AND "product_id" = ANY($2::uuid[])
   AND "effective_from" < $4 AND ("effective_to" IS NULL OR "effective_to" > $3)
 ORDER BY "id"`;

/** The local calendar month of the period's operational date, in the calendar's timezone (SME V6). */
const MONTH_SQL = `SELECT (date_trunc('month', p."local_date"::timestamp) AT TIME ZONE z."tz") AS "from",
       ((date_trunc('month', p."local_date"::timestamp) + interval '1 month') AT TIME ZONE z."tz") AS "to"
  FROM "production_periods" p
  LEFT JOIN "calendar_versions" cv ON cv."id" = p."calendar_version_id"
  CROSS JOIN LATERAL (SELECT COALESCE(cv."timezone", 'UTC') AS "tz") z
 WHERE p."id" = $1`;

const iso = (value: Date | null) =>
  value === null ? null : new Date(value).toISOString();

function toRate(row: RateRow): ValuationRateSnapshot {
  return {
    id: row.id,
    version: row.version,
    ownerId: row.owner_id,
    basis: row.basis,
    value: row.value,
    currency: row.currency,
    perUom: row.per_uom,
    from: new Date(row.effective_from).toISOString(),
    to: iso(row.effective_to),
  };
}

function toFx(row: FxRow): FxRateSnapshot {
  return {
    id: row.id,
    version: row.version,
    fromCurrency: row.from_currency,
    toCurrency: row.to_currency,
    rate: row.rate,
    from: new Date(row.effective_from).toISOString(),
    to: iso(row.effective_to),
  };
}

function toDemand(row: DemandRow): DemandStatusSnapshot {
  return {
    id: row.id,
    version: row.version,
    productId: row.product_id,
    constrained: row.status === 'demand_constrained',
    from: new Date(row.effective_from).toISOString(),
    to: iso(row.effective_to),
  };
}

export interface LoadedValuation {
  context: ValuationContext;
  ref: PolicyVersionRef;
}

export interface ValuationPeriod {
  id: string;
  tenantId: string;
  unitId: string;
  utcStart: Date;
  utcEnd: Date;
}

export interface ValuationOwners {
  profileIds: string[];
  impactCodeIds: string[];
  /** products of the slices (demand statuses, SME V3) */
  productIds?: string[];
}

/**
 * Freezes what a run's valuation reads (plan 2.6): the `valuation_basis` version in force at the period
 * start, and — only when it is approved — the approved valuation rates of the slices' profiles and the
 * causes' impact codes, the approved FX rates of the policy's rate table overlapping the period (its local
 * month for a month average, SME V6) and, for the economic view (v3), the approved demand statuses of the
 * period's products. The context is stored on the run and hashed, so an approval changes the next run.
 */
export async function loadValuationContext(
  manager: EntityManager,
  period: ValuationPeriod,
  owners: ValuationOwners,
): Promise<LoadedValuation> {
  const policy = await resolveValuationPolicy(manager, period, period.utcStart);
  const snapshot = snapshotOf(policy);
  const ref = {
    id: policy.id,
    kind: 'valuation_basis',
    version: policy.version,
  };
  if (!snapshot.approved) {
    return { context: contextOf(snapshot, { rates: [], fx: [] }), ref };
  }
  const loaded = await approvedInputs(manager, period, owners, snapshot);
  return { context: contextOf(snapshot, loaded), ref };
}

interface Inputs {
  rates: ValuationRateSnapshot[];
  fx: FxRateSnapshot[];
  demand?: DemandStatusSnapshot[];
  fxAverage?: { from: string; to: string };
}

function contextOf(
  policy: ValuationPolicySnapshot,
  inputs: Inputs,
): ValuationContext {
  return { engineVersion: VALUATION_ENGINE_VERSION, policy, ...inputs };
}

async function monthOf(
  manager: EntityManager,
  periodId: string,
): Promise<{ from: string; to: string } | undefined> {
  const [row] = await manager.query<Array<{ from: Date; to: Date }>>(
    MONTH_SQL,
    [periodId],
  );
  if (!row) return undefined;
  return {
    from: new Date(row.from).toISOString(),
    to: new Date(row.to).toISOString(),
  };
}

/** Approved rates, FX rates and demand statuses the policy needs, with their values. */
async function approvedInputs(
  manager: EntityManager,
  period: ValuationPeriod,
  owners: ValuationOwners,
  policy: ValuationPolicySnapshot,
): Promise<Inputs> {
  const window = [period.utcStart, period.utcEnd];
  const average =
    policy.fx?.dateRule === 'period_average'
      ? await monthOf(manager, period.id)
      : undefined;
  const fxWindow = average
    ? [new Date(average.from), new Date(average.to)]
    : window;
  const rateType = policy.fx?.rateType ?? 'economic';
  const productIds = [...new Set(owners.productIds ?? [])].sort();
  const [rates, fx, demand] = await Promise.all([
    manager.query<RateRow[]>(RATES_SQL, [
      period.tenantId,
      [...new Set(owners.profileIds)].sort(),
      [...new Set(owners.impactCodeIds)].sort(),
      ...window,
      policy.economic ? null : CLASSIC_BASES,
    ]),
    manager.query<FxRow[]>(FX_SQL, [period.tenantId, ...fxWindow, rateType]),
    policy.economic
      ? manager.query<DemandRow[]>(DEMAND_SQL, [
          period.tenantId,
          productIds,
          ...window,
        ])
      : Promise.resolve([]),
  ]);
  return {
    rates: rates.map(toRate),
    fx: fx.map(toFx),
    ...(policy.economic ? { demand: demand.map(toDemand) } : {}),
    ...(average ? { fxAverage: average } : {}),
  };
}
