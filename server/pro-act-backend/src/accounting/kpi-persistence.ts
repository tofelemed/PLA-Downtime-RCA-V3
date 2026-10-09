import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { Dec, formatDec } from '../domain/actuals/decimal';
import { KpiDraft } from '../domain/kpi/kpi.types';
import { KpiResult } from './entities/kpi-result.entity';

const CHUNK = 500;

export interface KpiRunScope {
  tenantId: string;
  periodId: string;
  runId: string;
  /** the `oee_policy` version the run applied */
  policyId: string | null;
  asOf: Date;
}

const term = (value: Dec | null) => (value === null ? null : formatDec(value));

function row(
  kpi: KpiDraft,
  scope: KpiRunScope,
): QueryDeepPartialEntity<KpiResult> {
  return {
    tenantId: scope.tenantId,
    runId: scope.runId,
    periodId: scope.periodId,
    scope: kpi.scope,
    metric: kpi.metric,
    policyId: scope.policyId,
    numerator: term(kpi.numerator),
    denominator: term(kpi.denominator),
    value: kpi.value === null ? null : kpi.value.toFixed(),
    unit: kpi.unit,
    quality: kpi.quality,
    reason: kpi.reason,
    cohort: kpi.cohort,
    asOf: scope.asOf,
    createdBy: null,
  };
}

/** The run's KPI results, bulk-inserted in chunks inside the run's transaction (immutable afterwards). */
export async function writeKpiResults(
  manager: EntityManager,
  scope: KpiRunScope,
  kpis: readonly KpiDraft[],
): Promise<number> {
  const rows = kpis.map((kpi) => row(kpi, scope));
  for (let i = 0; i < rows.length; i += CHUNK) {
    await manager.insert(KpiResult, rows.slice(i, i + CHUNK));
  }
  return rows.length;
}
