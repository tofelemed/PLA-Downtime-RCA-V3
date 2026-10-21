import {
  ReportSection,
  ReportTable,
} from '../../../exports/report/report-document';
import { ReportWindowQueryDto } from '../../reports/kpi-reports-v2.dto';
import { resolveReportScope } from '../../reports/report-scope';
import { ComplianceRowView } from '../coding-compliance';
import { CountView } from '../rca-action-tracker';
import { eventStatusTable } from './daily-document';
import { documentOf, lossTable } from './document-parts';
import { yieldTable } from './quality-document';
import {
  BuildInput,
  BuiltReport,
  lossTreeQuery,
  ReportKind,
  windowOf,
} from './report-kind';
import { ProductionByProductQueryDto } from '../ops-reports-v2.dto';

function complianceTable(
  title: string,
  group: string,
  rows: readonly ComplianceRowView[],
): ReportTable {
  return {
    kind: 'table',
    title,
    sheet: title,
    columns: [
      { label: group, type: 'text', width: 1.4 },
      { label: 'Stops', type: 'number', places: 0 },
      { label: 'Coded', type: 'number', places: 0 },
      { label: 'Verified', type: 'number', places: 0 },
      { label: 'Coding delay (median)', type: 'duration' },
      { label: 'Coding delay (90 %)', type: 'duration' },
      { label: 'Downtime coded', type: 'percent' },
      { label: 'Known state', type: 'percent' },
    ],
    rows: rows.map((r) => [
      r.label ?? r.key ?? 'Not recorded',
      r.stops,
      r.coded,
      r.verified,
      r.medianDelaySeconds,
      r.p90DelaySeconds,
      r.codedDowntimeRatio.value,
      r.stateCoverage.value,
    ]),
  };
}

/** R9 Coding compliance as a document: per crew and shift, and the event coding status. */
async function compliance(
  input: BuildInput<ReportWindowQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const [response, events] = await Promise.all([
    services.ops.codingCompliance(context, windowOf(query)),
    services.ops.eventStatus(context, windowOf(query)),
  ]);
  const sections: ReportSection[] = [
    complianceTable('By crew', 'Crew', response.data.byCrew),
    complianceTable('By shift', 'Shift', response.data.byShift),
    eventStatusTable(events.rows),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'compliance',
      title: 'Data quality and coding compliance',
      subtitle:
        'How far stops are coded and verified, how long coding takes, and the share of time with a known state',
      money,
    },
    { sections, responses: [response] },
  );
  return { document, unitIds: scope.unitIds };
}

const AGE: Readonly<Record<string, string>> = {
  '0-30': 'Up to 30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': 'Over 90 days',
};
const DUE: Readonly<Record<string, string>> = {
  overdue: 'Overdue',
  due_7_days: 'Due within 7 days',
  later: 'Due later',
  no_due_date: 'No due date',
};

const countsTable = (
  title: string,
  counts: readonly CountView[],
  labels: Readonly<Record<string, string>> = {},
): ReportTable => ({
  kind: 'table',
  title,
  columns: [
    { label: 'Group', type: 'text', width: 2 },
    { label: 'Count', type: 'number', places: 0 },
  ],
  rows: counts.map((c) => [labels[c.key] ?? c.key, c.count]),
});

/** R10 RCA action tracker as a document: open cases and actions, closures of the dates. */
async function rca(
  input: BuildInput<ReportWindowQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const view = await services.ops.rcaActionTracker(context, windowOf(query));
  const sections: ReportSection[] = [
    {
      kind: 'kpis',
      title: 'RCA pipeline',
      items: [
        {
          label: 'Open cases',
          value: view.openCases.total,
          type: 'number',
          places: 0,
        },
        {
          label: 'Cases past target date',
          value: view.openCases.overdue,
          type: 'number',
          places: 0,
        },
        {
          label: 'Open actions',
          value: view.openActions.total,
          type: 'number',
          places: 0,
        },
        {
          label: 'Actions done on time',
          value: view.closedActions.onTimeRate,
          type: 'percent',
          caption: `${view.closedActions.onTime} of ${view.closedActions.withDueDate} with a due date`,
        },
        {
          label: 'Cases closed',
          value: view.closedCases.closed,
          type: 'number',
          places: 0,
        },
        {
          label: 'Mean days to close',
          value: view.closedCases.meanDaysToClose,
          type: 'number',
        },
      ],
    },
    countsTable('Open cases by age', view.openCases.byAge, AGE),
    countsTable('Open cases by status', view.openCases.byStatus),
    countsTable('Open actions by due date', view.openActions.byDue, DUE),
    countsTable('Open actions by age', view.openActions.byAge, AGE),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'rca',
      title: 'RCA action tracker',
      subtitle:
        'Open root-cause work by age and due date; actions done on time and cases closed on these dates',
      money,
    },
    { sections, responses: [] },
  );
  const units =
    query.unitIds?.length || scope.restricted ? scope.unitIds : null;
  return { document, unitIds: units };
}

/** R11 Plan adherence as a document: per grade, then the daily output. */
async function plan(
  input: BuildInput<ReportWindowQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const [adherence, daily] = await Promise.all([
    services.ops.planAdherence(context, windowOf(query)),
    services.ops.productionByProduct(
      context,
      Object.assign(new ProductionByProductQueryDto(), windowOf(query), {
        groupBy: 'day' as const,
      }),
    ),
  ]);
  const sections: ReportSection[] = [
    {
      kind: 'table',
      title: 'Plan adherence by grade',
      note: "Volume adherence counts each day's output only up to that day's plan.",
      sheet: 'Plan adherence',
      columns: [
        { label: 'Product', type: 'text', width: 1.6 },
        { label: 'UoM', type: 'text', width: 0.5 },
        { label: 'Planned days', type: 'number', places: 0 },
        { label: 'Ran as planned', type: 'number', places: 0 },
        { label: 'Planned, not run', type: 'number', places: 0 },
        { label: 'Run without plan', type: 'number', places: 0 },
        { label: 'Plan', type: 'number' },
        { label: 'Actual', type: 'number' },
        { label: 'Attainment', type: 'percent' },
        { label: 'Volume adherence', type: 'percent' },
        { label: 'Day adherence', type: 'percent' },
      ],
      rows: adherence.data.rows.map((r) => [
        r.productCode ?? 'Unknown product',
        r.uom,
        r.plannedDays,
        r.ranAsPlannedDays,
        r.missedDays,
        r.unplannedDays,
        r.target,
        r.actual,
        r.attainment,
        r.volumeAdherence,
        r.dayAdherence,
      ]),
    },
    yieldTable([...daily.data.rows].reverse()),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'plan',
      title: 'Plan adherence by grade',
      subtitle:
        'Did each planned grade run on its planned days, and how much of the plan it met',
      money,
    },
    { sections, responses: [adherence] },
  );
  return { document, unitIds: scope.unitIds };
}

/** R12 Executive scorecard as a document: the months of the window, then the top three loss themes. */
async function scorecard(
  input: BuildInput<ReportWindowQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money, currency } = input;
  const scope = await resolveReportScope(manager, context, query);
  const [response, themes] = await Promise.all([
    services.ops.monthlyScorecard(context, windowOf(query)),
    services.pla.lossTree(
      context,
      lossTreeQuery(query, { groupBy: 'reason', metric: 'qty', limit: 3 }),
    ),
  ]);
  const kpi = (m: (typeof response.data.months)[number], metric: string) =>
    m.oee.find((k) => k.metric === metric)?.value ?? null;
  const single = (m: (typeof response.data.months)[number]) =>
    m.output.length === 1 ? m.output[0] : null;
  // the export's reporting currency only (never the first of several, never converted)
  const money0 = (m: (typeof response.data.months)[number]) =>
    m.lossValue.find((value) => value.currency === currency) ?? null;
  const sections: ReportSection[] = [
    {
      kind: 'table',
      title: 'Scorecard by month',
      note: `Loss value in the approved policy's default view (${response.data.valueMetric}); empty when not fully valued.`,
      sheet: 'Scorecard',
      columns: [
        { label: 'Month', type: 'month' },
        { label: 'OEE', type: 'percent' },
        { label: 'Availability', type: 'percent' },
        { label: 'Performance', type: 'percent' },
        { label: 'Quality', type: 'percent' },
        { label: 'Utilisation', type: 'percent' },
        { label: 'Capacity lost', type: 'percent' },
        { label: 'Plan attainment', type: 'percent' },
        ...(money
          ? [
              {
                label: 'Loss value',
                type: 'number' as const,
                places: 2,
                width: 1.3,
              },
              { label: 'Currency', type: 'text' as const, width: 0.6 },
            ]
          : []),
      ],
      rows: response.data.months.map((m) => [
        m.month,
        kpi(m, 'oee'),
        kpi(m, 'availability'),
        kpi(m, 'performance'),
        kpi(m, 'quality'),
        single(m)?.utilisation ?? null,
        single(m)?.lossShare ?? null,
        single(m)?.planAttainment ?? null,
        ...(money
          ? [money0(m)?.amount ?? null, money0(m)?.currency ?? null]
          : []),
      ]),
    },
    lossTable('Top 3 loss themes', themes.data, 'Reason', 'Loss themes'),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'scorecard',
      title: 'Executive scorecard',
      subtitle:
        'OEE, utilisation, capacity lost, plan attainment and money lost by month',
      money,
    },
    { sections, responses: [response] },
  );
  return { document, unitIds: scope.unitIds };
}

export const COMPLIANCE_REPORT: ReportKind<ReportWindowQueryDto> = {
  query: ReportWindowQueryDto,
  build: compliance,
};
export const RCA_REPORT: ReportKind<ReportWindowQueryDto> = {
  query: ReportWindowQueryDto,
  build: rca,
};
export const PLAN_REPORT: ReportKind<ReportWindowQueryDto> = {
  query: ReportWindowQueryDto,
  build: plan,
};
export const SCORECARD_REPORT: ReportKind<ReportWindowQueryDto> = {
  query: ReportWindowQueryDto,
  build: scorecard,
};
