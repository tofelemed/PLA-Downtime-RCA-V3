import { EntityManager } from 'typeorm';
import { invalid } from '../../profiles/profile-errors';
import { AnalyticsResponse } from '../common/response';
import { classSummary } from './downtime-class-summary';
import { breakdownSpec, groupViews, PLANS, summaryOf } from './downtime-report';
import {
  BUNDLE_VIEW_PATTERN,
  BundleGroup,
  DOWNTIME_METRICS,
  DowntimeBundleQueryDto,
  SCHEDULE_CLASSES,
} from './kpi-reports-v2.dto';
import {
  DowntimeBundleItemView,
  DowntimeBundleView,
  reportEnvelope,
} from './kpi-reports-v2.view';
import { breakdownGroups, periodStats, policyVersions } from './report-sql';
import { ReportScope } from './report-scope';
import { dataCoverage } from './data-coverage';

type Metric = (typeof DOWNTIME_METRICS)[number];
type ScheduleClass = (typeof SCHEDULE_CLASSES)[number];

/** One requested view: `<groupBy>[:<metric>][:<scheduleClass>]`, parsed. */
export interface BundleViewSpec {
  view: string;
  groupBy: BundleGroup;
  metric: Metric;
  scheduleClass: ScheduleClass | null;
}

const isMetric = (part: string): part is Metric =>
  (DOWNTIME_METRICS as readonly string[]).includes(part);
const isClass = (part: string): part is ScheduleClass =>
  (SCHEDULE_CLASSES as readonly string[]).includes(part);

/** Parses one token (422 INVALID_VIEW when it does not match the grammar). */
export function parseBundleView(token: string): BundleViewSpec {
  if (!BUNDLE_VIEW_PATTERN.test(token)) {
    throw invalid('INVALID_VIEW', `unknown downtime view ${token}`);
  }
  const [groupBy, ...rest] = token.split(':');
  return {
    view: token,
    groupBy: groupBy as BundleGroup,
    metric: rest.find(isMetric) ?? 'duration',
    scheduleClass: rest.find(isClass) ?? null,
  };
}

/** Parsed views in request order; a repeated token is answered once (the first is kept). */
export function parseBundleViews(tokens: readonly string[]): BundleViewSpec[] {
  return [...new Set(tokens)].map(parseBundleView);
}

async function bundleItem(
  manager: EntityManager,
  scope: ReportScope,
  spec: BundleViewSpec,
  includeMicroStops: boolean,
): Promise<DowntimeBundleItemView> {
  const query = {
    metric: spec.metric,
    scheduleClass: spec.scheduleClass ?? undefined,
    includeMicroStops,
  };
  const cells = await breakdownGroups(
    manager,
    scope,
    breakdownSpec(spec.groupBy, query, null),
  );
  const groups = await groupViews(manager, scope, PLANS[spec.groupBy], cells);
  return {
    view: spec.view,
    groupBy: spec.groupBy,
    metric: spec.metric,
    unit: spec.metric === 'duration' ? 's' : 'count',
    scheduleClass: spec.scheduleClass,
    ...groups,
  };
}

/**
 * `GET /reports/downtime-bundle` (T24): the breakdowns of the Downtime Analysis page from one scope
 * resolution and one run selection. Each view runs the same breakdown query as `/reports/downtime` with
 * that grouping, metric and class (no reason subtree), so its groups and total equal the single report;
 * the period summary, run ids and policy versions are read once. Views run one after the other. With
 * `scheduleClass` the summary is the class's (`classSummary`, owner decision 2026-10-19).
 */
export async function downtimeBundleReport(
  manager: EntityManager,
  scope: ReportScope,
  query: DowntimeBundleQueryDto,
): Promise<AnalyticsResponse<DowntimeBundleView>> {
  const specs = parseBundleViews(query.views);
  const includeMicroStops = query.includeMicroStops ?? false;
  const stats = await periodStats(manager, scope);
  const scheduleClass = query.scheduleClass ?? null;
  const summary = scheduleClass
    ? await classSummary(manager, scope, { scheduleClass, includeMicroStops })
    : await summaryOf(manager, scope);
  const views: DowntimeBundleItemView[] = [];
  for (const spec of specs) {
    views.push(await bundleItem(manager, scope, spec, includeMicroStops));
  }
  const data: DowntimeBundleView = {
    includeMicroStops,
    scheduleClass,
    summary,
    views,
    dataCoverage: await dataCoverage(manager, scope),
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: false,
    notes: ['null key = not coded / not assigned'],
  });
}
