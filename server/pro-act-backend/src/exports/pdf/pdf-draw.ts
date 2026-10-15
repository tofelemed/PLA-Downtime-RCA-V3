import { PdfBlock, PdfDocumentModel, PdfPage } from './pdf-model';
import { PdfSurface, PdfTextStyle } from './pdf-surface';

/** A4 landscape in points. */
export const PAGE = { width: 842, height: 595, margin: 36 } as const;
export const LINE_HEIGHT = 13;
const BODY_TOP = 92;
const FOOTER_Y = PAGE.height - PAGE.margin - 10;
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;
const FACT_LABEL_WIDTH = 150;

/** Colours that keep at least 4.5:1 contrast on white. */
const INK = '#1f2937';
const MUTED = '#4b5563';
const APPROVED = '#166534';
const PROVISIONAL = '#92400e';
const RULE = '#9ca3af';

const style = (overrides: Partial<PdfTextStyle>): PdfTextStyle => ({
  size: 9,
  bold: false,
  color: INK,
  align: 'left',
  width: CONTENT_WIDTH,
  ...overrides,
});

const TONES: Record<string, string> = {
  approved: APPROVED,
  provisional: PROVISIONAL,
  muted: MUTED,
};

function drawHeader(surface: PdfSurface, page: PdfPage): void {
  const { margin } = PAGE;
  surface.text(
    page.header.title,
    margin,
    margin,
    style({ size: 14, bold: true }),
  );
  surface.text(
    page.header.subtitle,
    margin,
    margin + 20,
    style({ color: MUTED }),
  );
  surface.text(
    page.header.status,
    margin,
    margin,
    style({
      size: 10,
      bold: true,
      color: TONES[page.header.tone],
      align: 'right',
    }),
  );
  surface.rule(margin, PAGE.width - margin, margin + 38, RULE);
}

function drawTable(
  surface: PdfSurface,
  block: Extract<PdfBlock, { kind: 'table' }>,
  top: number,
): number {
  const totalWidth = block.columns.reduce((sum, c) => sum + c.width, 0);
  const widths = block.columns.map(
    (c) => (c.width / totalWidth) * CONTENT_WIDTH,
  );
  const drawRow = (cells: readonly string[], y: number, bold: boolean) => {
    let x = PAGE.margin;
    cells.forEach((cell, i) => {
      const column = block.columns[i];
      surface.text(
        cell,
        x,
        y,
        style({ bold, width: widths[i] - 4, align: column?.align ?? 'left' }),
      );
      x += widths[i];
    });
  };
  drawRow(
    block.columns.map((c) => c.label),
    top,
    true,
  );
  surface.rule(
    PAGE.margin,
    PAGE.width - PAGE.margin,
    top + LINE_HEIGHT - 2,
    RULE,
  );
  block.rows.forEach((row, index) =>
    drawRow(row, top + (index + 1) * LINE_HEIGHT, false),
  );
  return top + (block.rows.length + 2) * LINE_HEIGHT;
}

/** Draws one block at `top`; returns the top of the next block. */
function drawBlock(surface: PdfSurface, block: PdfBlock, top: number): number {
  const x = PAGE.margin;
  switch (block.kind) {
    case 'heading':
      surface.text(
        block.text,
        x,
        top + LINE_HEIGHT,
        style({ size: 11, bold: true }),
      );
      return top + 2 * LINE_HEIGHT;
    case 'label':
      surface.text(
        block.text,
        x,
        top,
        style({ bold: true, color: TONES[block.tone] }),
      );
      return top + LINE_HEIGHT;
    case 'facts':
      block.rows.forEach(([label, value], i) => {
        const y = top + i * LINE_HEIGHT;
        surface.text(
          label,
          x,
          y,
          style({ color: MUTED, width: FACT_LABEL_WIDTH }),
        );
        surface.text(
          value,
          x + FACT_LABEL_WIDTH,
          y,
          style({ width: CONTENT_WIDTH - FACT_LABEL_WIDTH }),
        );
      });
      return top + (block.rows.length + 1) * LINE_HEIGHT;
    case 'table':
      return drawTable(surface, block, top);
  }
}

/** Draws the laid-out document on a surface, page by page, and finishes it. */
export async function drawDocument(
  model: PdfDocumentModel,
  surface: PdfSurface,
): Promise<void> {
  for (const page of model.pages) {
    surface.addPage();
    drawHeader(surface, page);
    let top = BODY_TOP;
    for (const block of page.blocks) top = drawBlock(surface, block, top);
    surface.text(
      page.footer,
      PAGE.margin,
      FOOTER_Y,
      style({ size: 8, color: MUTED }),
    );
  }
  await surface.end();
}
