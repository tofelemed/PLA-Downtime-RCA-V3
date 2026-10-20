import { Workbook, Worksheet } from 'exceljs';
import { ExportPresentation } from '../pdf/pdf-model';
import { plantDateTime, plantRange } from '../pdf/plant-format';
import { PdfSink } from '../pdf/pdf-surface';
import {
  ReportCell,
  ReportColumn,
  ReportDocument,
  ReportKpis,
  ReportTable,
} from './report-document';

export interface ReportXlsxInput {
  document: ReportDocument;
  presentation: ExportPresentation;
  logo: Buffer | null;
  generatedAt: Date;
}

const NAVY = 'FF1F3A8A';
const RED = 'FFD62828';
const MUTED = 'FF6B7280';

/** Excel number format of a column type. */
export function numFmtOf(
  column: Pick<ReportColumn, 'type' | 'places' | 'unit'>,
): string | undefined {
  const places = column.places ?? 1;
  const decimals = places > 0 ? `.${'0'.repeat(places)}` : '';
  switch (column.type) {
    case 'number':
      return `#,##0${decimals}`;
    case 'percent':
      return '0.0%';
    case 'duration':
      return '[h]:mm';
    case 'money':
      return `#,##0.00 "${column.unit ?? ''}"`;
    case 'date':
      return 'yyyy-mm-dd';
    case 'datetime':
      return 'yyyy-mm-dd hh:mm';
    default:
      return undefined;
  }
}

/** The plant-clock wall time of an instant as an Excel date (Excel dates carry no zone). */
function wallClock(iso: string, timeZone: string | null): Date | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone ?? 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const read = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(
    Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour'),
      read('minute'),
    ),
  );
}

/** A cell as stored in the workbook: numbers, ratios, durations (days) and dates as real values. */
export function xlsxValue(
  value: ReportCell,
  column: Pick<ReportColumn, 'type'>,
  timeZone: string | null,
): string | number | Date | null {
  if (value === null || value === '') return null;
  const text = String(value);
  switch (column.type) {
    case 'number':
    case 'percent':
    case 'money':
      return Number(text);
    case 'duration':
      return Number(text) / 86_400;
    case 'date': {
      const [y, m, d] = text.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    }
    case 'datetime':
      return wallClock(text, timeZone);
    default:
      return text;
  }
}

/** A sheet name Excel accepts (≤ 31 characters, no `[]:*?/\`), unique in the workbook. */
export function sheetName(wanted: string, taken: Set<string>): string {
  const base =
    wanted
      .replace(/[[\]:*?/\\]/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet';
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n += 1)
    name = `${base.slice(0, 28)} ${n}`;
  taken.add(name.toLowerCase());
  return name;
}

function title(
  sheet: Worksheet,
  row: number,
  text: string,
  size: number,
  color = NAVY,
): void {
  const cell = sheet.getCell(row, 1);
  cell.value = text;
  cell.font = { bold: true, size, color: { argb: color } };
}

function summarySheet(
  book: Workbook,
  input: ReportXlsxInput,
  taken: Set<string>,
): void {
  const { document, presentation } = input;
  const sheet = book.addWorksheet(sheetName('Summary', taken));
  sheet.getColumn(1).width = 34;
  sheet.getColumn(2).width = 60;
  let row = 1;
  if (input.logo) {
    // exceljs types its Buffer as ArrayBuffer-backed; a Node file Buffer is the same bytes
    const image = book.addImage({
      buffer: input.logo as unknown as ArrayBuffer,
      extension: 'png',
    });
    sheet.addImage(image, {
      tl: { col: 0, row: 0 },
      ext: { width: 72, height: 72 },
    });
    row = 6;
  }
  title(sheet, row, document.title, 16);
  sheet.getCell(row + 1, 1).value = document.subtitle;
  sheet.getCell(row + 1, 1).font = { color: { argb: MUTED } };
  if (document.provisional)
    title(sheet, row + 2, 'PROVISIONAL – not approved', 11, RED);
  row += 4;
  const facts: Array<[string, string]> = [
    ['Plant', presentation.plantName],
    [
      'Dates',
      plantRange(document.from, document.to, {
        ...presentation,
        digits: 'latin',
      }),
    ],
    ['Units', document.units.length ? document.units.join(', ') : 'All units'],
    [
      'Figures',
      document.provisional
        ? `Provisional: ${document.unapprovedPeriods} period(s) not approved yet`
        : 'Approved revisions',
    ],
    [
      'Generated',
      `${plantDateTime(input.generatedAt.toISOString(), { ...presentation, digits: 'latin' })} (${presentation.timezone ?? 'UTC'})`,
    ],
  ];
  for (const [label, value] of facts) {
    sheet.getCell(row, 1).value = label;
    sheet.getCell(row, 1).font = { bold: true };
    sheet.getCell(row, 2).value = value;
    row += 1;
  }
  for (const section of document.sections) {
    row += 1;
    if (section.kind === 'kpis')
      row = kpiRows(sheet, row, section, presentation.timezone);
    else if (section.kind === 'facts' || section.kind === 'text') {
      title(sheet, row, section.title, 11);
      const lines =
        section.kind === 'facts'
          ? section.rows
          : section.paragraphs.map((p): [string, string] => ['', p]);
      for (const [label, value] of lines) {
        row += 1;
        sheet.getCell(row, 1).value = label;
        sheet.getCell(row, 2).value = value;
      }
      row += 1;
    }
  }
}

function kpiRows(
  sheet: Worksheet,
  start: number,
  section: ReportKpis,
  timeZone: string | null,
): number {
  title(sheet, start, section.title, 11);
  let row = start + 1;
  for (const item of section.items) {
    sheet.getCell(row, 1).value = item.label;
    const cell = sheet.getCell(row, 2);
    cell.value = xlsxValue(item.value, item, timeZone);
    const fmt = numFmtOf(item);
    if (fmt) cell.numFmt = fmt;
    cell.alignment = { horizontal: 'left' };
    row += 1;
  }
  return row;
}

function tableSheet(
  book: Workbook,
  input: ReportXlsxInput,
  section: ReportTable,
  taken: Set<string>,
): void {
  const sheet = book.addWorksheet(
    sheetName(section.sheet ?? section.title, taken),
  );
  title(
    sheet,
    1,
    input.document.provisional
      ? `${section.title} (provisional)`
      : section.title,
    13,
  );
  if (section.note) {
    sheet.getCell(2, 1).value = section.note;
    sheet.getCell(2, 1).font = { italic: true, color: { argb: MUTED } };
  }
  const header = sheet.getRow(3);
  section.columns.forEach((column, i) => {
    const cell = header.getCell(i + 1);
    cell.value =
      column.unit && column.type !== 'money'
        ? `${column.label} (${column.unit})`
        : column.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    const width = Math.max(
      12,
      Math.min(48, column.label.length + 4, column.type === 'text' ? 40 : 18),
    );
    sheet.getColumn(i + 1).width = width;
    const fmt = numFmtOf(column);
    if (fmt) sheet.getColumn(i + 1).numFmt = fmt;
  });
  section.rows.forEach((values, r) => {
    const row = sheet.getRow(4 + r);
    section.columns.forEach((column, i) => {
      row.getCell(i + 1).value = xlsxValue(
        values[i] ?? null,
        column,
        input.presentation.timezone,
      );
    });
  });
  sheet.views = [{ state: 'frozen', ySplit: 3 }];
  if (section.rows.length > 0) {
    sheet.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: 3 + section.rows.length, column: section.columns.length },
    };
  }
}

/**
 * Writes a report export as a workbook (owner 2026-10-20): a Summary sheet (logo, title, the provisional
 * stamp, plant, dates, units, KPIs and facts), then one sheet per table with a styled, frozen and filtered
 * header and real number, percent, duration ([h]:mm) and date cells. Returns the number of table rows.
 */
export async function writeReportXlsx(
  input: ReportXlsxInput,
  sink: PdfSink,
): Promise<number> {
  const book = new Workbook();
  book.creator = 'Pro-Act';
  book.created = input.generatedAt;
  book.modified = input.generatedAt;
  const taken = new Set<string>();
  summarySheet(book, input, taken);
  let rows = 0;
  for (const section of input.document.sections) {
    if (section.kind !== 'table') continue;
    tableSheet(book, input, section, taken);
    rows += section.rows.length;
  }
  const buffer = await book.xlsx.writeBuffer();
  await sink.write(Buffer.from(buffer));
  return rows;
}
