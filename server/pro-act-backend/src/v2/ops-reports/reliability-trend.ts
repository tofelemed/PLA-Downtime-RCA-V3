import { EntityManager } from 'typeorm';
import { GroupTerms } from '../../domain/kpi/aggregate';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse } from '../common/response';
import {
  ReliabilityRowView,
  reportEnvelope,
} from '../reports/kpi-reports-v2.view';
import {
  assetTerms,
  FAILURE_DEFINITION,
  RELIABILITY_METRICS,
  reliabilityRow,
} from '../reports/reliability-report';
import {
  GroupedTerms,
  kpiGroups,
  periodStats,
  policyVersions,
  TIME_GROUPS,
} from '../reports/report-sql';
import { ReportScope } from '../reports/report-scope';

/** Assets shown at most: those with the most eligible failures in the window. */
export const TREND_ASSET_LIMIT = 30;
/** Consecutive monthly falls of MTBF that flag a unit or asset (R6, DECISIONS 2026-10-20). */
export const FALLING_MONTHS = 3;

export interface ReliabilityMonthView {
  /** plant month `YYYY-MM` of the periods */
  month: string;
  row: ReliabilityRowView;
}

export interface ReliabilitySeriesView {
  unitId: string;
  assetId: string | null;
  label: string | null;
  months: ReliabilityMonthView[];
  /** MTBF fell in each of the last `FALLING_MONTHS` months that have a value */
  fallingMtbf: boolean;
}

export interface ReliabilityTrendView {
  months: string[];
  units: ReliabilitySeriesView[];
  assets: ReliabilitySeriesView[];
  failureDefinition: string;
  calculationRunIds: string[];
}

type Terms = Map<KpiMetric, GroupTerms>;

const MONTH = TIME_GROUPS.month;

/** `month|key` group keys → month → key → terms. */
function split(grouped: GroupedTerms): Map<string, Map<string, Terms>> {
  const out = new Map<string, Map<string, Terms>>();
  for (const [key, terms] of grouped) {
    if (!key) continue;
    const [month, id] = key.split('|');
    if (!id) continue;
    const byMonth = out.get(id) ?? new Map<string, Terms>();
    byMonth.set(month, terms);
    out.set(id, byMonth);
  }
  return out;
}

/** True when each of the last `FALLING_MONTHS` MTBF values is below the one before it. */
export function fallingMtbf(values: ReadonlyArray<string | null>): boolean {
  const known = values.flatMap((v) => (v === null ? [] : [Number(v)]));
  const tail = known.slice(-(FALLING_MONTHS + 1));
  if (tail.length < FALLING_MONTHS + 1) return false;
  return tail.every((v, i) => i === 0 || v < tail[i - 1]);
}

function series(
  ids: { unitId: string; assetId: string | null; label: string | null },
  months: readonly string[],
  termsOf: (month: string) => Terms | undefined,
): ReliabilitySeriesView {
  const rows = months.map((month) => ({
    month,
    row: reliabilityRow(ids, termsOf(month)),
  }));
  return {
    ...ids,
    months: rows,
    fallingMtbf: fallingMtbf(rows.map((r) => r.row.mtbf.value)),
  };
}

async function assetLabels(
  manager: EntityManager,
  scope: ReportScope,
  ids: string[],
): Promise<Array<{ id: string; unitId: string; label: string }>> {
  if (ids.length === 0) return [];
  const rows: Array<{ id: string; unit_id: string; name: string }> =
    await manager.query(
      `SELECT "id"::text AS "id", "unit_id"::text AS "unit_id", "name" FROM "assets"
        WHERE "tenant_id" = $1::uuid AND "id" = ANY($2::uuid[]) ORDER BY "name", "id"`,
      [scope.tenantId, ids],
    );
  return rows.map((r) => ({ id: r.id, unitId: r.unit_id, label: r.name }));
}

/** The assets with the most failures over the window, at most `TREND_ASSET_LIMIT`. */
function topAssets(assets: Map<string, Map<string, Terms>>): string[] {
  const failures = (byMonth: Map<string, Terms>) =>
    [...byMonth.values()].reduce(
      (sum, t) => sum + Number(t.get('mtbf')?.denominator ?? 0),
      0,
    );
  return [...assets.entries()]
    .map(([id, byMonth]) => ({ id, failures: failures(byMonth) }))
    .filter((a) => a.failures > 0)
    .sort((a, b) => b.failures - a.failures || a.id.localeCompare(b.id))
    .slice(0, TREND_ASSET_LIMIT)
    .map((a) => a.id);
}

/**
 * `GET /reports/reliability-trend` (R6): MTBF, mean time to restore and MTTR per plant month for each unit
 * and its most-failing assets — the stored terms of the shown runs summed per month, the same definitions
 * as `/reports/reliability` — with a flag where MTBF fell month after month.
 */
export async function reliabilityTrend(
  manager: EntityManager,
  scope: ReportScope,
): Promise<AnalyticsResponse<ReliabilityTrendView>> {
  const [unitGroups, assetGroups, stats] = await Promise.all([
    kpiGroups(manager, scope, {
      groupSql: `${MONTH} || '|' || ${TIME_GROUPS.unit}`,
      metrics: RELIABILITY_METRICS,
      level: 'period',
      excludeUnknownTime: true,
    }),
    kpiGroups(manager, scope, {
      groupSql: `${MONTH} || '|' || (k."scope"->>'assetId')`,
      metrics: RELIABILITY_METRICS,
      level: 'asset',
    }),
    periodStats(manager, scope),
  ]);
  const units = split(unitGroups);
  const assets = split(assetGroups);
  const months = [
    ...new Set([...units.values()].flatMap((m) => [...m.keys()])),
  ].sort();
  const labels = await assetLabels(manager, scope, topAssets(assets));
  const data: ReliabilityTrendView = {
    months,
    units: [...units.keys()]
      .sort()
      .map((unitId) =>
        series({ unitId, assetId: null, label: null }, months, (m) =>
          units.get(unitId)?.get(m),
        ),
      ),
    assets: labels.map((a) =>
      series({ unitId: a.unitId, assetId: a.id, label: a.label }, months, (m) =>
        assetTerms(units.get(a.unitId)?.get(m), assets.get(a.id)?.get(m)),
      ),
    ),
    failureDefinition: FAILURE_DEFINITION,
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: data.units.some((u) =>
      u.months.some((m) => m.row.mtbf.quality === 'provisional'),
    ),
    notes: [],
  });
}
