import { EntityManager } from 'typeorm';
import { ValuationBasis } from '../domain/profiles/profile.types';
import {
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

const RATES_SQL = `SELECT "id", "version", COALESCE("profile_id", "impact_code_id") AS "owner_id", "basis",
       "value"::text AS "value", "currency", "per_uom", "effective_from", "effective_to"
  FROM "valuation_rates"
 WHERE "tenant_id" = $1 AND "state" = 'approved'
   AND ("profile_id" = ANY($2::uuid[]) OR "impact_code_id" = ANY($3::uuid[]))
   AND "effective_from" < $5 AND ("effective_to" IS NULL OR "effective_to" > $4)
 ORDER BY "id"`;

const FX_SQL = `SELECT "id", "version", "from_currency", "to_currency", "rate"::text AS "rate", "effective_from", "effective_to"
  FROM "fx_rates"
 WHERE "tenant_id" = $1 AND "state" = 'approved'
   AND "effective_from" < $3 AND ("effective_to" IS NULL OR "effective_to" > $2)
 ORDER BY "id"`;

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

export interface LoadedValuation {
  context: ValuationContext;
  ref: PolicyVersionRef;
}

/**
 * Freezes what a run's valuation reads (plan 2.6): the `valuation_basis` version in force at the period
 * start, and — only when it is approved — the approved valuation rates of the slices' profiles and the
 * causes' impact codes and the approved FX rates overlapping the period, with their values. The context is
 * stored on the run and hashed, so a rate, FX or policy approval changes the next run (FND03).
 */
export async function loadValuationContext(
  manager: EntityManager,
  period: { tenantId: string; unitId: string; utcStart: Date; utcEnd: Date },
  owners: { profileIds: string[]; impactCodeIds: string[] },
): Promise<LoadedValuation> {
  const policy = await resolveValuationPolicy(manager, period, period.utcStart);
  const snapshot = snapshotOf(policy);
  const ref = {
    id: policy.id,
    kind: 'valuation_basis',
    version: policy.version,
  };
  if (!snapshot.approved) {
    return { context: contextOf(snapshot, [], []), ref };
  }
  const { rates, fx } = await approvedRates(manager, period, owners);
  return { context: contextOf(snapshot, rates, fx), ref };
}

function contextOf(
  policy: ValuationPolicySnapshot,
  rates: ValuationRateSnapshot[],
  fx: FxRateSnapshot[],
): ValuationContext {
  return { engineVersion: VALUATION_ENGINE_VERSION, policy, rates, fx };
}

/** Approved valuation rates of the owners and approved FX rates overlapping the period, with their values. */
async function approvedRates(
  manager: EntityManager,
  period: { tenantId: string; utcStart: Date; utcEnd: Date },
  owners: { profileIds: string[]; impactCodeIds: string[] },
): Promise<{ rates: ValuationRateSnapshot[]; fx: FxRateSnapshot[] }> {
  const window = [period.utcStart, period.utcEnd];
  const [rates, fx] = await Promise.all([
    manager.query<RateRow[]>(RATES_SQL, [
      period.tenantId,
      [...new Set(owners.profileIds)].sort(),
      [...new Set(owners.impactCodeIds)].sort(),
      ...window,
    ]),
    manager.query<FxRow[]>(FX_SQL, [period.tenantId, ...window]),
  ]);
  return { rates: rates.map(toRate), fx: fx.map(toFx) };
}
