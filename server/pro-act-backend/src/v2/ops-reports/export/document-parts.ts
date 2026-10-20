import { EntityManager } from 'typeorm';
import {
  ReportColumn,
  ReportDocument,
  ReportKpi,
  ReportKpis,
  ReportSection,
  ReportTable,
} from '../../../exports/report/report-document';
import { AnalyticsResponse } from '../../common/response';
import { LossTreeView } from '../../pla-reports/loss-tree-report';
import { KpiAggregateView } from '../../reports/kpi-reports-v2.view';
import { ReportScope } from '../../reports/report-scope';
import { ProductionRowView } from '../production-by-product';

/** What a report's title block says, and the sections of its body. */
export interface DocumentHead {
  kind: string;
  title: string;
  subtitle: string;
  money: boolean;
}

const SHOWN_UNIT_NAMES = 12;

/** The units of the scope by name (at most 12, then "and N more"). */
export async function unitNames(
  manager: EntityManager,
  scope: ReportScope,
): Promise<string[]> {
  const rows: Array<{ name: string }> = await manager.query(
    `SELECT "name" FROM "units" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[]) ORDER BY "name"`,
    [scope.tenantId, scope.unitIds],
  );
  const names = rows.map((r) => r.name);
  return names.length > SHOWN_UNIT_NAMES
    ? [
        ...names.slice(0, SHOWN_UNIT_NAMES),
        `and ${names.length - SHOWN_UNIT_NAMES} more`,
      ]
    : names;
}

/** The provisional state of the responses a document is built from. */
export function provisionalOf(
  responses: ReadonlyArray<
    Pick<AnalyticsResponse<unknown>, 'isProvisional' | 'dataQuality'>
  >,
): {
  provisional: boolean;
  unapprovedPeriods: number;
} {
  return {
    provisional: responses.some((r) => r.isProvisional),
    unapprovedPeriods: Math.max(
      0,
      ...responses.map((r) => r.dataQuality.provisionalCount),
    ),
  };
}

export async function documentOf(
  manager: EntityManager,
  scope: ReportScope,
  head: DocumentHead,
  body: {
    sections: ReportSection[];
    responses: ReadonlyArray<
      Pick<AnalyticsResponse<unknown>, 'isProvisional' | 'dataQuality'>
    >;
  },
): Promise<ReportDocument> {
  return {
    ...head,
    from: scope.from.toISOString(),
    to: scope.to.toISOString(),
    units: await unitNames(manager, scope),
    ...provisionalOf(body.responses),
    sections: body.sections,
  };
}

const KPI_LABELS: Readonly<Record<string, string>> = {
  oee: 'OEE',
  availability: 'Availability',
  performance: 'Performance',
  quality: 'Quality',
  reconciled_oee: 'Reconciled OEE',
};

/** OEE and its components as tiles (null value when the server could not compute it). */
export function oeeKpis(
  title: string,
  views: readonly KpiAggregateView[],
): ReportKpis {
  const items: ReportKpi[] = views.map((v) => ({
    label: KPI_LABELS[v.metric] ?? v.metric,
    value: v.value,
    type: 'percent',
    caption: v.value === null ? (v.reason ?? 'not available') : undefined,
  }));
  return { kind: 'kpis', title, items };
}

/** A quantity column (its unit of measure is a column of the row). */
const qty = (label: string): ReportColumn => ({ label, type: 'number' });

/** Output per product (R1, R2, R4): plan, actual, attainment, prime, wide spec, off-grade, yield, capacity. */
export function productionTable(
  title: string,
  rows: readonly ProductionRowView[],
): ReportTable {
  return {
    kind: 'table',
    title,
    note: 'Plan ledger target and actual of the shown runs; prime = good − wide spec; off-grade = downgrade + transition off-grade + scrap + rework + not classified.',
    sheet: 'Production',
    columns: [
      { label: 'Product', type: 'text', width: 2.4 },
      { label: 'UoM', type: 'text', width: 0.6 },
      qty('Plan'),
      qty('Actual'),
      { label: 'Attainment', type: 'percent' },
      qty('Prime'),
      qty('Wide spec'),
      qty('Off-grade'),
      { label: 'Prime yield', type: 'percent' },
      qty('Capacity'),
    ],
    rows: rows.map((r) => [
      r.productCode
        ? `${r.productCode}${r.productName ? ` · ${r.productName}` : ''}`
        : 'Unknown product',
      r.uom,
      r.target,
      r.actual,
      r.planAttainment,
      r.prime,
      r.wideSpec,
      r.offGrade,
      r.primeYield,
      r.capacity,
    ]),
  };
}

/** Loss lines by a grouping in quantity or money (the loss tree): label, amount, share, cumulative share. */
export function lossTable(
  title: string,
  view: LossTreeView,
  groupTitle: string,
  sheet?: string,
): ReportTable {
  const money = view.metric !== 'qty';
  return {
    kind: 'table',
    title,
    sheet,
    columns: [
      { label: groupTitle, type: 'text', width: 2.6 },
      money
        ? { label: 'Value', type: 'number', places: 2, width: 1.4 }
        : { label: 'Quantity', type: 'number' },
      { label: money ? 'Currency' : 'Unit', type: 'text', width: 0.7 },
      { label: 'Share', type: 'percent' },
      { label: 'Cumulative', type: 'percent' },
    ],
    rows: view.groups.map((g) => [
      g.label ?? (g.key ? 'Unknown' : 'Not coded'),
      g.amount,
      g.unit,
      g.share,
      g.cumulativeShare,
    ]),
  };
}
