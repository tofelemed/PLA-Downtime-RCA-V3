import {
  ReportSection,
  ReportTable,
} from '../../../exports/report/report-document';
import { ReportWindowQueryDto } from '../../reports/kpi-reports-v2.dto';
import { resolveReportScope } from '../../reports/report-scope';
import { ProductionByProductQueryDto } from '../ops-reports-v2.dto';
import { ProductionRowView } from '../production-by-product';
import { QualityDispositionsView } from '../quality-dispositions';
import { documentOf, lossTable, productionTable } from './document-parts';
import {
  BuildInput,
  BuiltReport,
  lossTreeQuery,
  ReportKind,
  windowOf,
} from './report-kind';

const CLASSES: Readonly<Record<string, string>> = {
  wide_spec: 'Wide spec',
  downgrade: 'Downgrade',
  transition_off_grade: 'Transition off-grade',
  scrap: 'Scrap',
  rework: 'Rework',
  recovered: 'Recovered',
};

export function yieldTable(rows: readonly ProductionRowView[]): ReportTable {
  return {
    kind: 'table',
    title: 'Prime yield by day',
    sheet: 'Prime yield',
    columns: [
      { label: 'Plant date', type: 'date' },
      { label: 'Product', type: 'text', width: 1.6 },
      { label: 'UoM', type: 'text', width: 0.5 },
      { label: 'Gross', type: 'number' },
      { label: 'Prime', type: 'number' },
      { label: 'Off-grade', type: 'number' },
      { label: 'Prime yield', type: 'percent' },
    ],
    rows: rows.map((r) => [
      r.key,
      r.productCode ?? 'Unknown product',
      r.uom,
      r.gross,
      r.prime,
      r.offGrade,
      r.primeYield,
    ]),
  };
}

function dispositionTable(view: QualityDispositionsView): ReportTable {
  return {
    kind: 'table',
    title: 'Lot dispositions',
    note:
      view.pending > 0
        ? `${view.pending} lot(s) wait for a quality decision.`
        : 'No lot waits for a quality decision.',
    sheet: 'Dispositions',
    columns: [
      { label: 'Class', type: 'text', width: 1.4 },
      { label: 'Decision', type: 'text' },
      { label: 'Product', type: 'text' },
      { label: 'Lots', type: 'number', places: 0 },
      { label: 'Quantity', type: 'number' },
      { label: 'UoM', type: 'text', width: 0.5 },
    ],
    rows: view.groups.map((g) => [
      CLASSES[g.dispositionClass] ?? g.dispositionClass,
      g.state,
      g.productCode,
      g.lots,
      g.quantity,
      g.uom,
    ]),
  };
}

/** R4 Quality and off-grade as a document: output split by quality, loss by class, yield by day, dispositions. */
async function build(
  input: BuildInput<ReportWindowQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const production = (groupBy: 'total' | 'day') =>
    services.ops.productionByProduct(
      context,
      Object.assign(new ProductionByProductQueryDto(), windowOf(query), {
        groupBy,
      }),
    );
  const classes = (metric: 'qty' | 'value') =>
    services.pla.lossTree(
      context,
      lossTreeQuery(query, {
        groupBy: 'qualityClass',
        metric,
        kinds: ['quality'],
      }),
    );
  const [total, daily, qty, value, dispositions] = await Promise.all([
    production('total'),
    production('day'),
    classes('qty'),
    money ? classes('value') : null,
    services.ops.qualityDispositions(context, windowOf(query)),
  ]);
  const sections: ReportSection[] = [
    productionTable('Output by product', total.data.rows),
    lossTable(
      'Quality loss by class (quantity)',
      qty.data,
      'Class',
      'Quality loss',
    ),
    ...(value
      ? [
          lossTable(
            'Quality loss by class (value)',
            value.data,
            'Class',
            'Quality loss value',
          ),
        ]
      : []),
    yieldTable([...daily.data.rows].reverse()),
    dispositionTable(dispositions),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'quality',
      title: 'Quality and off-grade report',
      subtitle:
        'Prime, wide spec and off-grade output, quality loss by class, prime yield and lot dispositions',
      money,
    },
    { sections, responses: [total, qty] },
  );
  return { document, unitIds: scope.unitIds };
}

export const QUALITY_REPORT: ReportKind<ReportWindowQueryDto> = {
  query: ReportWindowQueryDto,
  build,
};
