export type Cell = string | number | boolean | null | undefined;
export type Row = Record<string, Cell>;

function escape(cell: Cell): string {
  return String(cell ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

/** A Markdown table of the rows (columns from the first row); `_none_` when empty. */
export function markdownTable(rows: readonly Row[]): string {
  if (rows.length === 0) return '_none_';
  const headers = Object.keys(rows[0]);
  const line = (cells: Cell[]) => `| ${cells.map(escape).join(' | ')} |`;
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map((row) => line(headers.map((h) => row[h]))),
  ].join('\n');
}

/** `a: 1, b: 2` for a count map; `—` when empty. */
export function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, n]) => n !== 0);
  if (entries.length === 0) return '—';
  return entries.map(([key, n]) => `${key}: ${n}`).join(', ');
}
