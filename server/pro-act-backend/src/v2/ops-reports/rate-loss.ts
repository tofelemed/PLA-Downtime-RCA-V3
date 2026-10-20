import { EntityManager } from 'typeorm';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse } from '../common/response';
import {
  aggregateView,
  KpiAggregateView,
  reportEnvelope,
} from '../reports/kpi-reports-v2.view';
import {
  kpiGroups,
  periodStats,
  policyVersions,
  TIME_GROUPS,
} from '../reports/report-sql';
import { ReportScope } from '../reports/report-scope';

/** Equivalent downtime (SME Q5) beside the performance component it lowers. */
const METRICS: readonly KpiMetric[] = ['downtime_equivalent', 'performance'];

export interface RateLossMonthView {
  /** plant month `YYYY-MM` */
  month: string;
  /** seconds of rate lost by partial-impact events, as time at the reference rate */
  equivalentDowntime: KpiAggregateView;
  performance: KpiAggregateView;
}

export interface RateLossView {
  months: RateLossMonthView[];
  total: {
    equivalentDowntime: KpiAggregateView;
    performance: KpiAggregateView;
  };
  calculationRunIds: string[];
}

/**
 * `GET /reports/rate-loss` (R8): the hidden loss of running below rate — equivalent downtime (fraction ×
 * duration of partial-impact events) and the operational performance component, per plant month and in
 * total, Σ of the stored terms of the shown runs. The loss by cause comes from `/reports/loss-tree` with
 * `kinds=performance`.
 */
export async function rateLoss(
  manager: EntityManager,
  scope: ReportScope,
): Promise<AnalyticsResponse<RateLossView>> {
  const [months, total, stats] = await Promise.all([
    kpiGroups(manager, scope, {
      groupSql: TIME_GROUPS.month,
      metrics: METRICS,
      level: 'period',
    }),
    kpiGroups(manager, scope, {
      groupSql: `'total'`,
      metrics: METRICS,
      level: 'period',
    }),
    periodStats(manager, scope),
  ]);
  const totals = total.get('total');
  const data: RateLossView = {
    months: [...months.entries()]
      .flatMap(([month, terms]) => (month ? [{ month, terms }] : []))
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(({ month, terms }) => ({
        month,
        equivalentDowntime: aggregateView(
          'downtime_equivalent',
          terms.get('downtime_equivalent'),
        ),
        performance: aggregateView('performance', terms.get('performance')),
      })),
    total: {
      equivalentDowntime: aggregateView(
        'downtime_equivalent',
        totals?.get('downtime_equivalent'),
      ),
      performance: aggregateView('performance', totals?.get('performance')),
    },
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: data.total.performance.quality === 'provisional',
    notes: [],
  });
}
