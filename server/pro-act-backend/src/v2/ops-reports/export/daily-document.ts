import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import {
  ReportSection,
  ReportTable,
} from '../../../exports/report/report-document';
import { INSTANT, INSTANT_MESSAGE } from '../../profiles/profile-v2.dto';
import { ReportWindowQueryDto } from '../../reports/kpi-reports-v2.dto';
import { resolveReportScope } from '../../reports/report-scope';
import { EventStatusRowView } from '../event-status';
import { ProductionByProductQueryDto } from '../ops-reports-v2.dto';
import {
  documentOf,
  lossTable,
  oeeKpis,
  productionTable,
} from './document-parts';
import {
  BuildInput,
  BuiltReport,
  lossTreeQuery,
  oeeQuery,
  ReportKind,
  windowOf,
} from './report-kind';

/** R1 export: the chosen days, and the month to date from `monthFrom` (the page's financial month start). */
export class DailyExportQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({
    description:
      'Start of the month to date (ISO 8601 with offset); absent = no month-to-date part',
  })
  @IsOptional()
  @Matches(INSTANT, { message: `monthFrom ${INSTANT_MESSAGE}` })
  monthFrom?: string;
}

const EVENT_TYPES: Readonly<Record<string, string>> = {
  downtime: 'Stops',
  slowdown: 'Slowdowns',
  quality_loss: 'Quality losses',
  grade_transition: 'Grade transitions',
};

export function eventStatusTable(
  rows: readonly EventStatusRowView[],
): ReportTable {
  return {
    kind: 'table',
    title: 'Events: coding and verification',
    sheet: 'Event coding',
    columns: [
      { label: 'Events', type: 'text', width: 1.6 },
      { label: 'Total', type: 'number', places: 0 },
      { label: 'Still running', type: 'number', places: 0 },
      { label: 'Not coded', type: 'number', places: 0 },
      { label: 'Verified', type: 'number', places: 0 },
      { label: 'Duration', type: 'duration' },
      { label: 'Not coded duration', type: 'duration' },
    ],
    rows: rows.map((r) => [
      EVENT_TYPES[r.physicalType] ?? r.physicalType,
      r.events,
      r.open,
      r.uncoded,
      r.verified,
      r.seconds,
      r.uncodedSeconds,
    ]),
  };
}

async function periodSections(
  input: BuildInput<DailyExportQueryDto>,
  query: ReportWindowQueryDto,
  label: string,
) {
  const { services, context } = input;
  const production = Object.assign(
    new ProductionByProductQueryDto(),
    windowOf(query),
    { groupBy: 'total' as const },
  );
  const [oee, output] = await Promise.all([
    services.kpi.oee(context, oeeQuery(query)),
    services.ops.productionByProduct(context, production),
  ]);
  const sections: ReportSection[] = [
    oeeKpis(`Operational OEE · ${label}`, oee.data.total),
    productionTable(`Production by product · ${label}`, output.data.rows),
  ];
  return { sections, responses: [oee, output] };
}

/**
 * R1 Daily production report as a document: OEE and production of the chosen days and of the month to
 * date, the five largest losses (quantity, and value for money roles) and the event coding status.
 */
async function build(
  input: BuildInput<DailyExportQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const scope = await resolveReportScope(manager, context, query);
  const days = await periodSections(input, query, 'chosen days');
  const month = query.monthFrom
    ? await periodSections(
        input,
        Object.assign(windowOf(query), { from: query.monthFrom }),
        'month to date',
      )
    : { sections: [], responses: [] };
  const [qty, value, events] = await Promise.all([
    services.pla.lossTree(
      context,
      lossTreeQuery(query, { groupBy: 'reason', metric: 'qty', limit: 5 }),
    ),
    money
      ? services.pla.lossTree(
          context,
          lossTreeQuery(query, {
            groupBy: 'reason',
            metric: 'value',
            limit: 5,
          }),
        )
      : null,
    services.ops.eventStatus(context, windowOf(query)),
  ]);
  const sections: ReportSection[] = [
    ...days.sections,
    ...month.sections,
    lossTable('Top 5 losses (quantity)', qty.data, 'Reason', 'Top losses'),
    ...(value
      ? [
          lossTable(
            'Top 5 losses (value)',
            value.data,
            'Reason',
            'Top losses value',
          ),
        ]
      : []),
    eventStatusTable(events.rows),
  ];
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'daily',
      title: 'Daily production report',
      subtitle:
        'OEE, output against plan, quality, largest losses and event coding of the chosen production days',
      money,
    },
    { sections, responses: [...days.responses, ...month.responses, qty] },
  );
  return { document, unitIds: scope.unitIds };
}

export const DAILY_REPORT: ReportKind<DailyExportQueryDto> = {
  query: DailyExportQueryDto,
  build,
};
