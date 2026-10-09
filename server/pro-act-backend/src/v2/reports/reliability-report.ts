import { EntityManager } from 'typeorm';
import { formatDec, ZERO } from '../../domain/actuals/decimal';
import { GroupTerms } from '../../domain/kpi/aggregate';
import { KpiMetric } from '../../domain/kpi/kpi.types';
import { AnalyticsResponse } from '../common/response';
import { ReliabilityReportQueryDto } from './kpi-reports-v2.dto';
import {
  aggregateView,
  ReliabilityReportView,
  ReliabilityRowView,
  reportEnvelope,
} from './kpi-reports-v2.view';
import {
  GroupedTerms,
  kpiGroups,
  periodStats,
  policyVersions,
  TIME_GROUPS,
} from './report-sql';
import { resolveAssets, ReportScope } from './report-scope';

const METRICS: readonly KpiMetric[] = [
  'mtbf',
  'mean_downtime_to_restore',
  'mttr',
];
const FAILURE_DEFINITION =
  'D13 default: FailureWO event or unplanned stop with a failure code, at least the micro-stop threshold long';

type Terms = Map<KpiMetric, GroupTerms>;

function row(
  ids: { unitId: string; assetId: string | null; label: string | null },
  terms: Terms | undefined,
): ReliabilityRowView {
  const mtbf = terms?.get('mtbf');
  return {
    ...ids,
    exposureSeconds: mtbf?.numerator ? formatDec(mtbf.numerator) : null,
    failures: mtbf?.denominator ? formatDec(mtbf.denominator) : null,
    mtbf: aggregateView('mtbf', mtbf),
    meanDowntimeToRestore: aggregateView(
      'mean_downtime_to_restore',
      terms?.get('mean_downtime_to_restore'),
    ),
    mttr: aggregateView('mttr', terms?.get('mttr')),
  };
}

/**
 * An asset's terms: its unit's operating exposure (assets are exposed while their unit runs) over the
 * asset's own failures; restore and repair means from the asset's rows. An asset without failures keeps
 * the exposure and gets null with the reason, never a default.
 */
function assetTerms(unit: Terms | undefined, own: Terms | undefined): Terms {
  const exposure = unit?.get('mtbf');
  const none = (base: GroupTerms | undefined): GroupTerms => ({
    numerator: ZERO,
    denominator: ZERO,
    minValue: null,
    rows: base?.rows ?? 0,
    complete: base?.complete ?? 0,
    provisionalRows: base?.provisionalRows ?? 0,
    policies: 1,
    reasons: [],
  });
  const failures = own?.get('mtbf');
  const terms: Terms = new Map();
  terms.set('mtbf', {
    ...none(exposure),
    numerator: exposure?.numerator ?? null,
    denominator: failures?.denominator ?? ZERO,
  });
  for (const metric of ['mean_downtime_to_restore', 'mttr'] as const) {
    terms.set(metric, own?.get(metric) ?? none(exposure));
  }
  return terms;
}

async function assetUnits(
  manager: EntityManager,
  scope: ReportScope,
  query: ReliabilityReportQueryDto,
  assetRows: GroupedTerms,
): Promise<Array<{ id: string; unitId: string; label: string | null }>> {
  const requested = query.assetIds?.length
    ? await resolveAssets(manager, scope, query.assetIds)
    : null;
  const ids = requested
    ? [...requested.keys()]
    : [...assetRows.keys()].flatMap((k) => (k ? [k] : []));
  if (ids.length === 0) return [];
  const rows: Array<{ id: string; unit_id: string; name: string }> =
    await manager.query(
      `SELECT "id"::text AS "id", "unit_id", "name" FROM "assets" WHERE "tenant_id" = $1::text AND "id" = ANY($2::uuid[]) ORDER BY "id"`,
      [scope.tenantId, ids],
    );
  return rows.map((r) => ({ id: r.id, unitId: r.unit_id, label: r.name }));
}

/**
 * `GET /reports/reliability` (KPI07 / KPI08, plan 2.7 step 5): per unit and per asset, MTBF = Σ operating
 * exposure / Σ eligible failures, mean downtime to restore (labelled; open outages censored) and MTTR only
 * where active-repair evidence exists — all from the stored terms of the shown runs.
 */
export async function reliabilityReport(
  manager: EntityManager,
  scope: ReportScope,
  query: ReliabilityReportQueryDto,
): Promise<AnalyticsResponse<ReliabilityReportView>> {
  const units = await kpiGroups(manager, scope, {
    groupSql: TIME_GROUPS.unit,
    metrics: METRICS,
    level: 'period',
  });
  const assetRows = await kpiGroups(manager, scope, {
    groupSql: `k."scope"->>'assetId'`,
    metrics: METRICS,
    level: 'asset',
  });
  const assets = await assetUnits(manager, scope, query, assetRows);
  const stats = await periodStats(manager, scope);
  const data: ReliabilityReportView = {
    units: [...units.entries()].map(([unitId, terms]) =>
      row({ unitId: unitId ?? '', assetId: null, label: null }, terms),
    ),
    assets: assets.map((a) =>
      row(
        { unitId: a.unitId, assetId: a.id, label: a.label },
        assetTerms(units.get(a.unitId), assetRows.get(a.id)),
      ),
    ),
    failureDefinition: FAILURE_DEFINITION,
    calculationRunIds: stats.runIds,
  };
  return reportEnvelope(data, {
    scope,
    stats,
    policyVersions: await policyVersions(manager, stats.runIds),
    provisionalData: data.units.some((u) => u.mtbf.quality === 'provisional'),
    notes: [
      'MTTR needs active-repair evidence; until then see meanDowntimeToRestore (D13)',
    ],
  });
}
