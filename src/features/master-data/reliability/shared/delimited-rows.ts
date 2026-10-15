/** One import row as text fields (column header → cell), whatever the file format. */
export type TextRow = Readonly<Record<string, string>>;

export interface ParsedRows {
  rows: TextRow[];
  /** the file could not be read at all (nothing to send) */
  error: string | null;
}

/** Cells of one CSV line: commas, double-quoted cells with "" escapes. */
function cellsOf(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted && char === '"' && line[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function csvRows(text: string): ParsedRows {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return { rows: [], error: 'Add a header line and at least one row.' };
  const header = cellsOf(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = cellsOf(line);
    return Object.fromEntries(header.map((name, i) => [name, cells[i] ?? '']));
  });
  return { rows, error: null };
}

const textOf = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

function jsonRows(text: string): ParsedRows {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { rows: [], error: 'The JSON is not valid.' };
  }
  const list = Array.isArray(parsed) ? parsed : null;
  if (!list || list.some((item) => typeof item !== 'object' || item === null || Array.isArray(item))) {
    return { rows: [], error: 'The JSON must be a list of objects, one per row.' };
  }
  const rows = list.map((item: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(item).map(([key, value]) => [key, textOf(value).trim()])),
  );
  return { rows, error: rows.length === 0 ? 'The list is empty.' : null };
}

/** A pasted CSV (first line = column names) or JSON list of objects, as text rows in file order. */
export function parseDelimitedRows(text: string): ParsedRows {
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], error: 'Paste the rows first.' };
  return trimmed.startsWith('[') ? jsonRows(trimmed) : csvRows(trimmed);
}

/** An ISO 8601 instant with its UTC offset (`…Z` or `…+03:30`): a time without a zone is ambiguous. */
export const isZonedInstant = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));

/** The cell, or undefined when empty (optional fields are left out of the payload). */
export const optional = (row: TextRow, column: string): string | undefined => row[column] || undefined;
