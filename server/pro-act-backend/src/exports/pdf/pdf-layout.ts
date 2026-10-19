import { ExportHeader } from '../export-report';
import { coverFacts, PdfSection, REPORT_TITLES } from './pdf-content';
import {
  ExportPresentation,
  PdfBlock,
  PdfColumn,
  PdfDocumentModel,
  PdfPage,
} from './pdf-model';
import { plantRange, toPlantDigits } from './plant-format';
import { rowLines } from './pdf-wrap';

/** Text lines that fit between the running header and the footer of an A4 landscape page. */
export const PAGE_LINES = 32;

/** Lines a block takes (a heading has space above it; a table its column row). */
export function linesOf(block: PdfBlock): number {
  switch (block.kind) {
    case 'heading':
      return 2;
    case 'label':
      return 1;
    case 'facts':
      return block.rows.length + 1;
    case 'table':
      return tableRowLines(block.rows, block.columns) + 2;
  }
}

/** Text lines the rows of a table take once their cells are wrapped. */
function tableRowLines(
  rows: readonly string[][],
  columns: readonly PdfColumn[],
): number {
  return rows.reduce((sum, row) => sum + rowLines(row, columns), 0);
}

/** How many leading rows fit in `room` lines (0 when not even the first does: it starts a new page). */
function rowsFitting(
  rows: readonly string[][],
  columns: readonly PdfColumn[],
  room: number,
): number {
  let used = 0;
  let count = 0;
  for (const row of rows) {
    used += rowLines(row, columns);
    if (used > room) break;
    count += 1;
  }
  return count;
}

export interface LayoutInput {
  header: ExportHeader;
  presentation: ExportPresentation;
  sections: readonly PdfSection[];
  /** the valuation bases of the revisions' loss values (`basisText`), in first-seen order */
  bases?: readonly string[];
}

/** The running header's basis note: one basis, or a pointer to each section when they differ. */
function basisNote(bases: readonly string[]): string {
  if (bases.length === 0) return '';
  if (bases.length === 1) return ` · Loss values: ${bases[0]}`;
  return ' · Loss values: several bases (see each revision)';
}

type Header = PdfPage['header'];

/** Cuts blocks into pages; a table that does not fit continues on the next page under its heading. */
class Paginator {
  readonly pages: PdfPage[] = [];
  private used = 0;

  constructor(private readonly header: Header) {
    this.newPage();
  }

  private get page(): PdfPage {
    return this.pages[this.pages.length - 1];
  }

  private newPage(): void {
    this.pages.push({
      number: this.pages.length + 1,
      header: this.header,
      blocks: [],
      footer: '',
    });
    this.used = 0;
  }

  /** Keeps `blocks` together on one page (a new page when they do not fit and the page has content). */
  keep(blocks: PdfBlock[]): void {
    const cost = blocks.reduce((sum, b) => sum + linesOf(b), 0);
    if (this.used + cost > PAGE_LINES && this.page.blocks.length > 0) {
      this.newPage();
    }
    this.page.blocks.push(...blocks);
    this.used += cost;
  }

  table(heading: string, block: Extract<PdfBlock, { kind: 'table' }>): void {
    let rows = block.rows;
    while (rows.length > 0) {
      const room = PAGE_LINES - this.used - 2;
      const count = rowsFitting(rows, block.columns, room);
      if (count === 0) {
        this.newPage();
        this.keep([{ kind: 'heading', text: `${heading} (continued)` }]);
        continue;
      }
      this.keep([{ ...block, rows: rows.slice(0, count) }]);
      rows = rows.slice(count);
    }
  }
}

function sectionBlocks(section: PdfSection): PdfBlock[] {
  return [
    { kind: 'heading', text: section.heading },
    { kind: 'label', text: section.label.text, tone: section.label.tone },
    { kind: 'facts', rows: section.facts },
  ];
}

function headerOf(input: LayoutInput): Header {
  const { header, presentation } = input;
  const { from, to } = header.filters;
  const provisional = input.sections.some(
    (s) => s.label.tone === 'provisional',
  );
  return {
    title: `${REPORT_TITLES[header.reportType]} · ${presentation.plantName}`,
    subtitle: `${
      from && to
        ? plantRange(from, to, presentation)
        : 'Named approved revisions'
    }${basisNote(input.bases ?? [])}`,
    status: provisional ? 'APPROVED · PROVISIONAL FX' : 'APPROVED',
    tone: provisional ? 'provisional' : 'approved',
  };
}

/**
 * The document of a PDF export: a cover block (plant, report, window and request on the plant clock,
 * display currency), then one section per approved revision in pinned order. Every page repeats the
 * report, plant and window with the approval status, and ends with `Page n of N`.
 */
export function layoutDocument(input: LayoutInput): PdfDocumentModel {
  const header = headerOf(input);
  const pager = new Paginator(header);
  pager.keep([
    { kind: 'heading', text: 'Export' },
    {
      kind: 'facts',
      rows: [
        ...coverFacts(input.header, input.presentation),
        ['Loss value basis', (input.bases ?? []).join('; ') || 'Not valued'],
      ],
    },
  ]);
  if (input.sections.length === 0) {
    pager.keep([
      {
        kind: 'label',
        text: 'No approved revisions in this window.',
        tone: 'muted',
      },
    ]);
  }
  for (const section of input.sections) {
    pager.keep(sectionBlocks(section));
    if (section.rows.length === 0) {
      pager.keep([{ kind: 'label', text: 'No rows.', tone: 'muted' }]);
      continue;
    }
    pager.table(section.heading, {
      kind: 'table',
      columns: section.columns,
      rows: section.rows,
    });
  }
  const total = pager.pages.length;
  const n = (value: number) =>
    toPlantDigits(String(value), input.presentation.digits);
  const pages = pager.pages.map((page) => ({
    ...page,
    footer: `Page ${n(page.number)} of ${n(total)} · Export ${input.header.jobId} · approved content only, rendered from approval snapshots`,
  }));
  return {
    info: {
      title: header.title,
      subject: header.subtitle,
      createdAt: new Date(input.header.requestedAt),
    },
    pages,
  };
}
