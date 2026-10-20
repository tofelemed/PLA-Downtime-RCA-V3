import { ReportSection } from '../../../exports/report/report-document';
import { ReportWindowQueryDto } from '../../reports/kpi-reports-v2.dto';
import { resolveReportScope } from '../../reports/report-scope';
import { documentOf, lossTable } from './document-parts';
import {
  BuildInput,
  BuiltReport,
  lossTreeQuery,
  ReportKind,
  windowOf,
} from './report-kind';

const change = (r: { fromProduct: string | null; toProduct: string | null }) =>
  `${r.fromProduct ?? '?'} → ${r.toProduct ?? '?'}`;

/** R5 Grade transitions as a document: per product change, each transition, the transition loss. */
async function build(
  input: BuildInput<ReportWindowQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const kinds: Array<'transition_allowance' | 'transition_excess'> = [
    'transition_allowance',
    'transition_excess',
  ];
  const [view, qty, value] = await Promise.all([
    services.ops.transitionPerformance(context, windowOf(query)),
    services.pla.lossTree(
      context,
      lossTreeQuery(query, { groupBy: 'kind', metric: 'qty', kinds }),
    ),
    money
      ? services.pla.lossTree(
          context,
          lossTreeQuery(query, { groupBy: 'kind', metric: 'value', kinds }),
        )
      : null,
  ]);
  const sections: ReportSection[] = [
    {
      kind: 'table',
      title: 'By product change',
      note: 'Means over ended transitions; excess = duration − the standard’s reference, worst first.',
      sheet: 'Product changes',
      columns: [
        { label: 'Product change', type: 'text', width: 1.8 },
        { label: 'Transitions', type: 'number', places: 0 },
        { label: 'Mean', type: 'duration' },
        { label: 'Best', type: 'duration' },
        { label: 'Worst', type: 'duration' },
        { label: 'Over standard', type: 'number', places: 0 },
        { label: 'With standard', type: 'number', places: 0 },
        { label: 'Mean excess', type: 'duration' },
      ],
      rows: view.pairs.map((p) => [
        change(p),
        p.transitions,
        p.meanSeconds,
        p.bestSeconds,
        p.worstSeconds,
        p.overStandard,
        p.withStandard,
        p.meanExcessSeconds,
      ]),
    },
    {
      kind: 'table',
      title: 'Transitions',
      note: view.truncated ? 'The 500 latest transitions.' : undefined,
      sheet: 'Transitions',
      columns: [
        { label: 'Start', type: 'datetime' },
        { label: 'Unit', type: 'text' },
        { label: 'Product change', type: 'text', width: 1.6 },
        { label: 'Duration', type: 'duration' },
        { label: 'Standard', type: 'duration' },
        { label: 'Excess', type: 'duration' },
        { label: 'Loss within standard', type: 'number' },
        { label: 'Loss over standard', type: 'number' },
        { label: 'Off-grade', type: 'number' },
        { label: 'UoM', type: 'text', width: 0.5 },
        { label: 'Status', type: 'text' },
      ],
      rows: view.transitions.map((t) => [
        t.start,
        t.unitName,
        change(t),
        t.seconds,
        t.referenceSeconds,
        t.excessSeconds,
        t.allowanceLoss,
        t.excessLoss,
        t.offGrade,
        t.uom,
        !t.calculated
          ? 'Not calculated'
          : t.noStandard || !t.standardId
            ? 'No standard'
            : t.seconds === null
              ? 'Running'
              : 'Measured',
      ]),
    },
    lossTable(
      'Transition loss (quantity)',
      qty.data,
      'Kind',
      'Transition loss',
    ),
    ...(value
      ? [
          lossTable(
            'Transition loss (value)',
            value.data,
            'Kind',
            'Transition loss value',
          ),
        ]
      : []),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'transitions',
      title: 'Grade transition performance',
      subtitle:
        'Each product change against its approved standard: duration, excess, loss within and over the allowance',
      money,
    },
    { sections, responses: [qty] },
  );
  return { document, unitIds: scope.unitIds };
}

export const TRANSITIONS_REPORT: ReportKind<ReportWindowQueryDto> = {
  query: ReportWindowQueryDto,
  build,
};
