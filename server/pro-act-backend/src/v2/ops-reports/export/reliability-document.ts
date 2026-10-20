import {
  ReportSection,
  ReportTable,
} from '../../../exports/report/report-document';
import { ReportWindowQueryDto } from '../../reports/kpi-reports-v2.dto';
import { resolveReportScope } from '../../reports/report-scope';
import {
  ReliabilitySeriesView,
  ReliabilityTrendView,
} from '../reliability-trend';
import { documentOf } from './document-parts';
import { BuildInput, BuiltReport, ReportKind, windowOf } from './report-kind';

type Metric = 'mtbf' | 'meanDowntimeToRestore' | 'mttr';

const METRICS: ReadonlyArray<{ key: Metric; label: string; sheet: string }> = [
  { key: 'mtbf', label: 'MTBF', sheet: 'MTBF' },
  {
    key: 'meanDowntimeToRestore',
    label: 'Mean time to restore',
    sheet: 'Time to restore',
  },
  { key: 'mttr', label: 'MTTR (repair evidence)', sheet: 'MTTR' },
];

function seriesTable(
  view: ReliabilityTrendView,
  metric: (typeof METRICS)[number],
  names: Map<string, string>,
): ReportTable {
  const label = (s: ReliabilitySeriesView) =>
    s.assetId
      ? `${s.label ?? 'Asset'} · ${names.get(s.unitId) ?? ''}`
      : (names.get(s.unitId) ?? 'Unit');
  return {
    kind: 'table',
    title: `${metric.label} by month`,
    note:
      metric.key === 'mtbf'
        ? `${view.failureDefinition}. “Falling” = MTBF fell in each of the last three months.`
        : undefined,
    sheet: metric.sheet,
    columns: [
      { label: 'Unit / asset', type: 'text', width: 2.4 },
      ...view.months.map((m) => ({ label: m, type: 'duration' as const })),
      ...(metric.key === 'mtbf'
        ? [{ label: 'Trend', type: 'text' as const }]
        : []),
    ],
    rows: [...view.units, ...view.assets].map((s) => [
      label(s),
      ...view.months.map(
        (m) =>
          s.months.find((x) => x.month === m)?.row[metric.key].value ?? null,
      ),
      ...(metric.key === 'mtbf' ? [s.fallingMtbf ? 'Falling' : ''] : []),
    ]),
  };
}

async function unitNames(
  input: BuildInput<ReportWindowQueryDto>,
  scope: { tenantId: string; unitIds: string[] },
): Promise<Map<string, string>> {
  const rows: Array<{ id: string; name: string }> = await input.manager.query(
    `SELECT "id"::text AS "id", "name" FROM "units" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
    [scope.tenantId, scope.unitIds],
  );
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** R6 Reliability trend as a document: MTBF, time to restore and MTTR per month for units and assets. */
async function build(
  input: BuildInput<ReportWindowQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const response = await services.ops.reliabilityTrend(
    context,
    windowOf(query),
  );
  const names = await unitNames(input, scope);
  const sections: ReportSection[] = METRICS.map((m) =>
    seriesTable(response.data, m, names),
  );
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'reliability',
      title: 'Reliability trend',
      subtitle:
        'MTBF, mean time to restore and MTTR per plant month for each unit and its most-failing assets',
      money,
    },
    { sections, responses: [response] },
  );
  return { document, unitIds: scope.unitIds };
}

export const RELIABILITY_REPORT: ReportKind<ReportWindowQueryDto> = {
  query: ReportWindowQueryDto,
  build,
};
