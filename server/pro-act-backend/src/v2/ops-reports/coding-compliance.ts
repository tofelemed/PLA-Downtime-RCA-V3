import { EntityManager } from 'typeorm';
import { Dec, formatDec } from '../../domain/actuals/decimal';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse } from '../common/response';
import {
  aggregateView,
  KpiAggregateView,
  reportEnvelope,
} from '../reports/kpi-reports-v2.view';
import {
  GroupedTerms,
  kpiGroups,
  periodStats,
  policyVersions,
  TIME_GROUPS,
} from '../reports/report-sql';
import { ReportScope } from '../reports/report-scope';

const METRICS: readonly KpiMetric[] = [
  'coded_downtime_ratio',
  'state_coverage',
];

export type ComplianceGroup = 'crew' | 'shift';

/** Coding discipline of one crew or shift label (R9). */
export interface ComplianceRowView {
  /** crew id or shift label; null = periods without a crew / shift */
  key: string | null;
  label: string | null;
  /** ended stops starting in the window, how many have been coded with a reason, how many verified */
  stops: number;
  coded: number;
  verified: number;
  /** seconds from a stop's end to its first coding with a reason: median and 90th percentile */
  medianDelaySeconds: string | null;
  p90DelaySeconds: string | null;
  /** stored KPIs of the shown runs: coded share of downtime, share of scheduled time with a known state */
  codedDowntimeRatio: KpiAggregateView;
  stateCoverage: KpiAggregateView;
}

export interface CodingComplianceView {
  byCrew: ComplianceRowView[];
  byShift: ComplianceRowView[];
  calculationRunIds: string[];
}

interface DelayRow {
  group_key: string | null;
  stops: number;
  coded: number;
  verified: number;
  median_delay: string | null;
  p90_delay: string | null;
}

/**
 * Ended stops of the units starting in [from, to) with the crew and shift of the shift instance holding their
 * start and the first coding with a reason; grouped by `$5` (crew | shift). $1 tenant, $2 units, $3, $4 window.
 */
const DELAY_SQL = `WITH ev AS (
  SELECT e."end_time", e."verified_at", si."crew_id", si."shift_name",
         (SELECT min(c."created_at") FROM "event_coding" c
           WHERE c."tenant_id" = $1 AND c."event_id" = e."id" AND c."reason_code_id" IS NOT NULL) AS "first_coded"
    FROM "production_events" e
    LEFT JOIN LATERAL (SELECT i."crew_id", i."shift_name" FROM "shift_instances" i
                        WHERE i."tenant_id" = $1 AND i."unit_id" = e."unit_id"
                          AND i."utc_start" <= e."start_time" AND i."utc_end" > e."start_time"
                        ORDER BY i."utc_start" DESC LIMIT 1) si ON true
   WHERE e."tenant_id" = $1 AND e."unit_id" = ANY($2::uuid[]) AND e."start_time" >= $3 AND e."start_time" < $4
     AND e."physical_type" = 'downtime' AND e."physical_state" = 'closed')
SELECT CASE WHEN $5::text = 'crew' THEN ev."crew_id"::text ELSE ev."shift_name" END AS "group_key",
       count(*)::int AS "stops", count(ev."first_coded")::int AS "coded",
       count(ev."verified_at")::int AS "verified",
       (percentile_cont(0.5) WITHIN GROUP (ORDER BY greatest(0, extract(epoch FROM ev."first_coded" - ev."end_time")))
         FILTER (WHERE ev."first_coded" IS NOT NULL))::text AS "median_delay",
       (percentile_cont(0.9) WITHIN GROUP (ORDER BY greatest(0, extract(epoch FROM ev."first_coded" - ev."end_time")))
         FILTER (WHERE ev."first_coded" IS NOT NULL))::text AS "p90_delay"
  FROM ev GROUP BY 1 ORDER BY 1`;

/** Shift label only (the period's stored shift name), for grouping KPIs by shift across days. */
const SHIFT_NAME = `COALESCE(s."shift_name", '')`;

const seconds = (value: string | null) =>
  value === null ? null : formatDec(new Dec(value).toDecimalPlaces(0));

export function complianceRows(
  delays: readonly DelayRow[],
  kpis: GroupedTerms,
  labelOf: (key: string | null) => string | null,
): ComplianceRowView[] {
  const keys = new Set<string | null>([
    ...delays.map((d) => d.group_key),
    ...[...kpis.keys()].map((k) => (k === '' ? null : k)),
  ]);
  return [...keys].map((key) => {
    const d = delays.find((r) => r.group_key === key);
    const terms = kpis.get(key ?? '') ?? kpis.get(key);
    return {
      key,
      label: labelOf(key),
      stops: d?.stops ?? 0,
      coded: d?.coded ?? 0,
      verified: d?.verified ?? 0,
      medianDelaySeconds: seconds(d?.median_delay ?? null),
      p90DelaySeconds: seconds(d?.p90_delay ?? null),
      codedDowntimeRatio: aggregateView(
        'coded_downtime_ratio',
        terms?.get('coded_downtime_ratio'),
      ),
      stateCoverage: aggregateView(
        'state_coverage',
        terms?.get('state_coverage'),
      ),
    };
  });
}

async function crewNames(
  manager: EntityManager,
  scope: ReportScope,
): Promise<Map<string, string>> {
  const rows: Array<{ id: string; name: string }> = await manager.query(
    `SELECT "id"::text AS "id", "name" FROM "crews" WHERE "tenant_id" = $1`,
    [scope.tenantId],
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * `GET /reports/coding-compliance` (R9): per crew and per shift label — how many stops were coded and
 * verified, how long coding took after the stop ended (median, p90), and the stored coded-downtime and
 * state-coverage KPIs: how far the other reports can be trusted, and where coding lags.
 */
export async function codingCompliance(
  manager: EntityManager,
  scope: ReportScope,
): Promise<AnalyticsResponse<CodingComplianceView>> {
  const window = [scope.tenantId, scope.unitIds, scope.from, scope.to];
  const [crewDelays, shiftDelays, crewKpis, shiftKpis, names, stats] =
    await Promise.all([
      manager.query<DelayRow[]>(DELAY_SQL, [...window, 'crew']),
      manager.query<DelayRow[]>(DELAY_SQL, [...window, 'shift']),
      kpiGroups(manager, scope, {
        groupSql: TIME_GROUPS.crew,
        metrics: METRICS,
        level: 'period',
      }),
      kpiGroups(manager, scope, {
        groupSql: SHIFT_NAME,
        metrics: METRICS,
        level: 'period',
      }),
      crewNames(manager, scope),
      periodStats(manager, scope),
    ]);
  const data: CodingComplianceView = {
    byCrew: complianceRows(crewDelays, crewKpis, (k) =>
      k ? (names.get(k) ?? null) : null,
    ),
    byShift: complianceRows(shiftDelays, shiftKpis, (k) => k),
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: false,
    notes: [],
  });
}
