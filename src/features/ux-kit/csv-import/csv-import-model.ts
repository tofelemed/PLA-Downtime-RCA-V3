import type { SaveResult } from '../save-result';
import { saveBlob } from '../save-blob';

/** A problem of one row of the file, numbered as the server (or the local check) numbers it. */
export interface CsvRowProblem {
  line: number;
  message: string;
}

/** What "Check" found: one status line, the row problems, and whether the rows can be imported. */
export interface CsvCheck {
  status: string;
  problems: readonly CsvRowProblem[];
  ready: boolean;
}

/**
 * How one Setup list imports a CSV (SETUP_UX_FIXES Phase 4). The page only knows the text; the area's
 * existing commands do the work (dry run on the server, or a local shaping check), unchanged.
 */
export interface CsvImporter {
  /** the dry run: counts or shaping problems, nothing stored; a refusal rejects (red alert) */
  check: (text: string) => Promise<CsvCheck>;
  /** a local shaping check that stops Import before anything is sent when not `ready` (shown like a check) */
  precheck?: (text: string) => CsvCheck;
  /** stores the rows (all or none) and resolves the result dialog with the counts */
  submit: (text: string) => Promise<SaveResult>;
  /** the row problems of a refused check or import (`details.errors`); empty for any other failure */
  problemsOf: (error: unknown) => readonly CsvRowProblem[];
  /** how a problem's number reads: "Row 1" (first data row) or "Line 2" (file line) */
  lineLabel?: 'Row' | 'Line';
  pending: boolean;
}

/** One CSV cell: quoted when it holds a comma, a quote or a line break. */
const cellOf = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** The template file: only the header row of the expected columns (no business data). */
export function csvTemplateText(columns: readonly string[]): string {
  return `${columns.map(cellOf).join(',')}\r\n`;
}

/** Hands the template CSV (header row only) to the browser as `fileName`. */
export function downloadCsvTemplate(fileName: string, columns: readonly string[]): void {
  saveBlob(new Blob([csvTemplateText(columns)], { type: 'text/csv;charset=utf-8' }), fileName);
}

/** Why Import is disabled, or null when it may run. */
export function importBlockedReason(text: string, accepted: string | null, pending: boolean, problemsListed = false): string | null {
  if (pending) return null;
  if (!text.trim()) return 'Choose a CSV file or paste the rows first.';
  if (accepted !== null && accepted === text) return 'These rows were imported. Change the file or the rows to import again.';
  return problemsListed ? 'Fix the rows listed above, then check again.' : null;
}
