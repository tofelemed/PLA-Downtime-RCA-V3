import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import {
  ReportFacts,
  ReportSection,
  ReportTable,
} from '../../../exports/report/report-document';
import {
  MonthCloseV2View,
  toMonthCloseView,
} from '../../close/month-close-v2.view';
import { ScopeWaterfallQueryDto } from '../../pla-reports/pla-reports.dto';
import { WaterfallV2View } from '../../period-overview/waterfall.view';
import { ReportWindowQueryDto } from '../../reports/kpi-reports-v2.dto';
import { LossValueReportQueryDto } from '../../reports/loss-value-v2.dto';
import { LossValueReportView } from '../../reports/loss-value-report';
import { resolveReportScope } from '../../reports/report-scope';
import { RestatementsView } from '../restatements-report';
import { documentOf, lossTable } from './document-parts';
import {
  BuildInput,
  BuiltReport,
  lossTreeQuery,
  ReportKind,
  windowOf,
} from './report-kind';

/** R3 export: the month's window, and its month-close key for the certification facts. */
export class MonthlyExportQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    description:
      'Financial month key of the window (month close), e.g. 1405-07; absent = no certification part',
  })
  @IsOptional()
  @Matches(/^(?:(?:gregorian|persian):)?\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}

const signed = (who: { name: string | null } | null, at: string | null) =>
  who ? `${who.name ?? 'someone'} · ${at ?? ''}` : 'not yet';

function certification(view: MonthCloseV2View): ReportFacts {
  const p = view.prerequisites;
  const s = view.signOffs;
  return {
    kind: 'facts',
    title: `Certification · ${view.monthKey} (${view.calendar})`,
    rows: [
      ['Month close state', view.state.replace(/_/g, ' ')],
      ['Periods approved', `${p.approved} of ${p.periods}`],
      ['Production days certified', `${p.certifiedDays} of ${p.days}`],
      ['Open change proposals', String(p.openProposalCount)],
      ['Quantities closed', signed(s.quantitiesClosedBy, s.quantitiesClosedAt)],
      [
        'Finance signed off',
        signed(s.financeSignedOffBy, s.financeSignedOffAt),
      ],
      ['Locked', signed(s.lockedBy, s.lockedAt)],
    ],
  };
}

function waterfallTable(view: WaterfallV2View): ReportTable {
  return {
    kind: 'table',
    title: 'Capacity waterfall',
    note: `From capacity to good output on the capacity ledger${view.uom ? ` (${view.uom})` : ''}; the steps add up to the closing total.`,
    sheet: 'Waterfall',
    columns: [
      { label: 'Step', type: 'text', width: 2.4 },
      { label: 'Change', type: 'number' },
      { label: 'Running total', type: 'number' },
    ],
    rows: view.bars.map((b) => [b.label, b.delta, b.end]),
  };
}

function lossValueTable(view: LossValueReportView): ReportTable {
  return {
    kind: 'table',
    title: `Loss value by category · ${view.label}`,
    note: 'Amounts per reporting currency, never converted or added across views; an amount that is not fully valued is left empty.',
    sheet: 'Loss value',
    columns: [
      { label: 'Category', type: 'text', width: 2 },
      { label: 'Currency', type: 'text', width: 0.7 },
      { label: 'Amount', type: 'number', places: 2, width: 1.4 },
      { label: 'Valuation', type: 'text' },
    ],
    rows: view.groups.flatMap((g) =>
      g.currencies.map((c) => [g.key, c.currency, c.amount, c.status]),
    ),
  };
}

function restatementTable(view: RestatementsView): ReportTable {
  return {
    kind: 'table',
    title: 'Restatements',
    sheet: 'Restatements',
    columns: [
      { label: 'Unit', type: 'text' },
      { label: 'Plant date', type: 'date' },
      { label: 'Shift', type: 'text', width: 0.6 },
      { label: 'Revision', type: 'number', places: 0, width: 0.6 },
      { label: 'After close', type: 'text', width: 0.7 },
      { label: 'Good before', type: 'number' },
      { label: 'Good after', type: 'number' },
      { label: 'Change', type: 'number' },
      { label: 'Posting', type: 'text' },
      { label: 'Posting date', type: 'date' },
    ],
    rows: view.rows.map((r) => [
      r.unitName,
      r.localDate,
      r.shiftName,
      r.revision,
      r.afterClose ? 'Yes' : 'No',
      r.goodBefore,
      r.goodAfter,
      r.goodDelta,
      r.treatment ?? 'Not decided yet',
      r.postingDate,
    ]),
  };
}

async function valueSections(
  input: BuildInput<MonthlyExportQueryDto>,
): Promise<ReportSection[]> {
  if (!input.money) return [];
  const { services, context, query } = input;
  const [kinds, reasons, value] = await Promise.all([
    services.pla.lossTree(
      context,
      lossTreeQuery(query, { groupBy: 'kind', metric: 'value' }),
    ),
    services.pla.lossTree(
      context,
      lossTreeQuery(query, { groupBy: 'reason', metric: 'value', limit: 10 }),
    ),
    services.value.lossValue(
      context,
      Object.assign(new LossValueReportQueryDto(), windowOf(query), {
        groupBy: 'kind' as const,
        ledger: 'plan' as const,
      }),
    ),
  ]);
  return [
    lossTable(
      'Losses by category (value)',
      kinds.data,
      'Category',
      'Categories value',
    ),
    lossTable(
      'Top 10 losses (value)',
      reasons.data,
      'Reason',
      'Top losses value',
    ),
    lossValueTable(value.data),
  ];
}

/**
 * R3 Monthly loss accounting statement as a document: certification of the financial month, the capacity
 * waterfall, losses by category and the top 10 by reason (quantity; value for money roles), the loss value by
 * category and the restatements of the month.
 */
async function build(
  input: BuildInput<MonthlyExportQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const [close, waterfall, kinds, reasons, restatements, values] =
    await Promise.all([
      query.month
        ? services.close.snapshot(context, { key: query.month })
        : null,
      services.pla.scopeWaterfall(
        context,
        Object.assign(new ScopeWaterfallQueryDto(), windowOf(query), {
          ledger: 'capacity' as const,
        }),
      ),
      services.pla.lossTree(
        context,
        lossTreeQuery(query, { groupBy: 'kind', metric: 'qty' }),
      ),
      services.pla.lossTree(
        context,
        lossTreeQuery(query, { groupBy: 'reason', metric: 'qty', limit: 10 }),
      ),
      services.ops.restatements(context, windowOf(query)),
      valueSections(input),
    ]);
  const sections: ReportSection[] = [
    ...(close ? [certification(toMonthCloseView(close))] : []),
    waterfallTable(waterfall.data),
    lossTable(
      'Losses by category (quantity)',
      kinds.data,
      'Category',
      'Categories',
    ),
    lossTable('Top 10 losses (quantity)', reasons.data, 'Reason', 'Top losses'),
    ...values,
    restatementTable(restatements),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'monthly',
      title: `Monthly loss accounting statement${query.month ? ` · ${query.month}` : ''}`,
      subtitle:
        'Certification, capacity waterfall, losses by category and reason, loss value and restatements',
      money,
    },
    { sections, responses: [waterfall, kinds] },
  );
  return { document, unitIds: scope.unitIds };
}

export const MONTHLY_REPORT: ReportKind<MonthlyExportQueryDto> = {
  query: MonthlyExportQueryDto,
  build,
};
