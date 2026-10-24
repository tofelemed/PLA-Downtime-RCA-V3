import { EntityManager } from 'typeorm';
import { Dec } from '../../domain/actuals/decimal';
import { GroupTerms } from '../../domain/kpi/aggregate';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse } from '../common/response';
import {
  ReliabilityRowView,
  ReliabilityTermsView,
  reportEnvelope,
} from '../reports/kpi-reports-v2.view';
import {
  assetTerms,
  FAILURE_DEFINITION,
  RELIABILITY_METRICS,
  reliabilityRow,
  reliabilityTerms,
} from '../reports/reliability-report';
import {
  GroupedTerms,
  kpiGroups,
  periodStats,
  PeriodStats,
  policyVersions,
  TIME_GROUPS,
} from '../reports/report-sql';
import { ReportScope, resolveAssets } from '../reports/report-scope';

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

export interface ReliabilityTotalMonthView {
  /** plant month `YYYY-MM` of the periods */
  month: string;
  row: ReliabilityTermsView;
}

/** The selected scope as one series: every unit in scope, or the filtered assets. */
export interface ReliabilityTotalView {
  months: ReliabilityTotalMonthView[];
  fallingMtbf: boolean;
}

export interface ReliabilityTrendView {
  months: string[];
  units: ReliabilitySeriesView[];
  assets: ReliabilitySeriesView[];
  total: ReliabilityTotalView;
  failureDefinition: string;
  calculationRunIds: string[];
}

type Terms = Map<KpiMetric, GroupTerms>;
/** id → plant month → terms */
type TermsById = Map<string, Map<string, Terms>>;

const MONTH = TIME_GROUPS.month;

/** `month|key` group keys → month → key → terms. */
function split(grouped: GroupedTerms): TermsById {
  const out: TermsById = new Map();
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

function totalSeries(
  months: readonly string[],
  termsOf: (month: string) => Terms | undefined,
): ReliabilityTotalView {
  const rows = months.map((month) => ({
    month,
    row: reliabilityTerms(termsOf(month)),
  }));
  return {
    months: rows,
    fallingMtbf: fallingMtbf(rows.map((r) => r.row.mtbf.value)),
  };
}

const addDec = (a: Dec | null, b: Dec | null): Dec | null =>
  a === null ? b : b === null ? a : a.plus(b);

/** Two groups' terms as one: what the SQL `SUM`s would give over both groups' rows. */
function addTerms(a: GroupTerms, b: GroupTerms): GroupTerms {
  const mins = [a.minValue, b.minValue].flatMap((v) => (v ? [v] : []));
  return {
    numerator: addDec(a.numerator, b.numerator),
    denominator: addDec(a.denominator, b.denominator),
    minValue: mins.length ? Dec.min(...mins) : null,
    rows: a.rows + b.rows,
    complete: a.complete + b.complete,
    provisionalRows: a.provisionalRows + b.provisionalRows,
    policies: Math.max(a.policies, b.policies),
    reasons: [...new Set([...a.reasons, ...b.reasons])],
    unknownExcluded: addDec(
      a.unknownExcluded ?? null,
      b.unknownExcluded ?? null,
    ),
  };
}

/** Σ of several groups' terms per metric; nothing to sum → undefined (no terms, never zero). */
function sumTerms(list: readonly Terms[]): Terms | undefined {
  if (list.length === 0) return undefined;
  const out: Terms = new Map();
  for (const terms of list)
    for (const [metric, t] of terms) {
      const prev = out.get(metric);
      out.set(metric, prev ? addTerms(prev, t) : t);
    }
  return out;
}

/**
 * The filtered assets' terms of a month as one group. Assets of one unit share its exposure, so their own
 * failures and repairs are summed first and the unit's exposure is taken once (summing each asset's
 * `assetTerms` would count it once per asset); the per-unit terms are then summed as units are. One asset
 * → exactly that asset's series.
 */
function filteredAssetTerms(
  groups: TrendGroups,
  filter: ReadonlyMap<string, string>,
  month: string,
): Terms | undefined {
  const ownByUnit = new Map<string, Terms[]>();
  for (const [assetId, unitId] of filter) {
    const own = groups.assets.get(assetId)?.get(month);
    const list = ownByUnit.get(unitId) ?? [];
    ownByUnit.set(unitId, own ? [...list, own] : list);
  }
  return sumTerms(
    [...ownByUnit].map(([unitId, own]) =>
      assetTerms(groups.units.get(unitId)?.get(month), sumTerms(own)),
    ),
  );
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
function topAssets(assets: TermsById): string[] {
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

interface TrendGroups {
  units: TermsById;
  assets: TermsById;
  /** month → terms of every unit in scope; null when the total follows an asset filter */
  total: GroupedTerms | null;
  stats: PeriodStats;
}

async function trendGroups(
  manager: EntityManager,
  scope: ReportScope,
  filtered: boolean,
): Promise<TrendGroups> {
  const periodSpec = {
    metrics: RELIABILITY_METRICS,
    level: 'period' as const,
    excludeUnknownTime: true,
  };
  const [units, assets, total, stats] = await Promise.all([
    kpiGroups(manager, scope, {
      ...periodSpec,
      groupSql: `${MONTH} || '|' || ${TIME_GROUPS.unit}`,
    }),
    kpiGroups(manager, scope, {
      groupSql: `${MONTH} || '|' || (k."scope"->>'assetId')`,
      metrics: RELIABILITY_METRICS,
      level: 'asset',
    }),
    filtered
      ? null
      : kpiGroups(manager, scope, { ...periodSpec, groupSql: MONTH }),
    periodStats(manager, scope),
  ]);
  return { units: split(units), assets: split(assets), total, stats };
}

async function trendData(
  manager: EntityManager,
  scope: ReportScope,
  groups: TrendGroups,
  filter: ReadonlyMap<string, string> | null,
): Promise<ReliabilityTrendView> {
  const { units, assets, total } = groups;
  const months = [
    ...new Set([...units.values()].flatMap((m) => [...m.keys()])),
  ].sort();
  const shown = new Set([...topAssets(assets), ...(filter?.keys() ?? [])]);
  const labels = await assetLabels(manager, scope, [...shown]);
  return {
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
    total: totalSeries(months, (m) =>
      filter ? filteredAssetTerms(groups, filter, m) : total?.get(m),
    ),
    failureDefinition: FAILURE_DEFINITION,
    calculationRunIds: groups.stats.runIds,
  };
}

/**
 * `GET /reports/reliability-trend` (R6): MTBF, mean time to restore and MTTR per plant month for each unit
 * and its most-failing assets — the stored terms of the shown runs summed per month, the same definitions
 * as `/reports/reliability` — with a flag where MTBF fell month after month. `total` is the selected scope
 * as one series: every unit in scope, or the `assetIds` (assets of the tenant on the scope's units, else
 * 422 INVALID_REFERENCE), which are listed in `assets` even outside the most-failing ones.
 */
export async function reliabilityTrend(
  manager: EntityManager,
  scope: ReportScope,
  assetIds: readonly string[] = [],
): Promise<AnalyticsResponse<ReliabilityTrendView>> {
  const filter = assetIds.length
    ? await resolveAssets(manager, scope, assetIds)
    : null;
  const groups = await trendGroups(manager, scope, filter !== null);
  const data = await trendData(manager, scope, groups, filter);
  return reportEnvelope(data, {
    scope,
    stats: groups.stats,
    policyVersions: await policyVersions(manager, groups.stats.runIds),
    provisionalData: data.units.some((u) =>
      u.months.some((m) => m.row.mtbf.quality === 'provisional'),
    ),
    notes: [],
  });
}
