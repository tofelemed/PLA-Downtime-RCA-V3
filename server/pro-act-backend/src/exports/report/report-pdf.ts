import { PdfFonts } from '../pdf/pdf-fonts';
import { ExportPresentation } from '../pdf/pdf-model';
import { plantDateTime, plantRange } from '../pdf/plant-format';
import { PdfSink } from '../pdf/pdf-surface';
import { ReportDocument } from './report-document';
import {
  drawable,
  fitText,
  loadReportPdfKit,
  PAGE,
  ReportPdfDoc,
  THEME,
} from './report-pdf-kit';
import {
  DrawContext,
  drawFacts,
  drawKpis,
  drawTable,
  drawText,
} from './report-pdf-sections';

export interface ReportPdfInput {
  document: ReportDocument;
  presentation: ExportPresentation;
  fonts: PdfFonts;
  logo: Buffer | null;
  generatedAt: Date;
}

const STAMP = 'PROVISIONAL – not approved';

function header(
  doc: ReportPdfDoc,
  input: ReportPdfInput,
  text: (s: string) => string,
  fonts: { bold: string; regular: string },
): void {
  const { document, presentation } = input;
  const left = PAGE.margin;
  let x = left;
  if (input.logo) {
    doc.image(input.logo, left, 22, { fit: [54, 54] });
    x = left + 64;
  }
  doc
    .font(fonts.bold)
    .fontSize(17)
    .fillColor(THEME.navy)
    .text(text(document.title), x, 26, { lineBreak: false });
  doc.font(fonts.regular).fontSize(9).fillColor(THEME.muted);
  doc.text(fitText(doc, text(document.subtitle), 430), x, 48, {
    lineBreak: false,
  });
  doc.text(fitText(doc, text(presentation.plantName), 430), x, 61, {
    lineBreak: false,
  });
  if (document.provisional) {
    doc.font(fonts.bold).fontSize(9);
    const width = doc.widthOfString(text(STAMP)) + 16;
    const stampX = PAGE.width - PAGE.margin - width;
    doc.roundedRect(stampX, 26, width, 18, 3).fill(THEME.stamp);
    doc
      .fillColor('#FFFFFF')
      .text(text(STAMP), stampX + 8, 31, { lineBreak: false });
  }
  doc.rect(left, 82, PAGE.width - 2 * left, 2).fill(THEME.red);
}

function coverFacts(ctx: DrawContext, input: ReportPdfInput): void {
  const { document, presentation } = input;
  const rows: Array<[string, string]> = [
    ['Dates', plantRange(document.from, document.to, presentation)],
    ['Units', document.units.length ? document.units.join(', ') : 'All units'],
    [
      'Figures',
      document.provisional
        ? `Provisional: ${document.unapprovedPeriods} period(s) not approved yet`
        : 'Approved revisions',
    ],
    [
      'Generated',
      `${plantDateTime(input.generatedAt.toISOString(), presentation)} (${presentation.timezone ?? 'UTC'})`,
    ],
  ];
  if (document.money) rows.push(['Currency', presentation.currency]);
  const { doc } = ctx;
  const height = rows.length * 13 + 12;
  doc
    .roundedRect(PAGE.margin, ctx.y, PAGE.width - 2 * PAGE.margin, height, 4)
    .fill(THEME.zebra);
  rows.forEach(([label, value], i) => {
    const y = ctx.y + 7 + i * 13;
    doc
      .font(ctx.bold)
      .fontSize(8.5)
      .fillColor(THEME.muted)
      .text(ctx.text(label), PAGE.margin + 10, y, { lineBreak: false });
    doc
      .font(ctx.regular)
      .fillColor(THEME.ink)
      .text(fitText(doc, ctx.text(value), 640), PAGE.margin + 90, y, {
        lineBreak: false,
      });
  });
  ctx.y += height + 14;
}

function footers(
  doc: ReportPdfDoc,
  input: ReportPdfInput,
  text: (s: string) => string,
  regular: string,
): number {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc
      .strokeColor(THEME.rule)
      .lineWidth(0.5)
      .moveTo(PAGE.margin, PAGE.footerTop)
      .lineTo(PAGE.width - PAGE.margin, PAGE.footerTop)
      .stroke();
    doc.font(regular).fontSize(7.5).fillColor(THEME.muted);
    const left = `Pro-Act · ${input.presentation.plantName} · ${input.document.title}${input.document.provisional ? ` · ${STAMP}` : ''}`;
    doc.text(fitText(doc, text(left), 600), PAGE.margin, PAGE.footerTop + 8, {
      lineBreak: false,
    });
    doc.text(
      text(`Page ${i + 1} of ${range.count}`),
      PAGE.width - PAGE.margin - 120,
      PAGE.footerTop + 8,
      { width: 120, align: 'right', lineBreak: false },
    );
  }
  return range.count;
}

/**
 * Draws a report export (owner 2026-10-20): A4 landscape, the Marun logo, title and plant on every page,
 * the provisional stamp when draft figures are in it, the window and units on the first page, then the
 * sections — KPI tiles, facts, text and tables whose header row repeats on each page — and a footer with
 * the page number. Returns the number of table rows printed.
 */
export async function writeReportPdf(
  input: ReportPdfInput,
  sink: PdfSink,
): Promise<number> {
  const PDFDocument = await loadReportPdfKit();
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 0,
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: input.document.title,
      Subject: input.document.subtitle,
      Creator: 'Pro-Act',
      CreationDate: input.generatedAt,
    },
  });
  const done = new Promise<void>((resolve) => doc.on('end', resolve));
  let pending: Promise<void> = Promise.resolve();
  doc.on('data', (chunk) => {
    pending = pending.then(() => sink.write(chunk));
  });
  const fonts = { regular: 'report-regular', bold: 'report-bold' };
  doc.registerFont(fonts.regular, input.fonts.regular);
  doc.registerFont(fonts.bold, input.fonts.bold);
  const text = drawable(input.fonts);
  const ctx: DrawContext = {
    doc,
    y: PAGE.headerBottom,
    text,
    ...fonts,
    format: input.presentation,
    newPage: () => {
      doc.addPage();
      header(doc, input, text, fonts);
      ctx.y = PAGE.headerBottom;
    },
  };
  ctx.newPage();
  coverFacts(ctx, input);
  let rows = 0;
  for (const section of input.document.sections) {
    if (section.kind === 'kpis') drawKpis(ctx, section);
    else if (section.kind === 'facts') drawFacts(ctx, section);
    else if (section.kind === 'text') drawText(ctx, section);
    else {
      drawTable(ctx, section);
      rows += section.rows.length;
    }
  }
  footers(doc, input, text, fonts.regular);
  doc.end();
  await done;
  await pending;
  return rows;
}
