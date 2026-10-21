import { ReportSection } from '../../../exports/report/report-document';
import { resolveReportScope } from '../../reports/report-scope';
import { ShiftHandoverQueryDto } from '../ops-reports-v2.dto';
import { ShiftHandoverView } from '../shift-handover';
import { eventStatusTable } from './daily-document';
import { documentOf, productionTable } from './document-parts';
import { BuildInput, BuiltReport, ReportKind } from './report-kind';
import { presentationOf } from '../../../exports/export-presentation';
import { plantDayText } from '../../../exports/report/report-values';

const CODING: Readonly<Record<string, string>> = {
  uncoded: 'Not coded',
  coded: 'Coded',
  reviewed: 'Reviewed',
};
const TYPES: Readonly<Record<string, string>> = {
  downtime: 'Stop',
  slowdown: 'Slowdown',
  quality_loss: 'Quality loss',
  grade_transition: 'Grade transition',
};

function shiftSections(data: ShiftHandoverView): ReportSection[] {
  const crews = [
    ...new Set(data.instances.flatMap((i) => (i.crewName ? [i.crewName] : []))),
  ];
  return [
    {
      kind: 'facts',
      title: 'Shift',
      rows: [
        ['Plant date', data.localDate],
        ['Shift', data.shiftName],
        ['Crew', crews.length ? crews.join(', ') : 'Not recorded'],
      ],
    },
    productionTable('Production by product', data.production),
    eventStatusTable(data.eventStatus),
    {
      kind: 'table',
      title: 'Events of the shift',
      note: data.eventsTruncated
        ? 'The first 100 events; the Event Hub lists all of them.'
        : undefined,
      sheet: 'Events',
      columns: [
        { label: 'Start', type: 'datetime' },
        { label: 'End', type: 'datetime' },
        { label: 'Unit', type: 'text' },
        { label: 'Event', type: 'text' },
        { label: 'Reason / grades', type: 'text', width: 2 },
        { label: 'Asset', type: 'text' },
        { label: 'Duration', type: 'duration' },
        { label: 'Coding', type: 'text' },
      ],
      rows: data.events.map((e) => [
        e.start,
        e.end,
        e.unitName,
        TYPES[e.physicalType] ?? e.physicalType,
        e.physicalType === 'grade_transition'
          ? `${e.fromProduct ?? '?'} → ${e.toProduct ?? '?'}`
          : e.reason,
        e.asset,
        e.seconds,
        `${CODING[e.codingState] ?? e.codingState}${e.verified ? ', verified' : ''}`,
      ]),
    },
    {
      kind: 'text',
      title: 'Handover notes',
      paragraphs: data.notes.length
        ? data.notes.map(
            (n) => `${n.authorName ?? 'Unknown author'}: ${n.body}`,
          )
        : ['No notes for this shift.'],
    },
  ];
}

/** R2 Shift handover as a document: the shift, its output, its events and their coding, and the notes. */
async function build(
  input: BuildInput<ShiftHandoverQueryDto>,
): Promise<BuiltReport> {
  const { manager, context, query, services, money } = input;
  const response = await services.ops.shiftHandover(context, query);
  const data = response.data;
  const day = Date.parse(`${query.localDate}T00:00:00Z`);
  const scope = await resolveReportScope(manager, context, {
    from: data.from ?? new Date(day).toISOString(),
    to: data.to ?? new Date(day + 86_400_000).toISOString(),
    unitIds: query.unitIds,
  });
  const document = await documentOf(
    manager,
    scope,
    {
      kind: 'shift',
      // the date on the plant's calendar and digits, like the cover (settings audit, 21 Oct 2026)
      title: `Shift handover · ${plantDayText(query.localDate, await presentationOf(manager, scope.tenantId, undefined))} · shift ${query.shiftName}`,
      subtitle: 'Output, events, coding and notes for the next shift',
      money,
    },
    { sections: shiftSections(data), responses: [response] },
  );
  return { document, unitIds: scope.unitIds };
}

export const SHIFT_REPORT: ReportKind<ShiftHandoverQueryDto> = {
  query: ShiftHandoverQueryDto,
  build,
};
