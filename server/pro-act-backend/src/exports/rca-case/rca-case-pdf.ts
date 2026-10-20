import { ExportJob } from '../entities/export-job.entity';
import { REPORT_TITLES } from '../pdf/pdf-content';
import { linesOf, Paginator } from '../pdf/pdf-layout';
import {
  ExportPresentation,
  PdfBlock,
  PdfDocumentModel,
  PdfPage,
} from '../pdf/pdf-model';
import { plantDateTime, toPlantDigits } from '../pdf/plant-format';
import { rowLines } from '../pdf/pdf-wrap';
import { RcaCaseExportContent } from './rca-case-content';
import {
  actionsSection,
  analysesSection,
  CaseSection,
  causesSection,
  closureSection,
  definitionSection,
  formatOf,
  outcomeSection,
  teamSection,
  timelineSection,
} from './rca-case-pdf-sections';

const RCA_CASE_REPORT_TITLE = REPORT_TITLES.rca_case;

/** Cover facts: plant, report, case, request and display settings. */
function coverFacts(
  job: ExportJob,
  content: RcaCaseExportContent,
  p: ExportPresentation,
): Array<[string, string]> {
  return [
    ['Plant', p.plantName],
    ['Report', RCA_CASE_REPORT_TITLE],
    ['Investigation', content.case.title],
    ['Status', content.case.status ?? 'Draft'],
    ['Requested', plantDateTime(job.createdAt.toISOString(), formatOf(p))],
    ['Requested by', job.labels?.requestedByName ?? '—'],
    ['Time zone', p.timezone ?? 'UTC'],
    ['Money shown in', p.currency],
    ['Case id', content.case.id],
    ['Export id', job.id],
  ];
}

function sectionsOf(
  content: RcaCaseExportContent,
  p: ExportPresentation,
): CaseSection[] {
  return [
    definitionSection(content, p),
    teamSection(content),
    timelineSection(content, p),
    causesSection(content),
    analysesSection(content, p),
    actionsSection(content, p),
    outcomeSection(content, p),
    closureSection(content, p),
  ];
}

function headerOf(
  content: RcaCaseExportContent,
  p: ExportPresentation,
): PdfPage['header'] {
  const status = content.case.status ?? 'Draft';
  return {
    title: `${RCA_CASE_REPORT_TITLE} · ${p.plantName}`,
    subtitle: content.case.title,
    status: status.toUpperCase(),
    tone: status === 'Closed' ? 'approved' : 'provisional',
  };
}

/** A table this short stays whole with its heading; a longer one starts with at least its first row. */
const SHORT_TABLE_ROWS = 4;

/** Lines of the section's heading and facts plus the start of its first table. */
function openingLines(section: CaseSection, intro: PdfBlock[]): number {
  const first = section.tables[0];
  const rows = first?.rows ?? [];
  const kept = rows.slice(0, rows.length <= SHORT_TABLE_ROWS ? rows.length : 1);
  const table =
    first && kept.length > 0
      ? 2 + kept.reduce((sum, row) => sum + rowLines(row, first.columns), 0)
      : 0;
  return intro.reduce((sum, b) => sum + linesOf(b), 0) + table;
}

/** Places a section, its heading never alone at the foot of a page; returns its table rows. */
function place(pager: Paginator, section: CaseSection): number {
  const intro: PdfBlock[] = [
    { kind: 'heading', text: section.heading },
    ...(section.facts.length
      ? [{ kind: 'facts' as const, rows: section.facts }]
      : []),
  ];
  pager.ensure(openingLines(section, intro));
  pager.keep(intro);
  if (section.tables.length === 0 && section.empty) {
    pager.keep([{ kind: 'label', text: section.empty, tone: 'muted' }]);
  }
  for (const block of section.tables) pager.table(section.heading, block);
  return section.tables.reduce((sum, t) => sum + t.rows.length, 0);
}

/**
 * The PDF of an `rca_case` export (item 2.5), laid out from the content pinned on the job and its pinned
 * presentation only: a cover, then definition, team, status timeline, causes by kind, analyses, actions
 * with verification, the outcome's three separate figures (money in the display currency, never converted
 * or added) and the closure approval with the SuperAdmin self-approval marker. Every page repeats the
 * plant, the case and its status, and ends with `Page n of N`.
 */
export function rcaCaseDocumentOf(
  job: ExportJob,
  presentation: ExportPresentation,
): { model: PdfDocumentModel; rowCount: number } {
  const content = job.caseContent;
  if (!content)
    throw new Error(`RCA case export ${job.id} has no pinned content`);
  const header = headerOf(content, presentation);
  const pager = new Paginator(header);
  pager.keep([
    { kind: 'heading', text: 'Export' },
    { kind: 'facts', rows: coverFacts(job, content, presentation) },
  ]);
  const rowCount = sectionsOf(content, presentation).reduce(
    (sum, section) => sum + place(pager, section),
    0,
  );
  const n = (value: number) =>
    toPlantDigits(String(value), presentation.digits);
  const total = pager.pages.length;
  const pages = pager.pages.map((page) => ({
    ...page,
    footer: `Page ${n(page.number)} of ${n(total)} · Export ${job.id} · the investigation as recorded when the export was requested; loss values from approved revisions only`,
  }));
  return {
    model: {
      info: {
        title: header.title,
        subject: header.subtitle,
        createdAt: job.createdAt,
      },
      pages,
    },
    rowCount,
  };
}
