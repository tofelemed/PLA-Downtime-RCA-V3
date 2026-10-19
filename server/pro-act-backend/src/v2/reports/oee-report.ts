import { EntityManager } from 'typeorm';
import { KpiMetric, RECONCILED_OEE_LABEL } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse } from '../common/response';
import { OeeGroup, OeeReportQueryDto } from './kpi-reports-v2.dto';
import {
  aggregateView,
  KpiAggregateView,
  OeeReportView,
  ReportGroupView,
  reportEnvelope,
} from './kpi-reports-v2.view';
import {
  kpiGroups,
  periodStats,
  policyVersions,
  TIME_GROUPS,
} from './report-sql';
import { ReportScope } from './report-scope';
import { uncoveredGroupKeys } from './plan-coverage-groups';

const OPERATIONAL: readonly KpiMetric[] = [
  'availability',
  'performance',
  'quality',
  'oee',
];
const RECONCILED: readonly KpiMetric[] = [
  'reconciled_availability',
  'reconciled_performance',
  'reconciled_quality',
  'reconciled_oee',
];
const PRODUCT_KEY = `k."scope"->>'productId'`;

const isProvisional = (views: readonly KpiAggregateView[]) =>
  views.some((v) => v.quality === 'provisional');

/** Per-group aggregates and the total (period rows, one SQL group), both sum-then-divide. */
async function groupViews(
  manager: EntityManager,
  scope: ReportScope,
  groupBy: OeeGroup,
  metrics: readonly KpiMetric[],
): Promise<{ groups: ReportGroupView[]; total: KpiAggregateView[] }> {
  const product = groupBy === 'product';
  const groupSql = product ? PRODUCT_KEY : TIME_GROUPS[groupBy];
  const grouped = await kpiGroups(manager, scope, {
    groupSql,
    metrics,
    level: product ? 'slice' : 'period',
  });
  const uncovered = product
    ? null
    : await uncoveredGroupKeys(manager, scope, groupSql);
  const overall = await kpiGroups(manager, scope, {
    groupSql: `'total'`,
    metrics,
    level: 'period',
  });
  return {
    groups: [...grouped.entries()].map(([key, byMetric]) => ({
      key,
      label: key,
      metrics: metrics.map((m) => aggregateView(m, byMetric.get(m))),
      ...(uncovered ? { noApprovedPlan: uncovered.has(key) } : {}),
    })),
    total: metrics.map((m) => aggregateView(m, overall.get('total')?.get(m))),
  };
}

/**
 * `GET /reports/oee` (plan 2.7 step 5): operational (ISO 22400) or reconciled (GE PLA, labelled) OEE per
 * site-local group from the stored numerators and denominators of the shown runs — Σ V / Σ S, never a mean
 * of percentages (T31). Product groups read the slice rows; every other group and the total the period
 * rows (the total is summed in SQL too, so different OEE policies are detected across groups).
 */
export async function oeeReport(
  manager: EntityManager,
  scope: ReportScope,
  query: OeeReportQueryDto,
): Promise<AnalyticsResponse<OeeReportView>> {
  const policy = query.policy ?? 'operational';
  const groupBy = query.groupBy ?? 'day';
  const metrics = policy === 'reconciled' ? RECONCILED : OPERATIONAL;
  const { groups, total } = await groupViews(manager, scope, groupBy, metrics);
  const stats = await periodStats(manager, scope);
  const data: OeeReportView = {
    policy,
    label:
      policy === 'reconciled'
        ? RECONCILED_OEE_LABEL
        : 'Operational OEE (ISO 22400)',
    groupBy,
    groups,
    total,
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData:
      isProvisional(total) || groups.some((g) => isProvisional(g.metrics)),
    notes: [...new Set(total.flatMap((t) => (t.reason ? [t.reason] : [])))],
  });
}
