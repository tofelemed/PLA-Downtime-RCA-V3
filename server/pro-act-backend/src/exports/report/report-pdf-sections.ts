import { PlantFormat } from '../pdf/plant-format';
import {
  ReportFacts,
  ReportKpis,
  ReportTable,
  ReportText,
} from './report-document';
import {
  fitText,
  PAGE,
  ReportPdfDoc,
  shrinkToFit,
  THEME,
} from './report-pdf-kit';
import { printCell } from './report-values';

/** What the section drawers need: the document, the cursor, a page break, fonts and the plant format. */
export interface DrawContext {
  doc: ReportPdfDoc;
  y: number;
  /** starts a new page (header drawn) and puts the cursor under the header */
  newPage: () => void;
  text: (value: string) => string;
  bold: string;
  regular: string;
  format: PlantFormat;
}

const LEFT = PAGE.margin;
const WIDTH = PAGE.width - 2 * PAGE.margin;
const ROW = 16;

/** Breaks the page unless `height` points still fit above the footer. */
export function ensure(ctx: DrawContext, height: number): void {
  if (ctx.y + height > PAGE.footerTop - 8) ctx.newPage();
}

export function sectionTitle(
  ctx: DrawContext,
  title: string,
  note?: string,
): void {
  ensure(ctx, note ? 48 : 36);
  const { doc } = ctx;
  doc.rect(LEFT, ctx.y + 1, 3, 12).fill(THEME.red);
  doc
    .font(ctx.bold)
    .fontSize(11)
    .fillColor(THEME.navy)
    .text(ctx.text(title), LEFT + 9, ctx.y, { lineBreak: false });
  ctx.y += 18;
  if (note) {
    doc.font(ctx.regular).fontSize(8).fillColor(THEME.muted);
    const text = ctx.text(note);
    const height = doc.heightOfString(text, { width: WIDTH });
    doc.text(text, LEFT, ctx.y, { width: WIDTH });
    ctx.y += height + 4;
  }
}

/** KPI tiles, up to six a row: label, value, caption. */
export function drawKpis(ctx: DrawContext, section: ReportKpis): void {
  sectionTitle(ctx, section.title);
  const perRow = Math.min(6, Math.max(1, section.items.length));
  const gap = 8;
  const width = (WIDTH - gap * (perRow - 1)) / perRow;
  const height = 54;
  section.items.forEach((item, index) => {
    if (index % perRow === 0) {
      if (index > 0) ctx.y += height + gap;
      ensure(ctx, height);
    }
    const x = LEFT + (index % perRow) * (width + gap);
    const { doc } = ctx;
    doc.roundedRect(x, ctx.y, width, height, 4).fill(THEME.tile);
    doc.rect(x, ctx.y, 3, height).fill(THEME.navy);
    doc.font(ctx.regular).fontSize(8).fillColor(THEME.muted);
    doc.text(fitText(doc, ctx.text(item.label), width - 14), x + 9, ctx.y + 6, {
      lineBreak: false,
    });
    const value = ctx.text(
      printCell(item.value, item, ctx.format) +
        (item.unit && item.type !== 'money' ? ` ${item.unit}` : ''),
    );
    doc.font(ctx.bold).fillColor(THEME.ink);
    shrinkToFit(doc, value, width - 14, { max: 15, min: 9 });
    doc.text(fitText(doc, value, width - 14), x + 9, ctx.y + 19, {
      lineBreak: false,
    });
    if (item.caption) {
      doc.font(ctx.regular).fontSize(7).fillColor(THEME.muted);
      doc.text(
        fitText(doc, ctx.text(item.caption), width - 14),
        x + 9,
        ctx.y + 40,
        { lineBreak: false },
      );
    }
  });
  ctx.y += height + 14;
}

export function drawFacts(ctx: DrawContext, section: ReportFacts): void {
  sectionTitle(ctx, section.title);
  const { doc } = ctx;
  for (const [label, value] of section.rows) {
    ensure(ctx, 14);
    doc
      .font(ctx.bold)
      .fontSize(8.5)
      .fillColor(THEME.muted)
      .text(ctx.text(label), LEFT, ctx.y, { width: 170, lineBreak: false });
    doc
      .font(ctx.regular)
      .fillColor(THEME.ink)
      .text(fitText(doc, ctx.text(value), WIDTH - 180), LEFT + 180, ctx.y, {
        lineBreak: false,
      });
    ctx.y += 14;
  }
  ctx.y += 10;
}

export function drawText(ctx: DrawContext, section: ReportText): void {
  sectionTitle(ctx, section.title);
  const { doc } = ctx;
  doc.font(ctx.regular).fontSize(9).fillColor(THEME.ink);
  for (const paragraph of section.paragraphs) {
    const text = ctx.text(paragraph);
    const height = doc.heightOfString(text, { width: WIDTH });
    ensure(ctx, height + 4);
    doc.text(text, LEFT, ctx.y, { width: WIDTH });
    ctx.y += height + 6;
  }
  ctx.y += 6;
}

function columnXs(section: ReportTable): Array<{ x: number; width: number }> {
  const weights = section.columns.map((c) => c.width ?? 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let x = LEFT;
  return weights.map((w) => {
    const width = (WIDTH * w) / total;
    const column = { x, width };
    x += width;
    return column;
  });
}

const alignOf = (type: string) =>
  type === 'text' || type === 'date' || type === 'month' || type === 'datetime'
    ? 'left'
    : 'right';

function headerRow(
  ctx: DrawContext,
  section: ReportTable,
  xs: Array<{ x: number; width: number }>,
): void {
  const { doc } = ctx;
  doc.rect(LEFT, ctx.y, WIDTH, ROW + 2).fill(THEME.navy);
  doc.font(ctx.bold).fontSize(7.5).fillColor('#FFFFFF');
  section.columns.forEach((column, i) => {
    const label = column.unit
      ? `${column.label} (${column.unit})`
      : column.label;
    const { x, width } = xs[i];
    doc.text(fitText(doc, ctx.text(label), width - 8), x + 4, ctx.y + 5, {
      width: width - 8,
      align: alignOf(column.type),
      lineBreak: false,
    });
  });
  ctx.y += ROW + 2;
}

/** A table with a navy header row repeated on every page it spans, and zebra rows. */
export function drawTable(ctx: DrawContext, section: ReportTable): void {
  sectionTitle(ctx, section.title, section.note);
  const xs = columnXs(section);
  const { doc } = ctx;
  ensure(ctx, 2 * ROW + 4);
  headerRow(ctx, section, xs);
  if (section.rows.length === 0) {
    doc
      .font(ctx.regular)
      .fontSize(8)
      .fillColor(THEME.muted)
      .text(ctx.text('Nothing for these dates.'), LEFT + 4, ctx.y + 4, {
        lineBreak: false,
      });
    ctx.y += ROW + 10;
    return;
  }
  section.rows.forEach((row, index) => {
    if (ctx.y + ROW > PAGE.footerTop - 8) {
      ctx.newPage();
      headerRow(ctx, section, xs);
    }
    if (index % 2 === 1) doc.rect(LEFT, ctx.y, WIDTH, ROW).fill(THEME.zebra);
    doc.font(ctx.regular).fontSize(7.5).fillColor(THEME.ink);
    section.columns.forEach((column, i) => {
      const { x, width } = xs[i];
      const text = ctx.text(printCell(row[i] ?? null, column, ctx.format));
      doc.text(fitText(doc, text, width - 8), x + 4, ctx.y + 4, {
        width: width - 8,
        align: alignOf(column.type),
        lineBreak: false,
      });
    });
    ctx.y += ROW;
  });
  doc
    .strokeColor(THEME.rule)
    .lineWidth(0.5)
    .moveTo(LEFT, ctx.y)
    .lineTo(LEFT + WIDTH, ctx.y)
    .stroke();
  ctx.y += 14;
}
