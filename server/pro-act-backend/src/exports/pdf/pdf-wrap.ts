import { PdfColumn } from './pdf-model';

/** A4 landscape width minus both margins, in points (the width every table spans). */
export const CONTENT_WIDTH = 842 - 2 * 36;
/** Body text size of table cells, in points. */
export const CELL_SIZE = 9;
/** Padding kept free at the right of each cell, in points. */
export const CELL_PADDING = 4;
/** A cell never takes more lines than this; the last one is cut with an ellipsis. */
const MAX_CELL_LINES = 4;
/**
 * Conservative average glyph width as a share of the font size (Helvetica capitals reach ~0.72 em, lower
 * case ~0.5 em), so a wrapped line never runs past its cell.
 */
const GLYPH_EM = 0.62;

/** Each column's width in points, from its share of the table. */
export function columnWidths(columns: readonly PdfColumn[]): number[] {
  const total = columns.reduce((sum, c) => sum + c.width, 0);
  return columns.map((c) => (c.width / total) * CONTENT_WIDTH);
}

function charsPerLine(width: number): number {
  return Math.max(
    1,
    Math.floor((width - CELL_PADDING) / (CELL_SIZE * GLYPH_EM)),
  );
}

function cutLongWord(word: string, room: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < word.length; i += room)
    parts.push(word.slice(i, i + room));
  return parts;
}

/**
 * The lines a cell is printed on (QA re-test N4: a long reason wrapped inside a one-line row and
 * overprinted the next row). Breaks at spaces; a word longer than the line is cut.
 */
export function wrapCell(text: string, width: number): string[] {
  const room = charsPerLine(width);
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= room) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    const pieces = word.length > room ? cutLongWord(word, room) : [word];
    current = pieces.pop() ?? '';
    lines.push(...pieces);
  }
  if (current || lines.length === 0) lines.push(current);
  if (lines.length <= MAX_CELL_LINES) return lines;
  const kept = lines.slice(0, MAX_CELL_LINES);
  kept[MAX_CELL_LINES - 1] = `${kept[MAX_CELL_LINES - 1]} ${lines
    .slice(MAX_CELL_LINES)
    .join(' ')}`;
  return kept;
}

/** Every cell of a row as its printed lines. */
export function wrapRow(
  row: readonly string[],
  columns: readonly PdfColumn[],
): string[][] {
  const widths = columnWidths(columns);
  return row.map((cell, i) => wrapCell(cell, widths[i] ?? CONTENT_WIDTH));
}

/** Text lines a row takes: its tallest wrapped cell. */
export function rowLines(
  row: readonly string[],
  columns: readonly PdfColumn[],
): number {
  return Math.max(1, ...wrapRow(row, columns).map((cell) => cell.length));
}
