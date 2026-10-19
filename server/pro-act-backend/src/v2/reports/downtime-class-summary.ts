import { EntityManager } from 'typeorm';
import { formatDec, ZERO } from '../../domain/actuals/decimal';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { summaryOf } from './downtime-report';
import { SCHEDULE_CLASSES } from './kpi-reports-v2.dto';
import { KpiAggregateView } from './kpi-reports-v2.view';
import { breakdownGroups } from './report-sql';
import { ReportScope } from './report-scope';

export type ScheduleClass = (typeof SCHEDULE_CLASSES)[number];

/** Reason of a summary figure that has no value for one schedule class (availability, coded share, …). */
export const NOT_BY_SCHEDULE_CLASS = 'not_by_schedule_class';

/** The period KPI that already is the stop time of one class. */
const CLASS_TIME: Readonly<Record<ScheduleClass, KpiMetric>> = {
  planned: 'downtime_planned',
  unplanned: 'downtime_unplanned',
  external: 'downtime_external',
  unknown: 'unknown_time',
};

/** Stop time and stop count of the class: the stored breakdown cells the class trend sums (no grouping). */
const CLASS_TOTALS: ReadonlyArray<'downtime_total' | 'stop_count'> = [
  'downtime_total',
  'stop_count',
];

async function classTotal(
  manager: EntityManager,
  scope: ReportScope,
  metric: 'downtime_total' | 'stop_count',
  filter: { scheduleClass: ScheduleClass; includeMicroStops: boolean },
): Promise<string> {
  const cells = await breakdownGroups(manager, scope, {
    groupSql: `'total'`,
    metric,
    dimension: 'none',
    scheduleClass: filter.scheduleClass,
    includeMicroStops: filter.includeMicroStops,
  });
  return formatDec(cells.reduce((sum, cell) => sum.plus(cell.amount), ZERO));
}

/** A figure the class filter leaves without a value (never a whole-window figure under a class filter). */
function notByClass(view: KpiAggregateView): KpiAggregateView {
  return {
    ...view,
    numerator: null,
    denominator: null,
    value: null,
    quality: 'unavailable',
    reason: NOT_BY_SCHEDULE_CLASS,
  };
}

/**
 * The downtime summary of one schedule class (owner decision 2026-10-19: the summary follows every filter,
 * schedule class included). Stop time and stop count are the sums of the stored breakdown cells of that
 * class — the same cells the class's trend shows, so tiles and trend agree; the class's own period KPI
 * (planned, unplanned, external or unclassed time) stays as stored; every other figure (availability,
 * coded share, means, …) is not split by class and is returned without a value (`not_by_schedule_class`).
 * Nothing new is calculated: amounts are only summed, as every report does.
 */
export async function classSummary(
  manager: EntityManager,
  scope: ReportScope,
  filter: { scheduleClass: ScheduleClass; includeMicroStops: boolean },
): Promise<KpiAggregateView[]> {
  const summary = await summaryOf(manager, scope);
  const totals = new Map<KpiMetric, string>();
  for (const metric of CLASS_TOTALS) {
    totals.set(metric, await classTotal(manager, scope, metric, filter));
  }
  return summary.map((view) => {
    if (view.metric === CLASS_TIME[filter.scheduleClass]) return view;
    const total = totals.get(view.metric);
    if (total === undefined) return notByClass(view);
    if (view.value === null) return view;
    return { ...view, numerator: total, value: total };
  });
}
