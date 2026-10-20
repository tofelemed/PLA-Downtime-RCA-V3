import { ReportSection } from '../../../exports/report/report-document';
import { ReportWindowQueryDto } from '../../reports/kpi-reports-v2.dto';
import { resolveReportScope } from '../../reports/report-scope';
import { ChronicSporadicQueryDto } from '../ops-reports-v2.dto';
import { documentOf, lossTable } from './document-parts';
import {
  BuildInput,
  BuiltReport,
  lossTreeQuery,
  ReportKind,
  windowOf,
} from './report-kind';

const PATTERNS: Readonly<Record<string, string>> = {
  chronic: 'Chronic (frequent, short)',
  sporadic: 'Sporadic (rare, long)',
  major: 'Major (frequent, long)',
  minor: 'Minor (rare, short)',
};

/** R7 Chronic vs sporadic as a document: each cause's stops, downtime, mean stop and pattern. */
async function chronic(
  input: BuildInput<ChronicSporadicQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const response = await services.ops.chronicSporadic(context, query);
  const data = response.data;
  const sections: ReportSection[] = [
    {
      kind: 'table',
      title: `Chronic and sporadic losses by ${data.groupBy}`,
      note: `Unplanned and not yet classified stops, micro-stops included; cut at the medians of these dates (${data.medianStops ?? '—'} stops, a mean stop of ${data.medianMeanSeconds ?? '—'} s).`,
      sheet: 'Chronic vs sporadic',
      columns: [
        {
          label: data.groupBy === 'asset' ? 'Asset' : 'Reason',
          type: 'text',
          width: 2.4,
        },
        { label: 'Stops', type: 'number', places: 0 },
        { label: 'Downtime', type: 'duration' },
        { label: 'Mean stop', type: 'duration' },
        { label: 'Pattern', type: 'text', width: 1.6 },
      ],
      rows: data.rows.map((r) => [
        r.label ?? (r.key ? 'Unknown' : 'Not coded'),
        r.stops,
        r.seconds,
        r.meanSeconds,
        r.quadrant ? PATTERNS[r.quadrant] : null,
      ]),
    },
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'chronic',
      title: 'Chronic vs sporadic losses',
      subtitle:
        'Frequent small losses need a systematic fix; rare long ones need prevention of the failure mode',
      money,
    },
    { sections, responses: [response] },
  );
  return { document, unitIds: scope.unitIds };
}

/** R8 Rate loss as a document: equivalent downtime and performance by month, performance loss by cause and unit. */
async function rate(
  input: BuildInput<ReportWindowQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const tree = (groupBy: 'reason' | 'unit', metric: 'qty' | 'value') =>
    services.pla.lossTree(
      context,
      lossTreeQuery(query, {
        groupBy,
        metric,
        kinds: ['performance'],
        limit: groupBy === 'reason' ? 15 : undefined,
      }),
    );
  const [trend, reasons, units, reasonValue] = await Promise.all([
    services.ops.rateLoss(context, windowOf(query)),
    tree('reason', 'qty'),
    tree('unit', 'qty'),
    money ? tree('reason', 'value') : null,
  ]);
  const sections: ReportSection[] = [
    {
      kind: 'kpis',
      title: 'Running below rate, these dates',
      items: [
        {
          label: 'Equivalent downtime',
          value: trend.data.total.equivalentDowntime.value,
          type: 'duration',
          caption: 'rate lost as time at the reference rate',
        },
        {
          label: 'Performance',
          value: trend.data.total.performance.value,
          type: 'percent',
        },
      ],
    },
    {
      kind: 'table',
      title: 'By month',
      sheet: 'By month',
      columns: [
        { label: 'Month', type: 'month' },
        { label: 'Equivalent downtime', type: 'duration' },
        { label: 'Performance', type: 'percent' },
      ],
      rows: trend.data.months.map((m) => [
        m.month,
        m.equivalentDowntime.value,
        m.performance.value,
      ]),
    },
    lossTable(
      'Rate loss by cause (quantity)',
      reasons.data,
      'Reason',
      'By cause',
    ),
    ...(reasonValue
      ? [
          lossTable(
            'Rate loss by cause (value)',
            reasonValue.data,
            'Reason',
            'By cause value',
          ),
        ]
      : []),
    lossTable('Rate loss by unit (quantity)', units.data, 'Unit', 'By unit'),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'rate',
      title: 'Rate-loss analysis',
      subtitle: 'The hidden loss of running below the reference rate',
      money,
    },
    { sections, responses: [trend, reasons] },
  );
  return { document, unitIds: scope.unitIds };
}

export const CHRONIC_REPORT: ReportKind<ChronicSporadicQueryDto> = {
  query: ChronicSporadicQueryDto,
  build: chronic,
};
export const RATE_REPORT: ReportKind<ReportWindowQueryDto> = {
  query: ReportWindowQueryDto,
  build: rate,
};
